import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateDMWorker, mockRecordHeartbeat, mockReconcileComments } =
  vi.hoisted(() => ({
    mockCreateDMWorker: vi.fn(() => ({ close: vi.fn() })),
    mockRecordHeartbeat: vi.fn(async () => {}),
    mockReconcileComments: vi.fn(async () => {}),
  }));

vi.mock("@/lib/queue/dm-worker", () => ({
  createDMWorker: mockCreateDMWorker,
}));
vi.mock("@/lib/ops/worker-health", () => ({
  recordWorkerHeartbeat: mockRecordHeartbeat,
}));
vi.mock("@/lib/polling/comment-reconciler", () => ({
  reconcileComments: mockReconcileComments,
}));

describe("worker entry point", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.stubEnv("ENABLE_COMMENT_POLLING", "false");
    vi.stubEnv("COMMENT_POLL_INTERVAL_MS", "300000");
    // Do not leave real process signal handlers installed by the import.
    vi.spyOn(process, "on").mockReturnValue(process);
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("boots and records a heartbeat immediately and every 30 seconds", async () => {
    // Import the actual entry point, not just the queue processor. This catches
    // missing startup constants even when the DM processor tests still pass.
    await import("../worker/dm-worker");

    expect(mockCreateDMWorker).toHaveBeenCalledTimes(1);
    expect(mockRecordHeartbeat).toHaveBeenCalledTimes(1);
    expect(mockRecordHeartbeat).toHaveBeenCalledWith(
      expect.objectContaining({
        pid: process.pid,
        hostname: expect.any(String),
        startedAt: expect.any(String),
      })
    );
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(mockRecordHeartbeat).toHaveBeenCalledTimes(2);
    expect(mockReconcileComments).not.toHaveBeenCalled();
  });

  it("keeps historical polling opt-in without breaking the heartbeat", async () => {
    vi.stubEnv("ENABLE_COMMENT_POLLING", "true");
    await import("../worker/dm-worker");

    expect(vi.getTimerCount()).toBe(2);
    await vi.advanceTimersByTimeAsync(300_000);
    expect(mockReconcileComments).toHaveBeenCalledTimes(1);
    expect(mockRecordHeartbeat).toHaveBeenCalledTimes(11);
  });
});

describe("production messaging URL configuration", () => {
  it("passes the same overridable public URL to the web app and worker", () => {
    const compose = readFileSync(
      path.resolve(__dirname, "../docker-compose.prod.yml"),
      "utf8"
    );
    const web = compose.split("\n  web:\n")[1]?.split("\n  worker:\n")[0];
    const worker = compose.split("\n  worker:\n")[1]?.split("\n  cron:\n")[0];
    const publicUrl =
      "NEXTAUTH_URL: ${NEXTAUTH_URL:-https://www.claudeopenai.space}";

    expect(web).toContain(publicUrl);
    expect(worker).toContain(publicUrl);
  });
});
