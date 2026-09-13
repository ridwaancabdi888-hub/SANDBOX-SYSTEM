"use client";

import { useState } from "react";
import { toast } from "sonner";
import { updateStaffUser, resetStaffPassword } from "@/lib/services/users";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
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

  async function submit() {
    if (!profile) return;
    setSaving(true);
    try {
      await updateStaffUser(profile.id, { fullName: fullName.trim(), role, active });
      if (newPassword) {
        if (newPassword.length < 8) {
          toast.error("Password must be at least 8 characters");
          setSaving(false);
          return;
        }
        await resetStaffPassword(profile.id, newPassword);
      }
      toast.success("Account updated");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update account");
    } finally {
      setSaving(false);
    }
  }

  if (!profile) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Edit — ${profile.full_name}`} size="sm">
      <div className="space-y-3">
        <div>
          <Label htmlFor="e-name">Full name</Label>
          <Input id="e-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <Label>Email</Label>
          <Input value={profile.email} disabled />
        </div>
        <div>
          <Label htmlFor="e-role">Role</Label>
          <Select
            id="e-role"
            value={role}
            onChange={(e) => setRole(e.target.value as AppRole)}
            disabled={isSelf}
          >
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          {isSelf && <p className="mt-1 text-xs text-muted-foreground">You cannot change your own role.</p>}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            disabled={isSelf}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Active {isSelf && "(you cannot deactivate yourself)"}
        </label>
        <div>
          <Label htmlFor="e-password">Reset password (optional)</Label>
          <Input
            id="e-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Leave blank to keep current password"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={submit}>
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}
