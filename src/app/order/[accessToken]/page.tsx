import { createClient } from "@/lib/supabase/server";
import { getOrderTracking } from "@/lib/services/orders";
import { getSettings } from "@/lib/services/settings";
import { OrderTracking } from "./order-tracking";

export const dynamic = "force-dynamic";

export default async function OrderTrackingPage({
  params,
}: {
  params: Promise<{ accessToken: string }>;
}) {
  const { accessToken } = await params;
  const supabase = await createClient();

  const [tracking, settings] = await Promise.all([
    getOrderTracking(supabase, accessToken),
    getSettings(supabase),
  ]);

  if (!tracking) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <h1 className="text-xl font-bold">Order not found</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          This order link is invalid or has expired. Please ask staff for assistance.
        </p>
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
