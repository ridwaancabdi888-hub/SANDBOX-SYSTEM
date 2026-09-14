"use client";

import { useState } from "react";
import { toast } from "sonner";
import { updateStaffUser, resetStaffPassword } from "@/lib/services/users";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { useT, roleKey } from "@/lib/i18n";
import { ROLE_LABELS } from "@/lib/types/domain";
import type { AppRole, Profile } from "@/lib/types/domain";

export function EditUserModal({
  open,
  onClose,
  onSaved,
  profile,
  isSelf,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  profile: Profile | null;
  isSelf: boolean;
}) {
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [role, setRole] = useState<AppRole>(profile?.role ?? "cashier");
  const [active, setActive] = useState(profile?.active ?? true);
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const t = useT();

  async function submit() {
    if (!profile) return;
    setSaving(true);
    try {
      await updateStaffUser(profile.id, { fullName: fullName.trim(), role, active });
      if (newPassword) {
        if (newPassword.length < 8) {
          toast.error(t("validation.passwordTooShort", { min: 8 }));
          setSaving(false);
          return;
        }
        await resetStaffPassword(profile.id, newPassword);
      }
      toast.success(t("users.accountUpdated"));
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("users.updateFailed"));
    } finally {
      setSaving(false);
    }
  }

  if (!profile) return null;

  return (
    <Modal open={open} onClose={onClose} title={t("users.editUserTitle", { name: profile.full_name })} size="sm">
      <div className="space-y-3">
        <div>
          <Label htmlFor="e-name">{t("users.fullName")}</Label>
          <Input id="e-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <Label>{t("auth.email")}</Label>
          <Input value={profile.email} disabled />
        </div>
        <div>
          <Label htmlFor="e-role">{t("common.role")}</Label>
          <Select
            id="e-role"
            value={role}
            onChange={(e) => setRole(e.target.value as AppRole)}
            disabled={isSelf}
          >
            {(Object.keys(ROLE_LABELS) as AppRole[]).map((value) => (
              <option key={value} value={value}>
                {t(roleKey(value))}
              </option>
            ))}
          </Select>
          {isSelf && (
            <p className="mt-1 text-xs text-muted-foreground">{t("users.cannotChangeOwnRole")}</p>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm touch:min-h-11">
          <input
            type="checkbox"
            checked={active}
            disabled={isSelf}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 shrink-0 rounded border-border touch:h-5 touch:w-5"
          />
          {t("common.active")} {isSelf && t("users.cannotDeactivateSelf")}
        </label>
        <div>
          <Label htmlFor="e-password">{t("users.resetPasswordOptional")}</Label>
          <Input
            id="e-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={t("users.leaveBlankKeep")}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button loading={saving} onClick={submit}>
            {t("users.saveChanges")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
