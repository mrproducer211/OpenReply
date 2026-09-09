/**
 * Ground-truth checks for the two Meta-side configurations that decide whether
 * the comment → opening DM → button-tap → link pipeline can work at all:
 *
 * 1. Token scopes — what the stored access token is actually allowed to do
 *    (via /debug_token). A token issued while a consent-screen permission was
 *    toggled off silently lacks that scope, and DM sends fail later with
 *    Meta's "check IG permissions granular scopes" error (code 200, sub
 *    2534066) instead of at connect time.
 * 2. Account-level webhook fields — what Meta actually pushes for the
 *    connected account (via /{ig-user-id}/subscribed_apps). The app-level
 *    dashboard subscription is necessary but not sufficient: each account
 *    opts in when it connects, and a field added to the code later never
 *    retroactively applies to already-connected accounts.
 */

export const EXPECTED_TOKEN_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
  "instagram_business_manage_comments",
  "instagram_business_manage_insights",
] as const;

export const EXPECTED_WEBHOOK_FIELDS = [
  "comments",
  "messages",
  "messaging_postbacks",
  "messaging_seen",
] as const;

/** Meta returns subscribed_fields as an array on newer versions, a comma-joined string on older ones. */
export function normalizeSubscribedFields(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

export function computeMissing(
  expected: readonly string[],
  actual: readonly string[]
): string[] {
  const present = new Set(actual);
  return expected.filter((item) => !present.has(item));
}

/** debug_token reports granular scopes under granular_scopes; classic scopes under scopes. Merge both. */
export function extractScopesFromDebugToken(data: unknown): string[] {
  if (typeof data !== "object" || data === null) return [];
  const record = data as { scopes?: unknown; granular_scopes?: unknown };

  const scopes = Array.isArray(record.scopes)
    ? record.scopes.filter((scope): scope is string => typeof scope === "string")
    : [];

  const granular = Array.isArray(record.granular_scopes)
    ? record.granular_scopes
        .map((entry) =>
          typeof entry === "object" && entry !== null
            ? (entry as { scope?: unknown }).scope
            : undefined
        )
        .filter((scope): scope is string => typeof scope === "string")
    : [];

  return [...new Set([...scopes, ...granular])];
}

export type RepairOutcome = "applied" | "failed" | null;

export function buildRecommendations(input: {
  tokenDecryptOk: boolean;
  tokenValid: boolean | null;
  missingScopes: readonly string[];
  subscriptionReadOk: boolean;
  subscriptionError?: string | null;
  missingFields: readonly string[];
  repairOutcome: RepairOutcome;
}): string[] {
  const recommendations: string[] = [];

  if (!input.tokenDecryptOk) {
    recommendations.push(
      "The stored token cannot be decrypted (the ENCRYPTION_KEY likely changed after connecting). Reconnect the Instagram account in Settings to store a fresh one."
    );
    return recommendations;
  }

  if (input.tokenValid === false) {
    recommendations.push(
      "Meta reports the stored token is invalid or expired. Reconnect the Instagram account in Settings."
    );
    return recommendations;
  }

  if (input.missingScopes.length > 0) {
    const scopeList = input.missingScopes.join(", ");
    if (input.missingScopes.includes("instagram_business_manage_messages")) {
      recommendations.push(
        `The token is missing these scopes: ${scopeList}. Without instagram_business_manage_messages, every DM send fails with Meta's "granular scopes" error (code 200, subcode 2534066). Reconnect via Settings → Connect Instagram and leave EVERY permission toggle ON in the consent screen — the messaging one is easy to miss.`
      );
    } else {
      recommendations.push(
        `The token is missing these scopes: ${scopeList}. Reconnect via Settings → Connect Instagram and leave every permission toggle ON in the consent screen.`
      );
    }
  }

  if (!input.subscriptionReadOk) {
    recommendations.push(
      `Could not read the account-level webhook subscription from Meta${input.subscriptionError ? `: ${input.subscriptionError}` : "."} Fix any token problems above first, then re-run this check.`
    );
  } else if (input.missingFields.length > 0) {
    const fieldList = input.missingFields.join(", ");
    if (input.repairOutcome === "failed") {
      recommendations.push(
        `The account-level webhook subscription is still missing ${fieldList} because the repair attempt failed. Fix any token scope problems above first, then open this URL with ?repair=true again.`
      );
    } else {
      recommendations.push(
        `The account-level webhook subscription is missing: ${fieldList}. Without messaging_postbacks, button taps never reach this app. Open this same URL with ?repair=true to re-subscribe the account.`
      );
    }
  } else if (input.repairOutcome === "applied") {
    recommendations.push(
      "The account-level webhook subscription was repaired just now — every expected field is subscribed. Run the button-tap test again."
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "No gaps detected: the token has every expected scope and the account is subscribed to every expected webhook field. If a button tap still does nothing, check that 'Allow access to messages' is ON in the Instagram app (Settings → Messages) for this account."
    );
  }

  return recommendations;
}
