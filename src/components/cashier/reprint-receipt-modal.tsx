"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { Printer, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getOrderById } from "@/lib/services/orders";
import { getPaymentByOrderId, type PaymentForReceipt } from "@/lib/services/payments";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { PageLoading } from "@/components/ui/states";
import { ReceiptDocument } from "@/components/receipt/receipt-document";
import { PrinterStatusPill } from "@/components/printing/printer-status-pill";
import { usePrinter } from "@/lib/hooks/use-printer";
import {
  PrinterError,
  buildReceiptData,
  type PrinterProfile,
  type ReceiptData,
  type ReceiptSettings,
} from "@/lib/printing";
import type { OrderWithItems } from "@/lib/types/domain";

/**
 * Reprints the receipt for an existing order. The receipt is rebuilt from the
 * stored order + payment rows — never from screen state — so a reprint is a
 * faithful copy, and it is stamped "REPRINT" so it can't be passed off as a
 * second sale.
 */
export function ReprintReceiptModal({
  orderId,
  open,
  onClose,
  settings,
  fallbackCashierName,
  printers,
}: {
  orderId: string | null;
  open: boolean;
  onClose: () => void;
  settings: ReceiptSettings;
  fallbackCashierName: string;
  printers: PrinterProfile[];
}) {
  const { service, profile, status, ready } = usePrinter(printers);
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [unpaid, setUnpaid] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!open || !orderId || !ready) return;
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setReceipt(null);
      setUnpaid(false);

      try {
        const supabase = createClient();
        const [order, payment] = await Promise.all([
          getOrderById(supabase, orderId),
          getPaymentByOrderId(supabase, orderId),
        ]);
        if (cancelled) return;

        if (!payment) setUnpaid(true);

        setReceipt(
          buildReceiptData({
            order: order as OrderWithItems,
            payment: payment as PaymentForReceipt | null,
            settings,
            cashierName: payment?.cashier_name ?? fallbackCashierName,
            widthMm: profile.paperWidth,
            reprint: true,
          })
        );
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : t("printer.receiptLoadFailed"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // `t` is memoised per locale by the provider, so this does not re-run on
    // every render — only if the language actually changes.
  }, [open, orderId, ready, profile.paperWidth, settings, fallbackCashierName, t]);

  const handlePrint = useCallback(async () => {
    if (!receipt || !service) return;
    setPrinting(true);
    try {
      await service.print({
        receipt,
        orderId: orderId ?? undefined,
        label: `Reprint #${receipt.orderNumber}`,
        // A reprint is deliberately repeatable, so each press is its own job.
        idempotencyKey: `reprint-${orderId}-${Date.now()}`,
      });
      if (!service.usesSystemDialog) toast.success(t("printer.sentToPrinter"));
    } catch (error) {
      if (error instanceof PrinterError) {
        toast.error(error.message, { description: error.hint });
      } else {
        toast.error(t("printer.printingFailed"));
      }
    } finally {
      setPrinting(false);
    }
  }, [receipt, service, orderId, t]);

  return (
    <Modal open={open} onClose={onClose} title={t("printer.reprintTitle")} size="sm">
      {loading || !ready ? (
        <PageLoading label={t("printer.loadingReceipt")} />
      ) : receipt ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {t("orders.orderNumber", { number: receipt.orderNumber })}
            </span>
            <PrinterStatusPill status={status} />
          </div>

          {unpaid && (
            <div className="flex items-start gap-2 rounded-lg bg-warning-bg px-3 py-2 text-xs text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{t("printer.unpaidWarning")}</span>
            </div>
          )}

          <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
            <ReceiptDocument data={receipt} profile={profile} />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              {t("common.close")}
            </Button>
            <Button className="flex-1" loading={printing} onClick={handlePrint}>
              <Printer className="h-4 w-4" /> {t("orders.reprint")}
            </Button>
          </div>
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">{t("printer.receiptUnavailable")}</p>
      )}
    </Modal>
  );
}
