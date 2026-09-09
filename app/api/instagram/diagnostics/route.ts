import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import {
  canManageWorkspace,
  getCurrentWorkspaceContext,
} from "@/lib/workspace-access";
import { decryptToken } from "@/lib/meta/oauth";
import {
  debugToken,
  subscribeInstagramAccountToWebhooks,
} from "@/lib/meta/client";
import { getMetaGraphApiVersion } from "@/lib/env";
import {
  EXPECTED_TOKEN_SCOPES,
  EXPECTED_WEBHOOK_FIELDS,
  buildRecommendations,
  computeMissing,
  extractScopesFromDebugToken,
  normalizeSubscribedFields,
  type RepairOutcome,
} from "@/lib/meta/subscription-health";

/**
 * Diagnostics for the Instagram connection that answer the two questions that
 * matter when DMs stop flowing:
 *
 *   GET /api/instagram/diagnostics             → report only
 *   GET /api/instagram/diagnostics?repair=true → also re-runs the account-level
 *                                                webhook subscription and
 *                                                reports the before/after state
 *
 * Never returns token material — only scope names, field names, and dates.
 */

type DiagnosableAccount = {
  id: string;
  instagramId: string;
  username: string;
  accessToken: string;
  tokenExpiresAt: Date | null;
  webhookSubscribed: boolean;
};

function appAccessTokens(): string[] {
  const appId = process.env.INSTAGRAM_APP_ID;
  if (!appId) return [];
  const secrets = [
    process.env.INSTAGRAM_APP_SECRET,
    process.env.FACEBOOK_APP_SECRET,
  ].filter((value): value is string => Boolean(value));
  return [...new Set(secrets)].map((secret) => `${appId}|${secret}`);
}

/** Ask Meta which scopes the stored user token actually carries. */
async function inspectTokenScopes(accessToken: string) {
  const appTokens = appAccessTokens();
  if (appTokens.length === 0) {
    return {
      ok: false as const,
      error: "INSTAGRAM_APP_ID/app secrets are not configured",
    };
  }

  let lastError = "Unknown error";
  for (const appToken of appTokens) {
    try {
      const result = (await debugToken(accessToken, appToken)) as {
        data?: {
          is_valid?: boolean;
          expires_at?: number;
          scopes?: unknown;
          granular_scopes?: unknown;
        };
      };
      const data = result?.data ?? {};
      return {
        ok: true as const,
        isValid: typeof data.is_valid === "boolean" ? data.is_valid : null,
        scopes: extractScopesFromDebugToken(data),
        expiresAt:
          typeof data.expires_at === "number" && data.expires_at > 0
            ? new Date(data.expires_at * 1000).toISOString()
            : null,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown error";
    }
  }
  return { ok: false as const, error: lastError };
}

/** The account-level webhook subscription as Meta currently has it on record. */
async function readActualSubscribedFields(
  instagramId: string,
  accessToken: string
): Promise<string[]> {
  const base =
    "https://graph.instagram.com/" + getMetaGraphApiVersion() + "/";
  const url = new URL(base + instagramId + "/subscribed_apps");
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.error) {
    throw new Error(data?.error?.message ?? `HTTP ${response.status}`);
  }

  const entries: unknown[] = Array.isArray(data?.data) ? data.data : [];
  const appId = process.env.INSTAGRAM_APP_ID;
  const entry =
    entries.find(
      (candidate) =>
        typeof candidate === "object" &&
        candidate !== null &&
        String((candidate as { id?: unknown }).id) === appId
    ) ?? entries[0];

  return normalizeSubscribedFields(
    (entry as { subscribed_fields?: unknown } | undefined)?.subscribed_fields
  );
}

async function diagnoseAccount(
  account: DiagnosableAccount,
  workspaceId: string,
  repair: boolean
) {
  const result: Record<string, unknown> = {
    username: account.username,
    instagramId: account.instagramId,
    webhookSubscribedFlagInDb: account.webhookSubscribed,
    tokenExpiresAt: account.tokenExpiresAt?.toISOString() ?? null,
  };

  let accessToken: string | null = null;
  try {
    accessToken = decryptToken(account.accessToken);
    result.tokenDecryptOk = true;
  } catch (error) {
    result.tokenDecryptOk = false;
    result.tokenDecryptError =
      error instanceof Error ? error.message : "Unknown error";
  }

  let tokenValid: boolean | null = null;
  let missingScopes: string[] = [];
  let missingFields: string[] = [];
  let subscriptionReadOk = false;
  let subscriptionError: string | null = null;
  let repairOutcome: RepairOutcome = null;

  if (accessToken) {
    const tokenInfo = await inspectTokenScopes(accessToken);
    if (tokenInfo.ok) {
      tokenValid = tokenInfo.isValid;
      missingScopes =
        tokenInfo.isValid === false
          ? []
          : computeMissing(EXPECTED_TOKEN_SCOPES, tokenInfo.scopes);
      result.token = {
        isValid: tokenInfo.isValid,
        scopes: tokenInfo.scopes,
        missingScopes,
        expiresAt: tokenInfo.expiresAt,
      };
    } else {
      result.token = { error: tokenInfo.error };
    }

    try {
      const fields = await readActualSubscribedFields(
        account.instagramId,
        accessToken
      );
      subscriptionReadOk = true;
      missingFields = computeMissing(EXPECTED_WEBHOOK_FIELDS, fields);
      result.subscription = { subscribedFields: fields, missingFields };
    } catch (error) {
      subscriptionError =
        error instanceof Error ? error.message : "Unknown error";
      result.subscription = { error: subscriptionError };
    }

    if (repair) {
      try {
        await subscribeInstagramAccountToWebhooks(
          account.instagramId,
          accessToken
        );
        const after = await readActualSubscribedFields(
          account.instagramId,
          accessToken
        );
        const stillMissing = computeMissing(EXPECTED_WEBHOOK_FIELDS, after);
        repairOutcome = stillMissing.length === 0 ? "applied" : "failed";
        missingFields = stillMissing;
        result.subscription = {
          subscribedFields: after,
          missingFields: stillMissing,
          repaired: true,
        };
        await prisma.instagramAccount.update({
          where: { id: account.id },
          data: { webhookSubscribed: stillMissing.length === 0 },
        });
        await prisma.operationalEvent
          .create({
            data: {
              workspaceId,
              source: "SYSTEM",
              level: stillMissing.length === 0 ? "INFO" : "WARNING",
              message:
                stillMissing.length === 0
                  ? `Webhook resubscription for @${account.username}: all expected fields are now subscribed`
                  : `Webhook resubscription for @${account.username}: still missing ${stillMissing.join(", ")}`,
              payload: {
                instagramId: account.instagramId,
                after,
                stillMissing,
              },
            },
          })
          .catch(() => {});
      } catch (error) {
        repairOutcome = "failed";
        const repairError =
          error instanceof Error ? error.message : "Unknown error";
        result.repair = { attempted: true, ok: false, error: repairError };
        await prisma.operationalEvent
          .create({
            data: {
              workspaceId,
              source: "SYSTEM",
              level: "ERROR",
              message: `Webhook resubscription failed for @${account.username}: ${repairError}`,
              payload: { instagramId: account.instagramId },
            },
          })
          .catch(() => {});
      }
    }
  }

  result.recommendations = buildRecommendations({
    tokenDecryptOk: result.tokenDecryptOk === true,
    tokenValid,
    missingScopes,
    subscriptionReadOk,
    subscriptionError,
    missingFields,
    repairOutcome,
  });

  return result;
}

export async function GET(request: NextRequest) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }
  if (!canManageWorkspace(context.role)) {
    return NextResponse.json(
      {
        success: false,
        error: "Only owners and admins can run Instagram diagnostics",
      },
      { status: 403 }
    );
  }

  const repair = request.nextUrl.searchParams.get("repair") === "true";

  const accounts = await prisma.instagramAccount.findMany({
    where: { workspaceId: context.workspaceId },
    orderBy: { connectedAt: "desc" },
    select: {
      id: true,
      instagramId: true,
      username: true,
      accessToken: true,
      tokenExpiresAt: true,
      webhookSubscribed: true,
    },
  });

  const results: Array<Record<string, unknown>> = [];
  for (const account of accounts) {
    results.push(await diagnoseAccount(account, context.workspaceId, repair));
  }

  return NextResponse.json({
    success: true,
    data: {
      checkedAt: new Date().toISOString(),
      repairMode: repair,
      expectedTokenScopes: EXPECTED_TOKEN_SCOPES,
      expectedWebhookFields: EXPECTED_WEBHOOK_FIELDS,
      accounts: results,
    },
  });
}
