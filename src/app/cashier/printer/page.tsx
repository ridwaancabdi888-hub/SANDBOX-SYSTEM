import { createClient } from "@/lib/supabase/server";
import { getPrinterProfiles } from "@/lib/services/printers";
import { PrinterManager } from "@/components/printing/printer-manager";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function CashierPrinterPage() {
  const t = await getT();
  const supabase = await createClient();
  const printers = await getPrinterProfiles(supabase);

  return (
    <div className="flex flex-1 flex-col p-4 lg:p-6">
      <h1 className="mb-1 text-2xl font-bold">{t("printer.title")}</h1>
      <p className="mb-4 text-sm text-muted-foreground">{t("printer.emptyHint")}</p>
      <PrinterManager profiles={printers} />
    </div>
  );
}
