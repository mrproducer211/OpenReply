import { randomInt } from "crypto";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/db/client";

export function getFromEmail(): string {
  let envFrom = process.env.EMAIL_FROM?.trim();
  if (envFrom) {
    // Strip surrounding quotes if entered with quotes in .env / Vercel
    envFrom = envFrom.replace(/^[\"\']+|[\"\']+$/g, "").trim();

    // Check if it\'s already "Name <email@domain>"
    const match = envFrom.match(/^(?:([^<]+)\\s+)?<([^>]+)>$/);
    if (match) {
      const name = match[1]?.trim();
      const email = match[2]?.trim();
      if (email && email.includes("@") && !email.includes("example.com")) {
        return name ? `${name} <${email}>` : email;
      }
    }

    // If it\'s a plain email address "email@domain"
    if (envFrom.includes("@") && !envFrom.includes("example.com") && !envFrom.includes("<")) {
      return `OpenReply <${envFrom}>`;
    }
  }

  // Resend default onboarding verified domain
  return "onboarding@resend.dev";
}

export async function sendOtpEmail(to: string, otp: string, purposeLabel: string): Promise<void> {
  const emailFrom = getFromEmail();
  const smtpServer = process.env.EMAIL_SERVER;
  const resendApiKey = process.env.RESEND_API_KEY;
  const subject = `Your OpenReply verification code: ${otp}`;
  const textContent = `Your verification code to ${purposeLabel} is:\\n\\n${otp}\\n\\nThis code will expire in 10 minutes. If you did not request this, please ignore this email.`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px; background-color: #ffffff;">
      <h2 style="font-size: 20px; font-weight: 600; color: #111827; margin-bottom: 12px;">Security Verification</h2>
      <p style="font-size: 14px; color: #4b5563; line-height: 1.5; margin-bottom: 24px;">
        Use the following one-time code to <strong>${purposeLabel}</strong>:
      </p>
      <div style="background-color: #f3f4f6; border-radius: 6px; padding: 16px; text-align: center; margin-bottom: 24px;">
        <span style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #111827;">${otp}</span>
      </div>
      <p style="font-size: 12px; color: #6b7280; line-height: 1.4;">
        This code expires in 10 minutes. If you did not make this request, no action is needed.
      </p>
    </div>
  `;

  if (smtpServer) {
    const transporter = nodemailer.createTransport(smtpServer);
    await transporter.sendMail({
      from: emailFrom,
      to,
      subject,
      text: textContent,
      html: htmlContent,
    });
    return;
  }

  if (resendApiKey) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: emailFrom,
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
      throw new Error(parsedMessage || response.statusText);
    }
    return;
  }

  console.warn("[OTP] No email provider configured (RESEND_API_KEY or EMAIL_SERVER missing). OTP code is:", otp);
}

export async function generateAndSendOtp(
  email: string,
  purpose: string,
  purposeLabel: string = "clear history"
): Promise<{ success: boolean; error?: string }> {
  try {
    const identifier = `otp:${email.toLowerCase().trim()}:${purpose}`;
    const otp = randomInt(100000, 999999).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Remove any previous active OTP for this identifier
    await prisma.verificationToken.deleteMany({
      where: { identifier },
    });

    // Save new OTP
    await prisma.verificationToken.create({
      data: {
        identifier,
        token: otp,
        expires,
      },
    });

    // Send email
    await sendOtpEmail(email, otp, purposeLabel);

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send verification code";
    return { success: false, error: message };
  }
}

export async function verifyOtp(
  email: string,
  purpose: string,
  inputOtp: string
): Promise<{ valid: boolean; error?: string }> {
  const identifier = `otp:${email.toLowerCase().trim()}:${purpose}`;
  const cleanOtp = inputOtp.trim();

  const record = await prisma.verificationToken.findFirst({
    where: {
      identifier,
      token: cleanOtp,
    },
  });

  if (!record) {
    return { valid: false, error: "Invalid or incorrect verification code" };
  }

  if (new Date() > record.expires) {
    await prisma.verificationToken.deleteMany({ where: { identifier } });
    return { valid: false, error: "Verification code has expired. Please request a new one." };
  }

  // Code is valid: delete so it cannot be used again
  await prisma.verificationToken.deleteMany({ where: { identifier } });

  return { valid: true };
}
