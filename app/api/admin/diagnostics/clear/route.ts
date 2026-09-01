import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, getCurrentWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { verifyOtp } from "@/lib/email/otp";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  const workspaceId = await getCurrentWorkspaceId();

  if (!userId || !workspaceId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user?.email) {
    return NextResponse.json({ success: false, error: "User email not found" }, { status: 400 });
  }

  let otp = "";
  try {
    const body = await request.json();
    otp = String(body.otp ?? "").trim();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }

  if (!otp) {
    return NextResponse.json({ success: false, error: "Verification code is required" }, { status: 400 });
  }

  const verification = await verifyOtp(user.email, "clear-diagnostics", otp);
  if (!verification.valid) {
    return NextResponse.json(
      { success: false, error: verification.error || "Invalid verification code" },
      { status: 400 }
    );
  }

  // Clear workspace events and webhook events
  const [ops, webhooks] = await Promise.all([
    prisma.operationalEvent.deleteMany({
      where: {
        OR: [{ workspaceId }, { workspaceId: null }],
      },
    }),
    prisma.webhookEvent.deleteMany({
      where: {
        OR: [{ workspaceId }, { workspaceId: null }],
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    deletedOps: ops.count,
    deletedWebhooks: webhooks.count,
  });
}
