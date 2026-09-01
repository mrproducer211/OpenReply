import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateAndSendOtp, verifyOtp } from "@/lib/email/otp";
import { prisma } from "@/lib/db/client";

vi.mock("@/lib/db/client", () => ({
  prisma: {
    verificationToken: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn().mockResolvedValue({}),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn().mockReturnValue({
      sendMail: vi.fn().mockResolvedValue({ messageId: "123" }),
    }),
  },
}));

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ id: "123" }),
  text: async () => JSON.stringify({ id: "123" }),
}) as unknown as typeof fetch;

describe("OTP Verification Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "re_test_key";
  });

  it("should generate and store OTP code", async () => {
    const result = await generateAndSendOtp("test@example.com", "clear-dm-logs", "clear DM logs");
    expect(result.success).toBe(true);
    expect(prisma.verificationToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          identifier: "otp:test@example.com:clear-dm-logs",
          token: expect.stringMatching(/^\d{6}$/),
        }),
      })
    );
  });

  it("should verify valid OTP successfully and delete token", async () => {
    vi.mocked(prisma.verificationToken.findFirst).mockResolvedValue({
      identifier: "otp:test@example.com:clear-dm-logs",
      token: "123456",
      expires: new Date(Date.now() + 60000),
    });

    const result = await verifyOtp("test@example.com", "clear-dm-logs", "123456");
    expect(result.valid).toBe(true);
    expect(prisma.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { identifier: "otp:test@example.com:clear-dm-logs" },
    });
  });

  it("should reject invalid OTP", async () => {
    vi.mocked(prisma.verificationToken.findFirst).mockResolvedValue(null);

    const result = await verifyOtp("test@example.com", "clear-dm-logs", "999999");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid");
  });

  it("should reject expired OTP", async () => {
    vi.mocked(prisma.verificationToken.findFirst).mockResolvedValue({
      identifier: "otp:test@example.com:clear-dm-logs",
      token: "123456",
      expires: new Date(Date.now() - 60000), // expired 1 min ago
    });

    const result = await verifyOtp("test@example.com", "clear-dm-logs", "123456");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("expired");
  });
});
