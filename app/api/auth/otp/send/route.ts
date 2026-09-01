import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { generateAndSendOtp } from "@/lib/email/otp";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user?.email) {
    return NextResponse.json(
      { success: false, error: "No email address found for your account" },
      { status: 400 }
    );
  }

  let purpose = "clear-history";
  let purposeLabel = "clear history";
  try {
    const body = await request.json();
    if (body.purpose) purpose = String(body.purpose);
    if (body.purposeLabel) purposeLabel = String(body.purposeLabel);
  } catch {
    // defaults
  }

  const result = await generateAndSendOtp(user.email, purpose, purposeLabel);

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error || "Failed to send verification code" },
      { status: 500 }
    );
  }

  // Mask email for display (e.g. j***@example.com)
  const [local, domain] = user.email.split("@");
  const maskedLocal = local.length > 2 ? `${local[0]}***${local[local.length - 1]}` : `${local[0]}***`;
  const maskedEmail = `${maskedLocal}@${domain}`;

  return NextResponse.json({
    success: true,
    maskedEmail,
  });
}
