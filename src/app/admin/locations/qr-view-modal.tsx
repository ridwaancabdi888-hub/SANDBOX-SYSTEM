"use client";

import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Download, Printer } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import type { Location } from "@/lib/types/domain";

export function QrViewModal({
  open,
  onClose,
  location,
  appUrl,
}: {
  open: boolean;
  onClose: () => void;
  location: Location | null;
  appUrl: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const t = useT();

  if (!location) return null;
  const url = `${appUrl}/menu/${location.code}`;

  function download() {
    const canvas = containerRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `qr-${location!.code}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <Modal open={open} onClose={onClose} title={t("locations.qrTitle", { name: location.name })} size="sm">
      <div className="flex flex-col items-center gap-4">
        <div ref={containerRef} className="print-area flex flex-col items-center gap-2 rounded-xl border border-border bg-white p-6">
          <QRCodeCanvas value={url} size={220} level="M" />
          <p className="text-center font-bold">{location.name}</p>
          <p className="text-center text-xs text-muted-foreground">{url}</p>
        </div>
        <p className="break-all text-center text-xs text-muted-foreground">{url}</p>
        <div className="flex w-full gap-2">
          <Button variant="outline" className="flex-1" onClick={download}>
            <Download className="h-4 w-4" /> {t("locations.downloadPng")}
          </Button>
          <Button className="flex-1" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> {t("common.print")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
