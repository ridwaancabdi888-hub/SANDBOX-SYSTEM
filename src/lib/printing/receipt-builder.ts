import type { ReceiptData, ReceiptWidth } from "./types";
import { formatDateTime } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS } from "@/lib/types/domain";
import type { OrderWithItems, PaymentMethod, Settings } from "@/lib/types/domain";

/**
 * The settings columns a receipt needs. Exported so every caller widens in one
 * place — three components used to keep their own copy of this list.
 */
export type ReceiptSettings = Pick<
  Settings,
  | "cafeteria_name"
  | "receipt_header"
  | "receipt_footer"
  | "address"
  | "phone"
  | "currency"
  | "logo_url"
>;

export interface ReceiptSource {
  order: Pick<
    OrderWithItems,
    "order_number" | "source" | "subtotal" | "discount" | "total" | "created_at"
  > & {
    items: { id: string; product_name: string; quantity: number; unit_price: number; subtotal: number; note: string | null }[];
    location?: { name: string } | null;
  };
  payment?: {
    method: PaymentMethod;
    amount_paid: number;
    change_amount: number;
    created_at: string;
  } | null;
  settings: ReceiptSettings;
  cashierName: string;
  widthMm: ReceiptWidth;
  reprint?: boolean;
}

/**
 * Single place that turns an order (+ its payment) into printable receipt
 * data, so the post-payment receipt and a later reprint can never drift apart.
 */
export function buildReceiptData({
  order,
  payment,
  settings,
  cashierName,
  widthMm,
  reprint,
}: ReceiptSource): ReceiptData {
  return {
    cafeteriaName: settings.cafeteria_name,
    logoUrl: settings.logo_url,
    header: settings.receipt_header,
    footer: settings.receipt_footer,
    address: settings.address,
    phone: settings.phone,
    orderNumber: order.order_number,
    date: formatDateTime(payment?.created_at ?? order.created_at),
    cashierName,
    locationName: order.location?.name ?? null,
    source: order.source,
    items: order.items.map((item) => ({
      name: item.product_name,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
      subtotal: Number(item.subtotal),
      note: item.note,
    })),
    subtotal: Number(order.subtotal),
    discount: Number(order.discount),
    total: Number(order.total),
    paymentMethod: payment ? PAYMENT_METHOD_LABELS[payment.method] : "UNPAID",
    amountPaid: payment ? Number(payment.amount_paid) : 0,
    changeAmount: payment ? Number(payment.change_amount) : 0,
    currency: settings.currency,
    widthMm,
    reprint,
  };
}
