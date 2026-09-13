"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { adjustStock } from "@/lib/services/inventory";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import type { Ingredient, StockTxnType } from "@/lib/types/domain";

const TYPE_LABELS: Record<StockTxnType, string> = {
  PURCHASE: "Purchase (add stock)",
  ADJUSTMENT: "Adjustment",
  WASTE: "Waste / spoilage (remove stock)",
  RETURN: "Return (add stock)",
  SALE: "Sale",
};

export function AdjustStockModal({
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
  const [type, setType] = useState<StockTxnType>("PURCHASE");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const isRemoval = type === "WASTE";

  async function submit() {
    if (!ingredient) return;
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      await adjustStock(supabase, {
        ingredientId: ingredient.id,
        quantityDelta: isRemoval ? -qty : qty,
        type,
        reason: reason.trim() || type,
      });
      toast.success("Stock updated");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to adjust stock");
    } finally {
      setSaving(false);
    }
  }

  if (!ingredient) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Adjust Stock — ${ingredient.name}`} size="sm">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Current: <strong>{ingredient.current_quantity} {ingredient.unit}</strong>
        </p>
        <div>
          <Label htmlFor="type">Transaction type</Label>
          <Select id="type" value={type} onChange={(e) => setType(e.target.value as StockTxnType)}>
            {(["PURCHASE", "WASTE", "ADJUSTMENT", "RETURN"] as StockTxnType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="qty">Quantity ({ingredient.unit})</Label>
          <Input
            id="qty"
            type="number"
            step="0.001"
            min={0}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {isRemoval ? "This will subtract from stock." : "This will add to stock."}
          </p>
        </div>
        <div>
          <Label htmlFor="reason">Reason</Label>
          <Textarea id="reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={submit}>
            Apply
          </Button>
        </div>
      </div>
    </Modal>
  );
}
