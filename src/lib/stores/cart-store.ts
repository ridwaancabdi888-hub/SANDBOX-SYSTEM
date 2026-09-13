import { create } from "zustand";
import type { CartItem } from "@/lib/types/domain";

interface CartState {
  items: CartItem[];
  orderNote: string;
  addItem: (item: Omit<CartItem, "quantity">) => void;
  incrementItem: (productId: string) => void;
  decrementItem: (productId: string) => void;
  removeItem: (productId: string) => void;
  updateItemNote: (productId: string, note: string) => void;
  setOrderNote: (note: string) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>((set) => ({
  items: [],
  orderNote: "",
  addItem: (item) =>
    set((state) => {
      const existing = state.items.find((i) => i.productId === item.productId);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.productId === item.productId ? { ...i, quantity: i.quantity + 1 } : i
          ),
        };
      }
      return { items: [...state.items, { ...item, quantity: 1 }] };
    }),
  incrementItem: (productId) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i
      ),
    })),
  decrementItem: (productId) =>
    set((state) => ({
      items: state.items
        .map((i) => (i.productId === productId ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0),
    })),
  removeItem: (productId) =>
    set((state) => ({ items: state.items.filter((i) => i.productId !== productId) })),
  updateItemNote: (productId, note) =>
    set((state) => ({
      items: state.items.map((i) => (i.productId === productId ? { ...i, note } : i)),
    })),
  setOrderNote: (note) => set({ orderNote: note }),
  clear: () => set({ items: [], orderNote: "" }),
}));

export function cartTotal(items: CartItem[]) {
  return items.reduce((sum, i) => sum + i.price * i.quantity, 0);
}

export function cartCount(items: CartItem[]) {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}
