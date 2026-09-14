"use client";

import { useId, useState } from "react";
import { Download, Share, SquarePlus, CircleCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { promptInstall, useInstallKind } from "@/lib/pwa/install";

/**
 * "Install App" for the login page.
 *
 * Renders nothing on the server and during hydration (the install state only
 * exists in the browser), then shows the control that is honest for this
 * browser — see `lib/pwa/install.ts` for what each state means.
 */
export function InstallAppButton() {
  const t = useT();
  const kind = useInstallKind();
  const [helpOpen, setHelpOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const helpId = useId();

  if (kind === "pending" || kind === "standalone" || kind === "unsupported") return null;

  if (kind === "installed") {
    return (
      <p role="status" className="flex items-center justify-center gap-1.5 text-sm text-success">
        <CircleCheck className="h-4 w-4" aria-hidden />
        {t("pwa.installed")}
      </p>
    );
  }

  const steps =
    kind === "ios" ? (
      <>
        {t("pwa.iosStepShare")} <Share className="inline h-4 w-4 align-text-bottom" aria-hidden />{" "}
        {t("pwa.iosStepAdd")} <SquarePlus className="inline h-4 w-4 align-text-bottom" aria-hidden />
      </>
    ) : kind === "safari-mac" ? (
      t("pwa.safariSteps")
    ) : kind === "android-menu" ? (
      t("pwa.androidMenuSteps")
    ) : null;

  async function onClick() {
    if (kind === "prompt") {
      setBusy(true);
      try {
        await promptInstall();
      } finally {
        setBusy(false);
      }
      return;
    }
    setHelpOpen((open) => !open);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={onClick}
        loading={busy}
        aria-expanded={steps ? helpOpen : undefined}
        aria-controls={steps ? helpId : undefined}
        title={t("pwa.installHint")}
        className="rounded-full"
      >
        <Download className="h-4 w-4" aria-hidden />
        {t("pwa.installApp")}
      </Button>

      {steps && helpOpen && (
        <div
          id={helpId}
          role="note"
          className="relative w-full rounded-xl border border-border bg-card px-4 py-3 pr-11 text-left text-sm text-foreground shadow-sm"
        >
          <p className="font-medium">{t("pwa.howToInstall")}</p>
          <p className="mt-1 text-muted-foreground">{steps}</p>
          <button
            type="button"
            onClick={() => setHelpOpen(false)}
            aria-label={t("common.close")}
            className="absolute right-1.5 top-1.5 inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted touch:h-11 touch:w-11"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
