"use client";

import { RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { PrintJob, PrintJobStatus } from "@/lib/printing";
import { LocalDateTime } from "@/components/ui/local-time";

const STATUS_VARIANT: Record<PrintJobStatus, "default" | "success" | "warning" | "danger" | "info"> =
  {
    QUEUED: "info",
    PRINTING: "warning",
    PRINTED: "success",
    FAILED: "danger",
    CANCELLED: "default",
  };

/**
 * Recent print jobs for this device. Makes failures visible instead of losing
 * a receipt silently — a failed job stays listed with its error and a Retry.
 */
export function PrintQueuePanel({
  jobs,
  onRetry,
}: {
  jobs: PrintJob[];
  onRetry: (jobId: string) => void;
}) {
  const t = useT();
  if (jobs.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("printer.queueTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {jobs.slice(0, 8).map((job) => (
          <div
            key={job.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <div className="font-medium">{job.label}</div>
              <div className="text-xs text-muted-foreground">
                <LocalDateTime value={job.createdAt} />
                {job.attempts > 1 ? ` · ${job.attempts} attempts` : ""}
              </div>
              {job.error && <div className="mt-0.5 text-xs text-danger">{job.error}</div>}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_VARIANT[job.status]}>{job.status}</Badge>
              {job.status === "FAILED" && (
                <Button size="sm" variant="outline" onClick={() => onRetry(job.id)}>
                  <RefreshCw className="h-3.5 w-3.5" /> {t("printer.retryJob")}
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
