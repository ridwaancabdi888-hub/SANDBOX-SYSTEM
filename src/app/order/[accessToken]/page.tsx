import { createClient } from "@/lib/supabase/server";
import { getOrderTracking } from "@/lib/services/orders";
import { getSettings } from "@/lib/services/settings";
import { OrderTracking } from "./order-tracking";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function OrderTrackingPage({
  params,
}: {
  params: Promise<{ accessToken: string }>;
}) {
  const { accessToken } = await params;
  const t = await getT();
  const supabase = await createClient();

  const [tracking, settings] = await Promise.all([
    getOrderTracking(supabase, accessToken),
    getSettings(supabase),
  ]);

  if (!tracking) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <h1 className="text-xl font-bold">{t("tracking.notFound")}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{t("tracking.notFoundHint")}</p>
      </div>
    );
  }

  return (
    <OrderTracking
      accessToken={accessToken}
      initial={tracking}
      cafeteriaName={settings.cafeteria_name}
      logoUrl={settings.logo_url}
      currency={settings.currency}
    />
  );
}
