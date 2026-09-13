import { PrinterError, type PrintJob, type PrintJobStatus } from "./types";

const MAX_HISTORY = 50;
/** Repeat submissions of the same key inside this window are ignored. */
const DEDUPE_WINDOW_MS = 30_000;

export interface EnqueueOptions {
  label: string;
  printerId: string;
  orderId?: string;
  /** Same key twice in the dedupe window = one print. */
  idempotencyKey?: string;
  maxAttempts?: number;
  run: () => Promise<void>;
}

/**
 * Serialises print jobs so receipts emit in submission order, and guards
 * against the two failure modes that actually hurt a cafeteria: a burst of
 * orders interleaving mid-receipt on the printer, and a double-tap producing
 * two copies of the same receipt.
 *
 * Jobs run one at a time. A failure is retried with backoff up to
 * `maxAttempts`, then parked as FAILED — never silently dropped, so the
 * cashier can retry or fall back to browser print.
 */
export class PrintQueue {
  private jobs: PrintJob[] = [];
  private runners = new Map<string, () => Promise<void>>();
  private maxAttempts = new Map<string, number>();
  private listeners = new Set<(jobs: PrintJob[]) => void>();
  private processing = false;

  getJobs(): PrintJob[] {
    return this.jobs;
  }

  subscribe(listener: (jobs: PrintJob[]) => void) {
    this.listeners.add(listener);
    listener(this.jobs);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    this.jobs = [...this.jobs];
    for (const listener of this.listeners) listener(this.jobs);
  }

  private update(id: string, patch: Partial<PrintJob>) {
    const job = this.jobs.find((j) => j.id === id);
    if (!job) return;
    Object.assign(job, patch);
    this.emit();
  }

  /**
   * Returns the existing job when the idempotency key was seen recently,
   * which is what stops a double-click printing two receipts.
   */
  private findDuplicate(key?: string): PrintJob | undefined {
    if (!key) return undefined;
    const cutoff = Date.now() - DEDUPE_WINDOW_MS;
    return this.jobs.find(
      (job) =>
        job.idempotencyKey === key &&
        job.status !== "FAILED" &&
        job.status !== "CANCELLED" &&
        new Date(job.createdAt).getTime() >= cutoff
    );
  }

  enqueue(options: EnqueueOptions): PrintJob {
    const duplicate = this.findDuplicate(options.idempotencyKey);
    if (duplicate) return duplicate;

    const job: PrintJob = {
      id: crypto.randomUUID(),
      label: options.label,
      printerId: options.printerId,
      orderId: options.orderId,
      status: "QUEUED",
      attempts: 0,
      createdAt: new Date().toISOString(),
      idempotencyKey: options.idempotencyKey,
    };

    this.runners.set(job.id, options.run);
    this.maxAttempts.set(job.id, options.maxAttempts ?? 2);
    this.jobs = [job, ...this.jobs].slice(0, MAX_HISTORY);
    this.emit();

    void this.process();
    return job;
  }

  /** Re-runs a failed job under its original id. */
  retry(jobId: string): void {
    const job = this.jobs.find((j) => j.id === jobId);
    if (!job || !this.runners.has(jobId)) return;
    if (job.status === "PRINTING" || job.status === "QUEUED") return;
    this.update(jobId, { status: "QUEUED", error: undefined, completedAt: undefined });
    void this.process();
  }

  cancel(jobId: string): void {
    const job = this.jobs.find((j) => j.id === jobId);
    if (!job || job.status === "PRINTING" || job.status === "PRINTED") return;
    this.update(jobId, { status: "CANCELLED", completedAt: new Date().toISOString() });
    this.runners.delete(jobId);
  }

  private nextQueued(): PrintJob | undefined {
    // Oldest first: the queue holds newest-first for display.
    for (let i = this.jobs.length - 1; i >= 0; i--) {
      if (this.jobs[i].status === "QUEUED") return this.jobs[i];
    }
    return undefined;
  }

  private async process(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      let job = this.nextQueued();
      while (job) {
        const run = this.runners.get(job.id);
        if (!run) {
          this.update(job.id, { status: "CANCELLED" });
          job = this.nextQueued();
          continue;
        }

        this.update(job.id, { status: "PRINTING", attempts: job.attempts + 1 });

        try {
          await run();
          this.update(job.id, {
            status: "PRINTED",
            completedAt: new Date().toISOString(),
            error: undefined,
          });
          this.runners.delete(job.id);
        } catch (error) {
          const message =
            error instanceof PrinterError
              ? error.hint
                ? `${error.message} ${error.hint}`
                : error.message
              : error instanceof Error
                ? error.message
                : "Printing failed";

          const attempts = this.jobs.find((j) => j.id === job!.id)?.attempts ?? 1;
          const limit = this.maxAttempts.get(job.id) ?? 2;

          if (attempts < limit) {
            // Transient faults (printer waking, BLE reconnect) usually clear
            // within a second or two.
            await new Promise((resolve) => setTimeout(resolve, 800 * attempts));
            this.update(job.id, { status: "QUEUED", error: message });
          } else {
            this.update(job.id, {
              status: "FAILED",
              completedAt: new Date().toISOString(),
              error: message,
            });
          }
        }

        job = this.nextQueued();
      }
    } finally {
      this.processing = false;
    }
  }

  countByStatus(status: PrintJobStatus): number {
    return this.jobs.filter((job) => job.status === status).length;
  }

  clearCompleted(): void {
    this.jobs = this.jobs.filter((job) => job.status === "QUEUED" || job.status === "PRINTING");
    this.emit();
  }
}

/** One queue per device — the browser holds the printer connection. */
export const printQueue = new PrintQueue();
