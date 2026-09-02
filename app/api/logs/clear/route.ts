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

  // Ensure user is authorized for this workspace
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true },
  });

  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId },
  });

  if (workspace?.ownerId !== userId && !member) {
    return NextResponse.json({ success: false, error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  let otp = "";
  let confirm = false;
  try {
    const body = await request.json();
    otp = String(body.otp ?? "").trim();
    confirm = Boolean(body.confirm);
  } catch {
    // defaults
  }

  if (otp && user?.email) {
    const verification = await verifyOtp(user.email, "clear-dm-logs", otp);
    if (!verification.valid) {
      return NextResponse.json(
        { success: false, error: verification.error || "Invalid verification code" },
        { status: 400 }
      );
    }
  } else if (!confirm) {
    return NextResponse.json(
      { success: false, error: "Confirmation is required to clear logs" },
      { status: 400 }
    );
  }

  const result = await prisma.dmLog.deleteMany({
    where: { workspaceId },
  });

  return NextResponse.json({
    success: true,
    deletedCount: result.count,
  });
}
