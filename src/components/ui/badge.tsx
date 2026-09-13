import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/lib/types/domain";
import { ORDER_STATUS_LABELS } from "@/lib/types/domain";

export function Badge({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "brand" | "success" | "warning" | "danger" | "info";
}) {
  const variants: Record<string, string> = {
    default: "bg-muted text-muted-foreground",
    brand: "bg-tone-brand-bg text-tone-brand",
    success: "bg-success-bg text-success",
    warning: "bg-warning-bg text-warning",
    danger: "bg-danger-bg text-danger",
    info: "bg-info-bg text-info",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

const STATUS_STYLES: Record<OrderStatus, string> = {
  NEW: "text-[var(--status-new)] bg-[var(--status-new-bg)]",
  PREPARING: "text-[var(--status-preparing)] bg-[var(--status-preparing-bg)]",
  READY: "text-[var(--status-ready)] bg-[var(--status-ready-bg)]",
  SERVED: "text-[var(--status-served)] bg-[var(--status-served-bg)]",
  COMPLETED: "text-[var(--status-completed)] bg-[var(--status-completed-bg)]",
  CANCELLED: "text-[var(--status-cancelled)] bg-[var(--status-cancelled-bg)]",
};

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        STATUS_STYLES[status],
        className
      )}
    >
      <span className="status-dot bg-current" />
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
