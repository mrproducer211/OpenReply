import { randomInt } from "crypto";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/db/client";
import { getFromEmail } from "@/lib/email/otp";

/**
 * Custom verification sender that embeds both the 1-click magic link AND
 * a 6-digit one-time passcode (OTP). Gracefully handles local dev / unconfigured mail.
 */
export async function sendAuthVerificationRequest(params: {
  identifier: string;
  url: string;
  provider: { from?: string; apiKey?: string; server?: unknown };
}) {
  const { identifier: to, url } = params;
  const from = getFromEmail();
  const server = process.env.EMAIL_SERVER;
  const resendApiKey = process.env.RESEND_API_KEY;

  // Generate 6-digit OTP code in addition to the magic link
  const otp = randomInt(100000, 999999).toString();
  const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  const otpIdentifier = `otp:${to.toLowerCase().trim()}:login`;

  try {
    await prisma.verificationToken.deleteMany({ where: { identifier: otpIdentifier } });
    await prisma.verificationToken.create({
      data: {
        identifier: otpIdentifier,
        token: otp,
        expires,
      },
    });
  } catch (err) {
    console.error("[AUTH] Error storing OTP verification token:", err);
  }

  const subject = `Sign in to OpenReply (${otp})`;
  const textContent = `Sign in to OpenReply\n\nClick the link below to sign in:\n${url}\n\nOr enter this 6-digit verification code:\n${otp}\n\nThis link and code will expire in 15 minutes. If you did not request this email, you can safely ignore it.`;
  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff; color: #111827;">
      <h1 style="font-size: 22px; font-weight: 700; margin-bottom: 16px; color: #111827; text-align: center;">Sign in to OpenReply</h1>
      <p style="font-size: 15px; line-height: 1.6; color: #4b5563; margin-bottom: 24px; text-align: center;">
        Click the button below to sign in directly to your account:
      </p>
      <div style="text-align: center; margin-bottom: 28px;">
        <a href="${url}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">
          Sign In to OpenReply
        </a>
      </div>
      <div style="border-top: 1px solid #e5e7eb; padding-top: 24px; margin-top: 24px; text-align: center;">
        <p style="font-size: 13px; color: #6b7280; margin-bottom: 12px;">
          Or enter this 6-digit one-time code on the login screen:
        </p>
        <div style="background-color: #f3f4f6; border-radius: 8px; padding: 12px; display: inline-block; min-width: 180px;">
          <span style="font-size: 28px; font-weight: 700; letter-spacing: 6px; color: #111827; font-family: monospace;">${otp}</span>
        </div>
      </div>
      <p style="font-size: 12px; color: #9ca3af; line-height: 1.5; margin-top: 32px; text-align: center;">
        This sign-in link and code will expire in 15 minutes.<br/>
        If you did not request this email, no further action is required.
      </p>
    </div>
  `;

  if (server) {
    const transporter = nodemailer.createTransport(server);
    await transporter.sendMail({
      from,
      to,
      subject,
      text: textContent,
      html: htmlContent,
    });
    return;
  }

  if (resendApiKey && resendApiKey !== "missing-resend-api-key") {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        text: textContent,
        html: htmlContent,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text().catch(() => "");
      let parsedMessage = errorData;
      try {
        const json = JSON.parse(errorData);
        if (json.message) parsedMessage = json.message;
      } catch {}
      console.error("[AUTH] Resend API error:", parsedMessage);
      throw new Error(`Resend error: ${parsedMessage || response.statusText}`);
    }
    return;
  }

  // Development / fallback: log URL and OTP to console
  console.log("=================================================");
  console.log(`[AUTH] Sign-In Magic Link for ${to}:`);
  console.log(url);
  console.log(`[AUTH] One-Time 6-digit Code: ${otp}`);
  console.log("=================================================");
}
