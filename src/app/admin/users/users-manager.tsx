"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, UserCog, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { Input, Select } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useT, usePlural, roleKey } from "@/lib/i18n";
import { deleteStaffUser } from "@/lib/services/users";
import { CreateUserModal } from "./create-user-modal";
import { EditUserModal } from "./edit-user-modal";
import { ROLE_LABELS } from "@/lib/types/domain";
import type { AppRole, Profile } from "@/lib/types/domain";
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
  const plural = usePlural();
  const confirm = useConfirm();
  const [createOpen, setCreateOpen] = useState(false);
  const [editProfile, setEditProfile] = useState<Profile | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<AppRole | "">("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");

  function refresh() {
    router.refresh();
  }

  // Filtering is client-side: the staff list is small and already loaded, so a
  // round trip per keystroke would be pure latency.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initialProfiles.filter((p) => {
      if (roleFilter && p.role !== roleFilter) return false;
      if (statusFilter === "active" && !p.active) return false;
      if (statusFilter === "inactive" && p.active) return false;
      if (!q) return true;
      return (
        p.full_name.toLowerCase().includes(q) ||
        (p.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [initialProfiles, query, roleFilter, statusFilter]);

  const filtering = Boolean(query.trim() || roleFilter || statusFilter);

  // The server is the authority on both of these; disabling the button here just
  // avoids offering an action that is guaranteed to be refused.
  const activeAdmins = initialProfiles.filter((p) => p.role === "admin" && p.active).length;
  function blockedReason(p: Profile): string | null {
    if (p.id === currentUserId) return t("users.cannotDeleteSelf");
    if (p.role === "admin" && p.active && activeAdmins <= 1) return t("users.cannotDeleteLastAdmin");
    return null;
  }

  async function remove(p: Profile) {
    const ok = await confirm({
      title: t("users.confirmDelete", { name: p.full_name }),
      description: t("users.confirmDeleteBody"),
      confirmLabel: t("common.delete"),
      variant: "danger",
    });
    if (!ok) return;

    setDeletingId(p.id);
    try {
      await deleteStaffUser(p.id);
      toast.success(t("users.deleted"));
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("users.deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex-1 p-4 lg:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("users.title")}</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> {t("users.newStaffAccount")}
        </Button>
      </div>

      {initialProfiles.length > 0 && (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("users.searchPlaceholder")}
              aria-label={t("users.searchPlaceholder")}
              className="pl-9"
            />
          </div>
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as AppRole | "")}
            aria-label={t("users.filterRole")}
            className="sm:w-44"
          >
            <option value="">{t("users.filterRole")}</option>
            {(Object.keys(ROLE_LABELS) as AppRole[]).map((value) => (
              <option key={value} value={value}>
                {t(roleKey(value))}
              </option>
            ))}
          </Select>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | "active" | "inactive")}
            aria-label={t("users.filterStatus")}
            className="sm:w-44"
          >
            <option value="">{t("users.filterStatus")}</option>
            <option value="active">{t("users.statusActive")}</option>
            <option value="inactive">{t("users.statusInactive")}</option>
          </Select>
        </div>
      )}

      {initialProfiles.length === 0 ? (
        <EmptyState
          icon={<UserCog className="h-6 w-6" />}
          title={t("users.noAccounts")}
          description={t("users.emptyHint")}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Search className="h-6 w-6" />}
          title={t("users.noMatches")}
          description={t("users.emptyHint")}
          action={
            <Button
              variant="outline"
              onClick={() => {
                setQuery("");
                setRoleFilter("");
                setStatusFilter("");
              }}
            >
              {t("users.clearFilters")}
            </Button>
          }
        />
      ) : (
        <>
          {filtering && (
            <p className="mb-2 text-xs text-muted-foreground">
              {plural("users.showingCount", visible.length, { count: visible.length })}
            </p>
          )}
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
                {visible.map((p) => {
                  const blocked = blockedReason(p);
                  return (
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
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" aria-label={t("users.editUserLabel", { name: p.full_name })} onClick={() => setEditProfile(p)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={t("users.deleteUserLabel", { name: p.full_name })}
                            title={blocked ?? undefined}
                            disabled={Boolean(blocked)}
                            loading={deletingId === p.id}
                            onClick={() => remove(p)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-danger" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
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
