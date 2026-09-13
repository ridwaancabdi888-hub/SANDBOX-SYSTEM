import { createClient } from "@/lib/supabase/server";
import { getAvailableProductsByCategory } from "@/lib/services/menu";
import { getSettings } from "@/lib/services/settings";
import { BrandLogo } from "@/components/layout/brand-logo";
import { CustomerMenu } from "./customer-menu";

export const dynamic = "force-dynamic";

export default async function CustomerMenuPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createClient();

  const [{ data: location }, categories, settings] = await Promise.all([
    supabase.from("locations").select("*").eq("code", code).eq("active", true).maybeSingle(),
    getAvailableProductsByCategory(supabase),
    getSettings(supabase),
  ]);

  if (!location) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <BrandLogo
          logoUrl={settings.logo_url}
          name={settings.cafeteria_name}
          size="lg"
          rounded="rounded-2xl"
        />
        <h1 className="text-xl font-bold">This QR code isn&apos;t available</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          This seating location may be inactive. Please ask a staff member for assistance.
        </p>
      </div>
    );
  }

  const categoriesWithItems = categories.filter((c) => c.products.length > 0);

  return (
    <CustomerMenu
      locationCode={location.code}
      locationName={location.name}
      cafeteriaName={settings.cafeteria_name}
      logoUrl={settings.logo_url}
      currency={settings.currency}
      categories={categoriesWithItems}
    />
  );
}
