/**
 * Universal email masking utility to protect user privacy in the UI.
 * e.g. "yilmazayse01234@gmail.com" -> "y***4@gmail.com"
 * e.g. "alex@company.com" -> "a***x@company.com"
 * e.g. "me@domain.com" -> "m***@domain.com"
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email || typeof email !== "string") return "";
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf("@");
  if (atIndex <= 0) return trimmed;

  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);

  if (!domain) return trimmed;

  let maskedLocal: string;
  if (local.length <= 2) {
    maskedLocal = `${local[0]}***`;
  } else {
    maskedLocal = `${local[0]}***${local[local.length - 1]}`;
  }

  return `${maskedLocal}@${domain}`;
}

/**
 * Replaces any embedded email addresses within arbitrary text strings with their masked form.
 */
export function maskEmailsInText(text: string | null | undefined): string {
  if (!text || typeof text !== "string") return "";
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  return text.replace(emailRegex, (match) => maskEmail(match));
}
