"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { createIngredient, updateIngredient } from "@/lib/services/inventory";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { INGREDIENT_UNIT_LABELS } from "@/lib/types/domain";
import type { Ingredient, IngredientUnit } from "@/lib/types/domain";

export function IngredientModal({
  open,
  onClose,
  onSaved,
  ingredient,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  ingredient: Ingredient | null;
}) {
  // Callers mount this with a key tied to the ingredient, so initial state is
  // seeded from props rather than re-synced through an effect.
  const [name, setName] = useState(ingredient?.name ?? "");
  const [unit, setUnit] = useState<IngredientUnit>((ingredient?.unit as IngredientUnit) ?? "kg");
  const [minQty, setMinQty] = useState(String(ingredient?.minimum_quantity ?? 0));
  const [cost, setCost] = useState(String(ingredient?.cost ?? 0));
  const [supplier, setSupplier] = useState(ingredient?.supplier ?? "");
  const [active, setActive] = useState(ingredient?.active ?? true);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const payload = {
        name: name.trim(),
        unit,
        minimum_quantity: Number(minQty) || 0,
        cost: Number(cost) || 0,
        supplier: supplier.trim() || null,
        active,
      };
      if (ingredient) {
        await updateIngredient(supabase, ingredient.id, payload);
      } else {
        await createIngredient(supabase, { ...payload, current_quantity: 0 });
      }
      toast.success(ingredient ? "Ingredient updated" : "Ingredient created");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save ingredient");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={ingredient ? "Edit Ingredient" : "New Ingredient"} size="sm">
      <div className="space-y-3">
        <div>
          <Label htmlFor="i-name">Name</Label>
          <Input id="i-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="i-unit">Unit</Label>
            <Select id="i-unit" value={unit} onChange={(e) => setUnit(e.target.value as IngredientUnit)}>
              {Object.entries(INGREDIENT_UNIT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="i-min">Minimum qty</Label>
            <Input id="i-min" type="number" step="0.001" value={minQty} onChange={(e) => setMinQty(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="i-cost">Cost per unit</Label>
            <Input id="i-cost" type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="i-supplier">Supplier</Label>
            <Input id="i-supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
          </div>
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
