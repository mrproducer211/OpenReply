import { describe, expect, it } from "vitest";
import { maskEmail, maskEmailsInText } from "../lib/mask-email";

describe("maskEmail", () => {
  it("masks standard emails correctly", () => {
    expect(maskEmail("yilmazayse01234@gmail.com")).toBe("y***4@gmail.com");
    expect(maskEmail("alex@company.com")).toBe("a***x@company.com");
    expect(maskEmail("john.doe@example.org")).toBe("j***e@example.org");
  });

  it("handles short usernames correctly", () => {
    expect(maskEmail("me@domain.com")).toBe("m***@domain.com");
    expect(maskEmail("a@domain.com")).toBe("a***@domain.com");
  });

  it("handles empty or invalid inputs gracefully", () => {
    expect(maskEmail("")).toBe("");
    expect(maskEmail(null)).toBe("");
    expect(maskEmail(undefined)).toBe("");
    expect(maskEmail("not-an-email")).toBe("not-an-email");
  });
});

describe("maskEmailsInText", () => {
  it("masks all emails embedded within a message string", () => {
    const message = "You can only send testing emails to your own email address (yilmazayse01234@gmail.com).";
    expect(maskEmailsInText(message)).toBe(
      "You can only send testing emails to your own email address (y***4@gmail.com)."
    );
  });

  it("handles multiple emails in a string", () => {
    const text = "From alice@example.com to bob@test.org";
    expect(maskEmailsInText(text)).toBe("From a***e@example.com to b***b@test.org");
  });
});
