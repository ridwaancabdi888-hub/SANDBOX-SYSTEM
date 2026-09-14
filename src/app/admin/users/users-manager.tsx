"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { useT, roleKey } from "@/lib/i18n";
import { CreateUserModal } from "./create-user-modal";
import { EditUserModal } from "./edit-user-modal";
import type { Profile } from "@/lib/types/domain";
import { LocalDateTime } from "@/components/ui/local-time";

export function UsersManager({
  initialProfiles,
  currentUserId,
}: {
  initialProfiles: Profile[];
  currentUserId: string;
}) {
  const router = useRouter();
  const t = useT();
  const [createOpen, setCreateOpen] = useState(false);
  const [editProfile, setEditProfile] = useState<Profile | null>(null);

  function refresh() {
    router.refresh();
  }

  return (
    <div className="flex-1 p-4 lg:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("users.title")}</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> {t("users.newStaffAccount")}
        </Button>
      </div>

      {initialProfiles.length === 0 ? (
        <EmptyState
          icon={<UserCog className="h-6 w-6" />}
          title={t("users.noAccounts")}
          description={t("users.emptyHint")}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">{t("common.name")}</th>
                <th className="px-3 py-2">{t("auth.email")}</th>
                <th className="px-3 py-2">{t("common.role")}</th>
                <th className="px-3 py-2">{t("common.status")}</th>
                <th className="px-3 py-2">{t("common.created")}</th>
                <th className="sticky right-0 z-10 bg-muted px-3 py-2 text-right shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.15)] sm:static sm:shadow-none">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {initialProfiles.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">
                    {p.full_name}
                    {p.id === currentUserId && (
                      <span className="ml-1.5 text-xs text-muted-foreground">{t("users.you")}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{p.email}</td>
                  <td className="px-3 py-2">
                    <Badge variant="brand">{t(roleKey(p.role))}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={p.active ? "success" : "danger"}>
                      {p.active ? t("common.active") : t("common.inactive")}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground"><LocalDateTime value={p.created_at} /></td>
                  {/* Pinned to the right edge while the table scrolls, so row actions
                    stay reachable on a phone instead of hiding off-screen. */}
                  <td className="sticky right-0 z-10 bg-card px-3 py-2 shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.15)] sm:static sm:shadow-none">
                    <div className="flex justify-end">
                      <Button size="sm" variant="ghost" aria-label={t("users.editUserLabel", { name: p.full_name })} onClick={() => setEditProfile(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} onSaved={refresh} />
      {editProfile && (
        <EditUserModal
          key={editProfile.id}
          open
          profile={editProfile}
          isSelf={editProfile.id === currentUserId}
          onClose={() => setEditProfile(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
