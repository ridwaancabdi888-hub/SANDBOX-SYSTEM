"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ShoppingBag, Layers } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { deleteCategory, deleteProduct } from "@/lib/services/menu";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/states";
import { formatCurrency, cn } from "@/lib/utils";
import { CategoryModal } from "./category-modal";
import { ProductModal } from "./product-modal";
import type { Category, Ingredient, Product } from "@/lib/types/domain";

type ProductWithCategory = Product & { category: { id: string; name: string } | null };

export function MenuManager({
  initialCategories,
  initialProducts,
  ingredients,
  currency,
}: {
  initialCategories: Category[];
  initialProducts: ProductWithCategory[];
  ingredients: Ingredient[];
  currency: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [tab, setTab] = useState<"products" | "categories">("products");
  const [categoryModal, setCategoryModal] = useState<{ open: boolean; category: Category | null }>({
    open: false,
    category: null,
  });
  const [productModal, setProductModal] = useState<{ open: boolean; product: Product | null }>({
    open: false,
    product: null,
  });

  function refresh() {
    router.refresh();
  }

  async function handleDeleteCategory(category: Category) {
    const ok = await confirm({
      title: `Delete "${category.name}"?`,
      description: "Products in this category will become uncategorized.",
      variant: "danger",
    });
    if (!ok) return;
    try {
      const supabase = createClient();
      await deleteCategory(supabase, category.id);
      toast.success("Category deleted");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete category");
    }
  }

  async function handleDeleteProduct(product: Product) {
    const ok = await confirm({
      title: `Delete "${product.name}"?`,
      description: "This cannot be undone.",
      variant: "danger",
    });
    if (!ok) return;
    try {
      const supabase = createClient();
      await deleteProduct(supabase, product.id);
      toast.success("Product deleted");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete product");
    }
  }

  return (
    <div className="flex-1 p-4 lg:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Menu</h1>
        <div className="flex gap-2">
          <TabButton active={tab === "products"} onClick={() => setTab("products")} icon={ShoppingBag}>
            Products
          </TabButton>
          <TabButton active={tab === "categories"} onClick={() => setTab("categories")} icon={Layers}>
            Categories
          </TabButton>
        </div>
      </div>

      {tab === "products" ? (
        <div>
          <div className="mb-3 flex justify-end">
            <Button onClick={() => setProductModal({ open: true, product: null })}>
              <Plus className="h-4 w-4" /> New Product
            </Button>
          </div>
          {initialProducts.length === 0 ? (
            <EmptyState title="No products yet" description="Add your first menu item to get started." />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {initialProducts.map((product) => (
                <Card key={product.id} className="overflow-hidden">
                  <div className="flex h-28 items-center justify-center bg-muted text-3xl">
                    {product.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      "🍽️"
                    )}
                  </div>
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.category?.name ?? "Uncategorized"}</p>
                      </div>
                      <Badge variant={product.available ? "success" : "default"}>
                        {product.available ? "Available" : "Hidden"}
                      </Badge>
                    </div>
                    <p className="mt-1 font-bold text-accent">
                      {formatCurrency(product.price, currency)}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => setProductModal({ open: true, product })}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDeleteProduct(product)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="mb-3 flex justify-end">
            <Button onClick={() => setCategoryModal({ open: true, category: null })}>
              <Plus className="h-4 w-4" /> New Category
            </Button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Sort</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {initialCategories.map((cat) => (
                  <tr key={cat.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{cat.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{cat.sort_order}</td>
                    <td className="px-3 py-2">
                      <Badge variant={cat.active ? "success" : "default"}>
                        {cat.active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setCategoryModal({ open: true, category: cat })}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteCategory(cat)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {categoryModal.open && (
        <CategoryModal
          key={categoryModal.category?.id ?? "new"}
          open
          category={categoryModal.category}
          onClose={() => setCategoryModal({ open: false, category: null })}
          onSaved={refresh}
        />
      )}
      {productModal.open && (
        <ProductModal
          key={productModal.product?.id ?? "new"}
          open
          product={productModal.product}
          categories={initialCategories}
          ingredients={ingredients}
          onClose={() => setProductModal({ open: false, product: null })}
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
  icon: typeof ShoppingBag;
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
