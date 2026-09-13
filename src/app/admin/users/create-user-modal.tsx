"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createStaffUser } from "@/lib/services/users";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
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

  function reset() {
    setFullName("");
    setEmail("");
    setPassword("");
    setRole("cashier");
  }

  async function submit() {
    if (!fullName.trim() || !email.trim() || password.length < 8) {
      toast.error("Fill all fields — password must be at least 8 characters");
      return;
    }
    setSaving(true);
    try {
      await createStaffUser({ fullName: fullName.trim(), email: email.trim(), password, role });
      toast.success("Staff account created");
      reset();
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
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
      title="New Staff Account"
      size="sm"
    >
      <div className="space-y-3">
        <div>
          <Label htmlFor="u-name">Full name</Label>
          <Input id="u-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="u-email">Email</Label>
          <Input id="u-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="u-password">Temporary password</Label>
          <Input
            id="u-password"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>
        <div>
          <Label htmlFor="u-role">Role</Label>
          <Select id="u-role" value={role} onChange={(e) => setRole(e.target.value as AppRole)}>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={submit}>
            Create Account
          </Button>
        </div>
      </div>
    </Modal>
  );
}
