"use client";

import { useEffect, useState } from "react";
import { Check, MapPin, ChefHat, Bell, HandPlatter, PartyPopper, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getOrderTracking } from "@/lib/services/orders";
import { BrandLogo } from "@/components/layout/brand-logo";
import { formatCurrency } from "@/lib/utils";
import { ORDER_STATUS_FLOW } from "@/lib/types/domain";
import { useT } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n";
import type { OrderStatus } from "@/lib/types/domain";

type Tracking = NonNullable<Awaited<ReturnType<typeof getOrderTracking>>>;

const STEPS: { status: OrderStatus; labelKey: TranslationKey; icon: typeof Check }[] = [
  { status: "NEW", labelKey: "tracking.stepReceived", icon: Check },
  { status: "PREPARING", labelKey: "tracking.stepPreparing", icon: ChefHat },
  { status: "READY", labelKey: "tracking.stepReady", icon: Bell },
  { status: "SERVED", labelKey: "tracking.stepServed", icon: HandPlatter },
  { status: "COMPLETED", labelKey: "tracking.stepCompleted", icon: PartyPopper },
];

const POLL_INTERVAL_MS = 4000;

export function OrderTracking({
  accessToken,
  initial,
  cafeteriaName,
  logoUrl,
  currency,
}: {
  accessToken: string;
  initial: Tracking;
  cafeteriaName: string;
  logoUrl?: string | null;
  currency: string;
}) {
  const [tracking, setTracking] = useState(initial);
  const t = useT();

  useEffect(() => {
    const supabase = createClient();
    const interval = setInterval(async () => {
      try {
        const fresh = await getOrderTracking(supabase, accessToken);
        if (fresh) setTracking(fresh);
      } catch {
        // transient network error — next poll will retry
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [accessToken]);

  const currentIndex = ORDER_STATUS_FLOW.indexOf(tracking.status);
  const isCancelled = tracking.status === "CANCELLED";

  return (
    <div className="mx-auto min-h-screen max-w-md bg-background px-4 py-8">
      <div className="mb-6 text-center">
        <BrandLogo
          logoUrl={logoUrl}
          name={cafeteriaName}
          size="lg"
          rounded="rounded-2xl"
          className="mx-auto mb-3"
        />
        <h1 className="text-sm font-medium text-muted-foreground">{cafeteriaName}</h1>
        <p className="text-2xl font-bold">
          {t("tracking.orderNumber", { number: tracking.order_number })}
        </p>
        {tracking.location_name && (
          <p className="mt-1 flex items-center justify-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> {tracking.location_name}
          </p>
        )}
      </div>

      {isCancelled ? (
        <div className="mb-6 flex flex-col items-center gap-2 rounded-xl bg-danger-bg p-6 text-center">
          <XCircle className="h-8 w-8 text-danger" />
          <p className="font-semibold text-danger">{t("tracking.statusCancelled")}</p>
        </div>
      ) : (
        <div className="mb-6 space-y-4 rounded-xl border border-border bg-card p-5">
          {STEPS.map((step, idx) => {
            const done = idx <= currentIndex;
            const isCurrent = idx === currentIndex;
            return (
              <div key={step.status} className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    done ? "bg-brand-600 text-white" : "bg-muted text-muted-foreground"
                  } ${isCurrent ? "ring-4 ring-brand-100" : ""}`}
                >
                  <step.icon className="h-4 w-4" />
                </div>
                <span className={`text-sm ${done ? "font-semibold" : "text-muted-foreground"}`}>
                  {t(step.labelKey)}
                  {isCurrent && <span className="ml-1 text-accent">{t("tracking.now")}</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-semibold">{t("tracking.orderSummary")}</h2>
        <div className="space-y-1 text-sm">
          {tracking.items.map((item) => (
            <div key={item.id} className="flex justify-between">
              <span>
                {item.quantity}x {item.product_name}
              </span>
              <span>{formatCurrency(item.subtotal, currency)}</span>
            </div>
          ))}
        </div>
        {tracking.customer_note && (
          <p className="mt-2 rounded-md bg-warning-bg px-2 py-1 text-xs text-warning">
            {t("common.note")}: {tracking.customer_note}
          </p>
        )}
        <div className="mt-3 flex justify-between border-t border-border pt-2 font-bold">
          <span>{t("common.total")}</span>
          <span>{formatCurrency(tracking.total, currency)}</span>
        </div>
      </div>
    </div>
  );
}
