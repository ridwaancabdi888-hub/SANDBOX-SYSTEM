"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  createProduct,
  updateProduct,
  getProductRecipe,
  setProductRecipe,
  uploadProductImage,
} from "@/lib/services/menu";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import type { Category, Ingredient, Product } from "@/lib/types/domain";

interface RecipeLine {
  ingredientId: string;
  quantity: string;
}

export function ProductModal({
  open,
  onClose,
  onSaved,
  product,
  categories,
  ingredients,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  product: Product | null;
  categories: Category[];
  ingredients: Ingredient[];
}) {
  // Callers mount this with a key tied to the product, so form state is seeded
  // from props on mount instead of being re-synced through an effect.
  const [name, setName] = useState(product?.name ?? "");
  const [categoryId, setCategoryId] = useState(product?.category_id ?? categories[0]?.id ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [available, setAvailable] = useState(product?.available ?? true);
  const imageUrl = product?.image_url ?? null;
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [recipe, setRecipe] = useState<RecipeLine[]>([]);
  const [saving, setSaving] = useState(false);

  // The existing recipe still has to be fetched — that's a genuine external
  // read, not prop syncing.
  useEffect(() => {
    if (!product) return;
    let cancelled = false;
    const supabase = createClient();
    getProductRecipe(supabase, product.id).then((rows) => {
      if (cancelled) return;
      setRecipe(rows.map((r) => ({ ingredientId: r.ingredient_id, quantity: String(r.quantity) })));
    });
    return () => {
      cancelled = true;
    };
  }, [product]);

  function addRecipeLine() {
    setRecipe((prev) => [...prev, { ingredientId: ingredients[0]?.id ?? "", quantity: "" }]);
  }

  function updateRecipeLine(idx: number, patch: Partial<RecipeLine>) {
    setRecipe((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function removeRecipeLine(idx: number) {
    setRecipe((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit() {
    if (!name.trim() || !price) {
      toast.error("Name and price are required");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      let finalImageUrl = imageUrl;
      if (imageFile) {
        finalImageUrl = await uploadProductImage(supabase, imageFile);
      }

      const payload = {
        name: name.trim(),
        category_id: categoryId || null,
        description: description.trim() || null,
        price: Number(price),
        sku: sku.trim() || null,
        available,
        image_url: finalImageUrl,
      };

      const saved = product
        ? await updateProduct(supabase, product.id, payload)
        : await createProduct(supabase, payload);

      const validRecipe = recipe.filter((r) => r.ingredientId && Number(r.quantity) > 0);
      await setProductRecipe(
        supabase,
        saved.id,
        validRecipe.map((r) => ({ ingredient_id: r.ingredientId, quantity: Number(r.quantity) }))
      );

      toast.success(product ? "Product updated" : "Product created");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={product ? "Edit Product" : "New Product"} size="lg">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div>
            <Label htmlFor="p-name">Name</Label>
            <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="p-category">Category</Label>
            <Select id="p-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="p-desc">Description</Label>
            <Textarea id="p-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="p-price">Price</Label>
              <Input
                id="p-price"
                type="number"
                step="0.01"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="p-sku">SKU</Label>
              <Input id="p-sku" value={sku} onChange={(e) => setSku(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm touch:min-h-11">
            <input
              type="checkbox"
              checked={available}
              onChange={(e) => setAvailable(e.target.checked)}
              className="h-4 w-4 shrink-0 rounded border-border touch:h-5 touch:w-5"
            />
            Available for ordering
          </label>
          <div>
            <Label>Image</Label>
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-muted text-2xl">
                {imageFile ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={URL.createObjectURL(imageFile)} alt="" className="h-full w-full object-cover" />
                ) : imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  "🍽️"
                )}
              </div>
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">
                <Upload className="h-4 w-4" />
                Upload
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label className="mb-0">Recipe (ingredients)</Label>
            <Button variant="outline" size="sm" onClick={addRecipeLine}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
          <div className="space-y-2">
            {recipe.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No recipe set. Stock won&apos;t be deducted automatically for this product.
              </p>
            )}
            {recipe.map((line, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Select
                  value={line.ingredientId}
                  onChange={(e) => updateRecipeLine(idx, { ingredientId: e.target.value })}
                  className="flex-1"
                >
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({ing.unit})
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  step="0.001"
                  min={0}
                  placeholder="Qty"
                  className="w-24"
                  value={line.quantity}
                  onChange={(e) => updateRecipeLine(idx, { quantity: e.target.value })}
                />
                <button
                  onClick={() => removeRecipeLine(idx)}
                  className="text-muted-foreground hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={saving} onClick={submit}>
          Save Product
        </Button>
      </div>
    </Modal>
  );
}
