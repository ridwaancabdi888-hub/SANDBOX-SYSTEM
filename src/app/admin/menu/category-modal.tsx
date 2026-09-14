"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { createCategory, updateCategory } from "@/lib/services/menu";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useT } from "@/lib/i18n";
import type { Category } from "@/lib/types/domain";

export function CategoryModal({
  open,
  onClose,
  onSaved,
  category,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  category: Category | null;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [sortOrder, setSortOrder] = useState(String(category?.sort_order ?? 0));
  const [active, setActive] = useState(category?.active ?? true);
  const [saving, setSaving] = useState(false);
  const t = useT();

  async function submit() {
    if (!name.trim()) {
      toast.error(t("validation.nameRequired"));
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const payload = { name: name.trim(), sort_order: Number(sortOrder) || 0, active };
      if (category) {
        await updateCategory(supabase, category.id, payload);
      } else {
        await createCategory(supabase, payload);
      }
      toast.success(category ? t("menu.categoryUpdated") : t("menu.categoryCreated"));
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("menu.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={category ? t("menu.editCategory") : t("menu.newCategory")} size="sm">
      <div className="space-y-3">
        <div>
          <Label htmlFor="c-name">{t("common.name")}</Label>
          <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="c-sort">{t("menu.sortOrder")}</Label>
          <Input
            id="c-sort"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          />
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
