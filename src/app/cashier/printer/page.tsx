import { createClient } from "@/lib/supabase/server";
import { getPrinterProfiles } from "@/lib/services/printers";
import { PrinterManager } from "@/components/printing/printer-manager";

export const dynamic = "force-dynamic";

export default async function CashierPrinterPage() {
  const supabase = await createClient();
  const printers = await getPrinterProfiles(supabase);

  return (
    <div className="flex flex-1 flex-col p-4 lg:p-6">
      <h1 className="mb-1 text-2xl font-bold">Printer</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Choose the printer this device uses, connect it, and send a test print.
      </p>
      <PrinterManager profiles={printers} />
    </div>
  );
}
