"use client";

import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const t = useT();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div
        className="fixed inset-0 bg-overlay backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-xl bg-card shadow-xl sm:max-h-[90vh]",
          sizeClasses[size]
        )}
      >
        {(title || description) && (
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-4 sm:p-5">
            <div className="min-w-0">
              {title && <h2 className="text-base font-semibold sm:text-lg">{title}</h2>}
              {description && (
                <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="-m-1 flex shrink-0 items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-muted touch:min-h-11 touch:min-w-11"
              aria-label={t("common.close")}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        {/* Only the body scrolls, so the title and Close stay put. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 scrollbar-thin sm:p-5">
          {children}
        </div>
      </div>
    </div>
  );
}
