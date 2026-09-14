"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Banknote, Printer, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { recordPayment } from "@/lib/services/orders";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
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
import { formatCurrency } from "@/lib/utils";
import type { OrderWithItems, PaymentMethod } from "@/lib/types/domain";
import { useT, paymentMethodKey } from "@/lib/i18n";
import { PAYMENT_METHOD_LABELS } from "@/lib/types/domain";

export function PaymentModal({
  order,
  open,
  onClose,
  onPaid,
  settings,
  cashierName,
  printers,
}: {
  order: OrderWithItems | null;
  open: boolean;
  onClose: () => void;
  onPaid?: () => void;
  settings: ReceiptSettings;
  cashierName: string;
  printers: PrinterProfile[];
}) {
  const { service, profile, status, ready } = usePrinter(printers);
  const t = useT();

  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  const total = order?.total ?? 0;
  const paidNum = Number(amountPaid) || 0;
  const change = useMemo(() => Math.max(paidNum - total, 0), [paidNum, total]);

  function handleClose() {
    setMethod("CASH");
    setAmountPaid("");
    setReceipt(null);
    onClose();
  }

  async function submit() {
    if (!order) return;
    if (paidNum < total) {
      toast.error(t("payments.mustCoverTotal"));
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createClient();
      const result = await recordPayment(supabase, {
        orderId: order.id,
        method,
        amountPaid: paidNum,
      });
      toast.success(t("payments.orderPaid", { number: order.order_number }));

      setReceipt(
        buildReceiptData({
          order,
          payment: {
            method,
            amount_paid: paidNum,
            change_amount: result.change_amount,
            created_at: new Date().toISOString(),
          },
          settings,
          cashierName,
          widthMm: profile.paperWidth,
        })
      );
      onPaid?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("payments.failed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function print() {
    if (!receipt || !service || !order) return;
    setPrinting(true);
    try {
      await service.print({
        receipt,
        orderId: order.id,
        // Guards against a double-tap producing two receipts.
        idempotencyKey: `receipt-${order.id}`,
      });
      if (!service.usesSystemDialog) toast.success(t("printer.sentToPrinter"));
    } catch (err) {
      if (err instanceof PrinterError) {
        toast.error(err.message, { description: err.hint });
      } else {
        toast.error(err instanceof Error ? err.message : t("printer.printFailed"));
      }
    } finally {
      setPrinting(false);
    }
  }

  if (!order) return null;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={
        receipt ? t("payments.receipt") : t("payments.payOrder", { number: order.order_number })
      }
      size="sm"
    >
      {!receipt ? (
        <div className="space-y-4">
          <div className="rounded-lg bg-muted p-3 text-sm">
            {order.items.map((i) => (
              <div key={i.id} className="flex justify-between">
                <span>
                  {i.quantity}x {i.product_name}
                </span>
                <span>{formatCurrency(Number(i.subtotal), settings.currency)}</span>
              </div>
            ))}
            <div className="mt-2 flex justify-between border-t border-border pt-2 font-bold">
              <span>{t("common.total")}</span>
              <span>{formatCurrency(total, settings.currency)}</span>
            </div>
          </div>

          <div>
            <Label htmlFor="method">{t("payments.paymentMethod")}</Label>
            <Select
              id="method"
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            >
              {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((value) => (
                <option key={value} value={value}>
                  {t(paymentMethodKey(value))}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="amount-paid">{t("payments.amountPaid")}</Label>
            <div className="relative">
              <Banknote className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="amount-paid"
                type="number"
                step="0.01"
                min={0}
                className="pl-9"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder={total.toFixed(2)}
              />
            </div>
            <div className="mt-1 flex gap-1">
              {[total, Math.ceil(total / 5) * 5, Math.ceil(total / 10) * 10].map((v, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setAmountPaid(v.toFixed(2))}
                  className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                >
                  {formatCurrency(v, settings.currency)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-between rounded-lg bg-success-bg px-3 py-2 text-sm font-semibold text-success">
            <span>{t("payments.change")}</span>
            <span>{formatCurrency(change, settings.currency)}</span>
          </div>

          <Button
            size="lg"
            className="w-full"
            loading={submitting}
            disabled={paidNum < total}
            onClick={submit}
          >
            {t("payments.confirmPayment")}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-2 text-success">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium">{t("payments.paymentSuccessful")}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {profile.name} · {profile.paperWidth}mm
            </span>
            {ready && <PrinterStatusPill status={status} />}
          </div>
          <div className="max-h-96 overflow-y-auto rounded-lg border border-border">
            <ReceiptDocument data={receipt} profile={profile} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleClose}>
              {t("common.close")}
            </Button>
            <Button className="flex-1" loading={printing} onClick={print}>
              <Printer className="h-4 w-4" /> {t("printer.printReceipt")}
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            {t("payments.alreadyRecorded")}
          </p>
        </div>
      )}
    </Modal>
  );
}
