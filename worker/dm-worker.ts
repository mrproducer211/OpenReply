import { createDMWorker } from "@/lib/queue/dm-worker";
import { recordWorkerHeartbeat } from "@/lib/ops/worker-health";
import { reconcileComments } from "@/lib/polling/comment-reconciler";
import os from "node:os";

const worker = createDMWorker();
const startedAt = new Date().toISOString();
console.log("[DM Worker] Started");

async function heartbeat() {
  try {
    await recordWorkerHeartbeat({
      pid: process.pid,
      hostname: os.hostname(),
      startedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[DM Worker] Heartbeat failed:", message);
  }
}

void heartbeat();
const heartbeatTimer = setInterval(() => void heartbeat(), HEARTBEAT_INTERVAL_MS);

// Webhooks deliver comment events immediately in real-time via /api/webhook.
// Background scanning of historical comments is disabled to prevent re-processing.
const ENABLE_COMMENT_POLLING = process.env.ENABLE_COMMENT_POLLING === "true";

let pollTimer: NodeJS.Timeout | null = null;
if (ENABLE_COMMENT_POLLING) {
  const POLL_INTERVAL_MS = Number(process.env.COMMENT_POLL_INTERVAL_MS ?? 5 * 60_000);
  pollTimer = setInterval(async () => {
    try {
      await reconcileComments();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[DM Worker] Comment reconciliation failed:", message);
    }
  }, POLL_INTERVAL_MS);
}

async function shutdown(signal: string) {
  console.log(`[DM Worker] ${signal} received, closing worker`);
  clearInterval(heartbeatTimer);
  if (pollTimer) clearInterval(pollTimer);
  await worker.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
