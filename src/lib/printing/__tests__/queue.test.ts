import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PrintQueue } from "../queue";
import { PrinterError } from "../types";

function waitFor(predicate: () => boolean, timeoutMs = 4000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error("timed out"));
      setTimeout(tick, 15);
    };
    tick();
  });
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe("print queue", () => {
  test("prints jobs strictly in submission order", async () => {
    const queue = new PrintQueue();
    const printed: string[] = [];

    for (const label of ["Receipt 1001", "Receipt 1002", "Receipt 1003"]) {
      queue.enqueue({
        label,
        printerId: "p1",
        run: async () => {
          // Stagger so an unordered implementation would interleave.
          await sleep(label.endsWith("1001") ? 40 : 5);
          printed.push(label);
        },
      });
    }

    await waitFor(() => printed.length === 3);
    assert.deepEqual(printed, ["Receipt 1001", "Receipt 1002", "Receipt 1003"]);
  });

  test("never runs two jobs concurrently", async () => {
    const queue = new PrintQueue();
    let active = 0;
    let maxActive = 0;

    for (let i = 0; i < 5; i++) {
      queue.enqueue({
        label: `Job ${i}`,
        printerId: "p1",
        run: async () => {
          active++;
          maxActive = Math.max(maxActive, active);
          await sleep(10);
          active--;
        },
      });
    }

    await waitFor(() => queue.countByStatus("PRINTED") === 5);
    assert.equal(maxActive, 1, "jobs overlapped — receipts would interleave on paper");
  });

  test("deduplicates repeat submissions of the same receipt", async () => {
    const queue = new PrintQueue();
    let runs = 0;
    const run = async () => {
      runs++;
    };

    const first = queue.enqueue({ label: "Receipt", printerId: "p1", idempotencyKey: "order-7", run });
    const second = queue.enqueue({ label: "Receipt", printerId: "p1", idempotencyKey: "order-7", run });

    assert.equal(first.id, second.id, "double-tap created a second job");
    await waitFor(() => queue.countByStatus("PRINTED") === 1);
    assert.equal(runs, 1, "receipt printed twice");
  });

  test("different keys are not deduplicated", async () => {
    const queue = new PrintQueue();
    const a = queue.enqueue({ label: "A", printerId: "p1", idempotencyKey: "a", run: async () => {} });
    const b = queue.enqueue({ label: "B", printerId: "p1", idempotencyKey: "b", run: async () => {} });
    assert.notEqual(a.id, b.id);
    await waitFor(() => queue.countByStatus("PRINTED") === 2);
  });

  test("retries a transient failure then succeeds", async () => {
    const queue = new PrintQueue();
    let attempts = 0;

    queue.enqueue({
      label: "Flaky",
      printerId: "p1",
      maxAttempts: 3,
      run: async () => {
        attempts++;
        if (attempts < 2) throw new PrinterError("write_failed", "Printer busy");
      },
    });

    await waitFor(() => queue.countByStatus("PRINTED") === 1, 6000);
    assert.equal(attempts, 2);
  });

  test("parks a job as FAILED after exhausting attempts, never silently dropping it", async () => {
    const queue = new PrintQueue();

    queue.enqueue({
      label: "Offline printer",
      printerId: "p1",
      maxAttempts: 2,
      run: async () => {
        throw new PrinterError("printer_offline", "Printer offline", "Check power");
      },
    });

    await waitFor(() => queue.countByStatus("FAILED") === 1, 6000);
    const job = queue.getJobs()[0];
    assert.equal(job.status, "FAILED");
    assert.equal(job.attempts, 2);
    assert.match(job.error ?? "", /Printer offline/);
    // The hint is surfaced too, so the cashier knows what to do.
    assert.match(job.error ?? "", /Check power/);
  });

  test("a failed job can be retried manually and then succeeds", async () => {
    const queue = new PrintQueue();
    let shouldFail = true;

    const job = queue.enqueue({
      label: "Receipt",
      printerId: "p1",
      maxAttempts: 1,
      run: async () => {
        if (shouldFail) throw new PrinterError("printer_offline", "Offline");
      },
    });

    await waitFor(() => queue.countByStatus("FAILED") === 1, 6000);
    shouldFail = false;
    queue.retry(job.id);
    await waitFor(() => queue.countByStatus("PRINTED") === 1, 6000);
  });

  test("cancelling a queued job stops it from printing", async () => {
    const queue = new PrintQueue();
    let ran = false;

    // Occupy the queue so the second job stays QUEUED long enough to cancel.
    queue.enqueue({ label: "Blocker", printerId: "p1", run: async () => sleep(60) });
    const job = queue.enqueue({
      label: "Cancelled",
      printerId: "p1",
      run: async () => {
        ran = true;
      },
    });

    queue.cancel(job.id);
    await sleep(200);
    assert.equal(ran, false, "cancelled job still printed");
    assert.equal(queue.getJobs().find((j) => j.id === job.id)?.status, "CANCELLED");
  });

  test("notifies subscribers of status transitions", async () => {
    const queue = new PrintQueue();
    const seen = new Set<string>();
    queue.subscribe((jobs) => jobs.forEach((j) => seen.add(j.status)));

    queue.enqueue({ label: "Receipt", printerId: "p1", run: async () => sleep(5) });
    await waitFor(() => queue.countByStatus("PRINTED") === 1);

    assert.ok(seen.has("PRINTED"));
  });
});
