"use client";

import { useState, useCallback, createContext, useContext, ReactNode } from "react";
import { Modal } from "./modal";
import { Button } from "./button";
import { AlertTriangle } from "lucide-react";
import { useT } from "@/lib/i18n";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "primary" | "danger";
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [state, setState] = useState<{
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ options, resolve });
    });
  }, []);

  const handle = (value: boolean) => {
    state?.resolve(value);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <Modal open={!!state} onClose={() => handle(false)} size="sm">
        {state && (
          <div>
            <div className="flex items-start gap-3">
              <div
                className={
                  state.options.variant === "danger"
                    ? "rounded-full bg-danger-bg p-2 text-danger"
                    : "rounded-full bg-tone-brand-bg p-2 text-tone-brand"
                }
              >
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">{state.options.title}</h3>
                {state.options.description && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {state.options.description}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => handle(false)}>
                {state.options.cancelLabel ?? t("common.cancel")}
              </Button>
              <Button
                variant={state.options.variant === "danger" ? "danger" : "primary"}
                onClick={() => handle(true)}
              >
                {state.options.confirmLabel ?? t("common.confirm")}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx.confirm;
}
