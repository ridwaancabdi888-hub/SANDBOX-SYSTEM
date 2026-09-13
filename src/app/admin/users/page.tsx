import { createClient } from "@/lib/supabase/server";
import { getProfiles } from "@/lib/services/users";
import { UsersManager } from "./users-manager";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profiles = await getProfiles(supabase);

  return <UsersManager initialProfiles={profiles} currentUserId={user!.id} />;
}
