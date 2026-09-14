import { createClient } from "@/lib/supabase/server";
import { getAvailableProductsByCategory } from "@/lib/services/menu";
import { getActiveLocations } from "@/lib/services/locations";
import { getSettings } from "@/lib/services/settings";
import { OrderBuilder } from "@/components/orders/order-builder";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function WaiterNewOrderPage() {
  const t = await getT();
  const supabase = await createClient();
  const [categories, locations, settings] = await Promise.all([
    getAvailableProductsByCategory(supabase),
    getActiveLocations(supabase),
    getSettings(supabase),
  ]);

  return (
    <div className="flex flex-1 flex-col p-4 lg:p-6">
      <h1 className="mb-4 text-2xl font-bold">{t("newOrder.title")}</h1>
      <OrderBuilder
        categories={categories}
        locations={locations}
        source="WAITER"
        currency={settings.currency}
      />
    </div>
  );
}
