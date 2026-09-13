"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, PackagePlus, Boxes, History, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import { IngredientModal } from "./ingredient-modal";
import { AdjustStockModal } from "./adjust-stock-modal";
import type { Ingredient, InventoryTransaction } from "@/lib/types/domain";
import { LocalDateTime } from "@/components/ui/local-time";

type HistoryRow = InventoryTransaction & {
  ingredient: { id: string; name: string; unit: string } | null;
  user: { id: string; full_name: string } | null;
};

export function InventoryManager({
  initialIngredients,
  initialHistory,
}: {
  initialIngredients: Ingredient[];
  initialHistory: HistoryRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"ingredients" | "history">("ingredients");
  const [ingredientModal, setIngredientModal] = useState<{ open: boolean; ingredient: Ingredient | null }>({
    open: false,
    ingredient: null,
  });
  const [adjustModal, setAdjustModal] = useState<{ open: boolean; ingredient: Ingredient | null }>({
    open: false,
    ingredient: null,
  });

  function refresh() {
    router.refresh();
  }

  return (
    <div className="flex-1 p-4 lg:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Inventory</h1>
        <div className="flex gap-2">
          <TabButton active={tab === "ingredients"} onClick={() => setTab("ingredients")} icon={Boxes}>
            Ingredients
          </TabButton>
          <TabButton active={tab === "history"} onClick={() => setTab("history")} icon={History}>
            Stock History
          </TabButton>
        </div>
      </div>

      {tab === "ingredients" ? (
        <div>
          <div className="mb-3 flex justify-end">
            <Button onClick={() => setIngredientModal({ open: true, ingredient: null })}>
              <Plus className="h-4 w-4" /> New Ingredient
            </Button>
          </div>
          {initialIngredients.length === 0 ? (
            <EmptyState title="No ingredients yet" />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Stock</th>
                    <th className="px-3 py-2">Minimum</th>
                    <th className="px-3 py-2">Cost/unit</th>
                    <th className="px-3 py-2">Supplier</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="sticky right-0 z-10 bg-muted px-3 py-2 text-right shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.15)] sm:static sm:shadow-none">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {initialIngredients.map((ing) => {
                    const low = ing.current_quantity <= ing.minimum_quantity;
                    return (
                      <tr key={ing.id} className="border-t border-border">
                        <td className="px-3 py-2 font-medium">{ing.name}</td>
                        <td className={cn("px-3 py-2", low && "font-semibold text-danger")}>
                          {ing.current_quantity} {ing.unit}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {ing.minimum_quantity} {ing.unit}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{ing.cost ?? 0}</td>
                        <td className="px-3 py-2 text-muted-foreground">{ing.supplier ?? "—"}</td>
                        <td className="px-3 py-2">
                          {!ing.active ? (
                            <Badge>Inactive</Badge>
                          ) : low ? (
                            <Badge variant="danger">
                              <AlertTriangle className="h-3 w-3" /> Low
                            </Badge>
                          ) : (
                            <Badge variant="success">OK</Badge>
                          )}
                        </td>
                        {/* Pinned right so Adjust/Edit stay reachable while
                            this wide table scrolls on a phone. */}
                        <td className="sticky right-0 z-10 bg-card px-3 py-2 shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.15)] sm:static sm:shadow-none">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setAdjustModal({ open: true, ingredient: ing })}
                            >
                              <PackagePlus className="h-3.5 w-3.5" /> Adjust
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setIngredientModal({ open: true, ingredient: ing })}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          {initialHistory.length === 0 ? (
            <EmptyState title="No stock transactions yet" />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Ingredient</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Qty</th>
                  <th className="px-3 py-2">Before → After</th>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {initialHistory.map((tx) => (
                  <tr key={tx.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{tx.ingredient?.name}</td>
                    <td className="px-3 py-2">
                      <Badge variant={Number(tx.quantity) < 0 ? "danger" : "success"}>{tx.type}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      {Number(tx.quantity) > 0 ? "+" : ""}
                      {tx.quantity} {tx.ingredient?.unit}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {tx.before_quantity} → {tx.after_quantity}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{tx.user?.full_name ?? "System"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{tx.reason ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground"><LocalDateTime value={tx.created_at} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* keyed + conditionally mounted so each open starts with fresh form state */}
      {ingredientModal.open && (
        <IngredientModal
          key={ingredientModal.ingredient?.id ?? "new"}
          open
          ingredient={ingredientModal.ingredient}
          onClose={() => setIngredientModal({ open: false, ingredient: null })}
          onSaved={refresh}
        />
      )}
      {adjustModal.open && (
        <AdjustStockModal
          key={adjustModal.ingredient?.id ?? "none"}
          open
          ingredient={adjustModal.ingredient}
          onClose={() => setAdjustModal({ open: false, ingredient: null })}
          onSaved={refresh}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Boxes;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors touch:min-h-11 touch:px-4",
        active ? "bg-brand-600 text-white" : "bg-muted hover:bg-muted/70"
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}
