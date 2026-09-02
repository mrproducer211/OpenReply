import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, getCurrentWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { verifyOtp } from "@/lib/email/otp";
import { clearWorkerAlerts } from "@/lib/ops/worker-health";
import { getDMQueue } from "@/lib/queue/client";

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

  // If OTP is provided, verify it
  if (otp && user?.email) {
    const verification = await verifyOtp(user.email, "clear-diagnostics", otp);
    if (!verification.valid) {
      return NextResponse.json(
        { success: false, error: verification.error || "Invalid verification code" },
        { status: 400 }
      );
    }
  } else if (!confirm) {
    return NextResponse.json(
      { success: false, error: "Confirmation is required to clear diagnostics" },
      { status: 400 }
    );
  }

  // Clear workspace events, webhook events, worker alerts, failed DM logs, and queue failures
  const [ops, webhooks, dmFailures] = await Promise.all([
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
    prisma.dmLog.deleteMany({
      where: {
        workspaceId,
        status: {
          in: [
            "FAILED",
            "SKIPPED_RATE_LIMIT",
            "SKIPPED_PLAN_LIMIT",
            "SKIPPED_NO_MATCH",
          ],
        },
      },
    }),
    clearWorkerAlerts().catch(() => {}),
    getDMQueue().clean(0, 0, "failed").catch(() => []),
  ]);

  return NextResponse.json({
    success: true,
    deletedOps: ops.count,
    deletedWebhooks: webhooks.count,
    deletedDmFailures: dmFailures.count,
  });
}
