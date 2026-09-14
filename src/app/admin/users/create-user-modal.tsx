"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createStaffUser } from "@/lib/services/users";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { useT, roleKey } from "@/lib/i18n";
import { ROLE_LABELS } from "@/lib/types/domain";
import type { AppRole } from "@/lib/types/domain";

export function CreateUserModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("cashier");
  const [saving, setSaving] = useState(false);
  const t = useT();

  function reset() {
    setFullName("");
    setEmail("");
    setPassword("");
    setRole("cashier");
  }

  async function submit() {
    if (!fullName.trim() || !email.trim() || password.length < 8) {
      toast.error(t("validation.allFieldsPassword"));
      return;
    }
    setSaving(true);
    try {
      await createStaffUser({ fullName: fullName.trim(), email: email.trim(), password, role });
      toast.success(t("users.accountCreated"));
      reset();
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("users.createFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={t("users.newStaffAccount")}
      size="sm"
    >
      <div className="space-y-3">
        <div>
          <Label htmlFor="u-name">{t("users.fullName")}</Label>
          <Input id="u-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="u-email">{t("auth.email")}</Label>
          <Input id="u-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="u-password">{t("users.temporaryPassword")}</Label>
          <Input
            id="u-password"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("users.atLeast8")}
          />
        </div>
        <div>
          <Label htmlFor="u-role">{t("common.role")}</Label>
          <Select id="u-role" value={role} onChange={(e) => setRole(e.target.value as AppRole)}>
            {(Object.keys(ROLE_LABELS) as AppRole[]).map((value) => (
              <option key={value} value={value}>
                {t(roleKey(value))}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button loading={saving} onClick={submit}>
            {t("users.createAccount")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
