import { createClient } from "@/lib/supabase/server";
import { getActivityLogs } from "@/lib/services/activity";
import { EmptyState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { LocalDateTime } from "@/components/ui/local-time";

export const dynamic = "force-dynamic";

export default async function AdminActivityPage() {
  const supabase = await createClient();
  const logs = await getActivityLogs(supabase, 300);

  return (
    <div className="flex-1 p-4 lg:p-6">
      <h1 className="mb-4 text-2xl font-bold">Activity Log</h1>
      {logs.length === 0 ? (
        <EmptyState title="No activity recorded yet" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Entity</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const user = log.user as { full_name: string; role: string } | null;
                return (
                  <tr key={log.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{user?.full_name ?? "System"}</td>
                    <td className="px-3 py-2">
                      <Badge variant="brand">{log.action.replace(/_/g, " ")}</Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{log.entity_type ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{log.description ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground"><LocalDateTime value={log.created_at} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
