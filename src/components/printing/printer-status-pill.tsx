"use client";

import { CheckCircle2, Loader2, AlertTriangle, Ban, Plug } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PrinterStatus } from "@/lib/printing";

const STYLES: Record<
  PrinterStatus["state"],
  { icon: typeof CheckCircle2; className: string; label: string }
> = {
  connected: {
    icon: CheckCircle2,
    className: "bg-green-100 text-green-700",
    label: "Connected",
  },
  connecting: {
    icon: Loader2,
    className: "bg-amber-100 text-amber-700",
    label: "Connecting",
  },
  idle: { icon: Plug, className: "bg-muted text-muted-foreground", label: "Not connected" },
  error: { icon: AlertTriangle, className: "bg-red-100 text-red-700", label: "Problem" },
  unsupported: { icon: Ban, className: "bg-muted text-muted-foreground", label: "Unavailable" },
};

export function PrinterStatusPill({
  status,
  className,
}: {
  status: PrinterStatus;
  className?: string;
}) {
  const style = STYLES[status.state];
  const Icon = style.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        style.className,
        className
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", status.state === "connecting" && "animate-spin")} />
      {style.label}
      {status.deviceName ? ` · ${status.deviceName}` : ""}
    </span>
  );
}
