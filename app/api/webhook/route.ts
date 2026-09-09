import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getDMQueue } from "@/lib/queue/client";
import {
  parseCommentEvents,
  parseMessageEvents,
  parsePostbackEvents,
  parseReadEvents,
  verifyWebhookSignature,
} from "@/lib/meta/webhook";
import {
  ingestWebhook,
  isWebhookPayload,
} from "@/lib/meta/webhook-ingestion";
import type { Prisma } from "@/app/generated/prisma/client";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token")?.trim();
  const challenge = searchParams.get("hub.challenge");

  // Health check / link crawler probe without webhook challenge params
  if (!mode && !token && !challenge) {
    return NextResponse.json(
      { status: "ok", message: "Instagram Webhook endpoint active" },
      { status: 200 }
    );
  }

  const expectedToken = process.env.WEBHOOK_VERIFY_TOKEN?.trim().replace(/^["']+|["']+$/g, "");
  if (
    mode === "subscribe" &&
    token &&
    expectedToken &&
    token === expectedToken
  ) {
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn(
    `[Webhook] Verification failed. Mode: ${mode}, Token match: ${token === expectedToken}`
  );
  return NextResponse.json(
    { success: false, error: "Verification failed" },
    { status: 403 }
  );
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  let signatureValid: boolean;
  try {
    signatureValid = verifyWebhookSignature(rawBody, signature);
  } catch {
    await prisma.operationalEvent
      .create({
        data: {
          source: "SYSTEM",
          level: "ERROR",
          message: "Webhook signing configuration unavailable",
        },
      })
      .catch(() => {});
    return NextResponse.json(
      { success: false, error: "Webhook verification unavailable" },
      { status: 503 }
    );
  }

  if (!signatureValid) {
    await prisma.operationalEvent
      .create({
        data: {
          source: "SYSTEM",
          level: "WARNING",
          message: "Webhook signature verification failed",
          // Never put an unverified body into global operational diagnostics.
          payload: {
            hadSignatureHeader: Boolean(signature),
            bodyLength: rawBody.length,
          },
        },
      })
      .catch(() => {});
    return NextResponse.json(
      { success: false, error: "Invalid signature" },
      { status: 401 }
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  if (!isWebhookPayload(payload)) {
    return NextResponse.json(
      { success: false, error: "Invalid webhook envelope" },
      { status: 400 }
    );
  }

  const result = await ingestWebhook(payload, {
    parse: (entryPayload) => {
      const parsed =
        entryPayload as unknown as Parameters<typeof parseCommentEvents>[0];
      return {
        comments: parseCommentEvents(parsed),
        messages: parseMessageEvents(parsed),
        postbacks: parsePostbackEvents(parsed),
        readCount: parseReadEvents(parsed).length,
      };
    },
    getAccount: (instagramId) =>
      prisma.instagramAccount.findUnique({
        where: { instagramId },
        select: { id: true, workspaceId: true },
      }),
    isActiveCampaign: async (automationId, accountId) =>
      Boolean(
        await prisma.automation.findFirst({
          where: {
            id: automationId,
            instagramAccountId: accountId,
            isActive: true,
          },
          select: { id: true },
        })
      ),
    createEvent: async (entryPayload, workspaceId) => {
      const event = await prisma.webhookEvent.create({
        data: {
          object: entryPayload.object,
          payload: entryPayload as Prisma.InputJsonValue,
          workspaceId,
          status: "PENDING",
        },
      });
      return event.id;
    },
    finishEvent: async (id, status, errorMessage) => {
      await prisma.webhookEvent.update({
        where: { id },
        data: {
          status,
          errorMessage: errorMessage ?? null,
          processedAt: new Date(),
        },
      });
    },
    enqueue: async (action, jobId) => {
      const queue = getDMQueue();
      // BullMQ Jobs have no .status property. Retained jobs of any state are
      // duplicates; failed sends require the worker's retry policy or a
      // deliberate operator retry, not replaying the same webhook blindly.
      if (await queue.getJob(jobId)) return false;
      await queue.add(action.name, action.data, { jobId });
      return true;
    },
    recordOutcome: async (outcome) => {
      await prisma.operationalEvent.create({
        data: {
          workspaceId: outcome.workspaceId,
          source: "SYSTEM",
          level: outcome.level,
          message: `Webhook ${outcome.outcome}: queued=${outcome.queued}, duplicates=${outcome.duplicates}, rejected=${outcome.rejected}, readsIgnored=${outcome.readsIgnored}`,
          payload: { ...outcome },
        },
      });
    },
  });

  return NextResponse.json(
    result.failed
      ? { success: false, error: "Webhook processing failed" }
      : { success: true },
    { status: result.failed ? 500 : 200 }
  );
}
