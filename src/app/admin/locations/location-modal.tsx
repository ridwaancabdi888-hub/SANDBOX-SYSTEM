"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { createLocation, updateLocation } from "@/lib/services/locations";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import type { Location } from "@/lib/types/domain";

export function LocationModal({
  open,
  onClose,
  onSaved,
  location,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  location: Location | null;
}) {
  const [name, setName] = useState(location?.name ?? "");
  const [code, setCode] = useState(location?.code ?? "");
  const [active, setActive] = useState(location?.active ?? true);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim() || !code.trim()) {
      toast.error("Name and code are required");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const slug = code.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
      if (location) {
        await updateLocation(supabase, location.id, { name: name.trim(), code: slug, active });
      } else {
        await createLocation(supabase, { name: name.trim(), code: slug, active });
      }
      toast.success(location ? "Location updated" : "Location created");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save location");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={location ? "Edit Location" : "New QR Location"} size="sm">
      <div className="space-y-3">
        <div>
          <Label htmlFor="l-name">Name</Label>
          <Input id="l-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seat 09" />
        </div>
        <div>
          <Label htmlFor="l-code">Code (used in URL)</Label>
          <Input id="l-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="seat-09" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Active
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={submit}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}
