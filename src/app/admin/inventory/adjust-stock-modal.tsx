"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { adjustStock } from "@/lib/services/inventory";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { useT } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n";
import type { Ingredient, StockTxnType } from "@/lib/types/domain";

// Stock transaction types are database enum values and stay as they are; only
// the label a human reads is translated.
const TYPE_KEYS: Record<StockTxnType, TranslationKey> = {
  PURCHASE: "inventory.typePurchase",
  ADJUSTMENT: "inventory.typeAdjustment",
  WASTE: "inventory.typeWaste",
  RETURN: "inventory.typeReturn",
  SALE: "inventory.typeSale",
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
  const t = useT();

  const isRemoval = type === "WASTE";

  async function submit() {
    if (!ingredient) return;
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      toast.error(t("validation.validQuantity"));
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
      toast.success(t("inventory.stockUpdated"));
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("inventory.stockFailed"));
    } finally {
      setSaving(false);
    }
  }

  if (!ingredient) return null;

  return (
    <Modal open={open} onClose={onClose} title={t("inventory.adjustTitle", { name: ingredient.name })} size="sm">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {t("inventory.currentLabel")}{" "}
          <strong>
            {ingredient.current_quantity} {ingredient.unit}
          </strong>
        </p>
        <div>
          <Label htmlFor="type">{t("inventory.transactionType")}</Label>
          <Select id="type" value={type} onChange={(e) => setType(e.target.value as StockTxnType)}>
            {(["PURCHASE", "WASTE", "ADJUSTMENT", "RETURN"] as StockTxnType[]).map((value) => (
              <option key={value} value={value}>
                {t(TYPE_KEYS[value])}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="qty">{t("inventory.quantityWithUnit", { unit: ingredient.unit })}</Label>
          <Input
            id="qty"
            type="number"
            step="0.001"
            min={0}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {isRemoval ? t("inventory.willSubtract") : t("inventory.willAdd")}
          </p>
        </div>
        <div>
          <Label htmlFor="reason">{t("inventory.reason")}</Label>
          <Textarea id="reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button loading={saving} onClick={submit}>
            {t("common.apply")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
