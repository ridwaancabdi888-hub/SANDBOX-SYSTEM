"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { createLocation, updateLocation } from "@/lib/services/locations";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useT } from "@/lib/i18n";
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
  const t = useT();

  async function submit() {
    if (!name.trim() || !code.trim()) {
      toast.error(t("validation.nameAndCodeRequired"));
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
      toast.success(location ? t("locations.updated") : t("locations.created"));
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("menu.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={location ? t("locations.editLocation") : t("locations.newQrLocation")} size="sm">
      <div className="space-y-3">
        <div>
          <Label htmlFor="l-name">{t("common.name")}</Label>
          <Input id="l-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("locations.namePlaceholder")} />
        </div>
        <div>
          <Label htmlFor="l-code">{t("locations.codeInUrl")}</Label>
          <Input id="l-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder={t("locations.codePlaceholder")} />
        </div>
        <label className="flex items-center gap-2 text-sm touch:min-h-11">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 shrink-0 rounded border-border touch:h-5 touch:w-5"
          />
          {t("common.active")}
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button loading={saving} onClick={submit}>
            {t("common.save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
