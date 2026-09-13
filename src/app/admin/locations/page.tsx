import { createClient } from "@/lib/supabase/server";
import { getLocations } from "@/lib/services/locations";
import { LocationsManager } from "./locations-manager";

export const dynamic = "force-dynamic";

export default async function AdminLocationsPage() {
  const supabase = await createClient();
  const locations = await getLocations(supabase);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return <LocationsManager initialLocations={locations} appUrl={appUrl} />;
}
