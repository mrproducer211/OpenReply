import { createHash } from "node:crypto";
import type {
  WebhookCommentEvent,
  WebhookMessageEvent,
  WebhookPostbackEvent,
} from "./webhook";
import type {
  ProcessCommentJob,
  ProcessMessageJob,
  ProcessPostbackJob,
} from "../queue/client";

type Payload = {
  object: "instagram" | "page";
  entry: Array<Record<string, unknown> & { id: string }>;
};

type QueuedAction =
  | { name: "process-comment"; data: ProcessCommentJob }
  | { name: "process-message"; data: ProcessMessageJob }
  | { name: "process-postback"; data: ProcessPostbackJob };

export interface IngestionDependencies {
  parse(payload: Payload): {
    comments: WebhookCommentEvent[];
    messages: WebhookMessageEvent[];
    postbacks: WebhookPostbackEvent[];
    readCount: number;
  };
  getAccount(instagramId: string): Promise<{
    id: string;
    workspaceId: string;
  } | null>;
  isActiveCampaign(automationId: string, accountId: string): Promise<boolean>;
  createEvent(payload: Payload, workspaceId: string | null): Promise<string>;
  finishEvent(
    id: string,
    status: "PROCESSED" | "FAILED",
    error?: string
  ): Promise<void>;
  enqueue(action: QueuedAction, jobId: string): Promise<boolean>;
  recordOutcome(input: {
    workspaceId: string | null;
    webhookEventId: string;
    outcome: string;
    level: "INFO" | "WARNING";
    queued: number;
    duplicates: number;
    rejected: number;
    readsIgnored: number;
  }): Promise<void>;
}

/** Validate the envelope before passing data to the existing event parsers. */
export function isWebhookPayload(value: unknown): value is Payload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.object === "instagram" || candidate.object === "page") &&
    Array.isArray(candidate.entry) &&
    candidate.entry.every(
      (entry) =>
        entry !== null &&
        typeof entry === "object" &&
        !Array.isArray(entry) &&
        typeof entry.id === "string" &&
        entry.id.length > 0 &&
        (entry.messaging === undefined || Array.isArray(entry.messaging)) &&
        (entry.changes === undefined || Array.isArray(entry.changes))
    )
  );
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/**
 * Scope mids to the account and sender; hash the original entry only when Meta
 * omits a mid. Unlike a Date.now() window, redelivery produces the same key.
 * This is queue-level deduplication, not an exactly-once delivery guarantee.
 */
export function postbackJobId(
  event: WebhookPostbackEvent,
  entry: Record<string, unknown>
): string {
  const identity = [event.instagramAccountId, event.userId, event.payload];
  identity.push(
    event.mid ? `mid:${event.mid}` : `entry:${canonicalJson(entry)}`
  );
  return `postback_${createHash("sha256").update(JSON.stringify(identity)).digest("hex")}`;
}

export function getPostbackCampaignId(payload: string): string | null {
  // Current opening/follow buttons carry exactly action:campaignId. A payload
  // with extra components must not accidentally address a different campaign.
  const match = /^(?:reveal|followcheck):([A-Za-z0-9_-]+)$/.exec(payload);
  return match && match[0] === payload ? match[1] : null;
}

/**
 * Each entry is stored independently, with its workspace assigned BEFORE any
 * enqueue. A batch spanning accounts never assigns all entries to the last
 * workspace. A failed entry causes HTTP 500 upstream; deterministic job IDs
 * make retries of already-enqueued entries harmless while those jobs remain.
 */
export async function ingestWebhook(
  value: unknown,
  dependencies: IngestionDependencies
): Promise<{ failed: boolean; entries: number }> {
  if (!isWebhookPayload(value)) throw new Error("Invalid webhook envelope");
  let failed = false;
  for (const entry of value.entry) {
    let eventId: string | null = null;
    try {
      const account = await dependencies.getAccount(entry.id);
      const payload: Payload = { object: value.object, entry: [entry] };
      eventId = await dependencies.createEvent(
        payload,
        account?.workspaceId ?? null
      );
      if (!account) {
        await dependencies.recordOutcome({
          workspaceId: null,
          webhookEventId: eventId,
          outcome: "UNMAPPED_ACCOUNT_IGNORED",
          level: "WARNING",
          queued: 0,
          duplicates: 0,
          rejected: 0,
          readsIgnored: 0,
        });
        await dependencies.finishEvent(eventId, "PROCESSED");
        continue;
      }
      const events = dependencies.parse(payload);
      let queued = 0;
      let duplicates = 0;
      let rejected = 0;
      const enqueue = async (action: QueuedAction, id: string) => {
        if (await dependencies.enqueue(action, id)) queued++;
        else duplicates++;
      };
      for (const event of events.comments) {
        if (event.instagramAccountId !== entry.id) {
          rejected++;
          continue;
        }
        await enqueue(
          { name: "process-comment", data: { ...event, source: "WEBHOOK" } },
          `comment_${event.instagramAccountId}_${event.commentId}`
        );
      }
      for (const event of events.postbacks) {
        const automationId = getPostbackCampaignId(event.payload);
        if (
          event.instagramAccountId !== entry.id ||
          !automationId ||
          !(await dependencies.isActiveCampaign(automationId, account.id))
        ) {
          rejected++;
          continue;
        }
        await enqueue(
          { name: "process-postback", data: { ...event } },
          postbackJobId(event, entry)
        );
      }
      for (const event of events.messages) {
        if (event.instagramAccountId !== entry.id) {
          rejected++;
          continue;
        }
        await enqueue(
          { name: "process-message", data: { ...event } },
          `message_${event.instagramAccountId}_${Buffer.from(event.messageId).toString("base64url")}`
        );
      }
      // A read receipt is not evidence that the user opened a messaging window.
      // Never turn it into a delayed reveal. Only a real postback/message queues
      // a response; existing delayed legacy jobs must be reviewed separately.
      await dependencies.recordOutcome({
        workspaceId: account.workspaceId,
        webhookEventId: eventId,
        outcome: rejected ? "INGESTED_WITH_REJECTIONS" : "INGESTED",
        level: rejected ? "WARNING" : "INFO",
        queued,
        duplicates,
        rejected,
        readsIgnored: events.readCount,
      });
      await dependencies.finishEvent(eventId, "PROCESSED");
    } catch {
      failed = true;
      // Do not persist raw exception text here: connection errors can contain
      // credentials. The worker records attributable API delivery errors later.
      if (eventId) {
        await dependencies
          .finishEvent(
            eventId,
            "FAILED",
            "Webhook ingestion failed; retry required"
          )
          .catch(() => {});
      }
    }
  }
  return { failed, entries: value.entry.length };
}
