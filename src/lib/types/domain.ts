import type { Database } from "./database.types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type OrderStatus = Database["public"]["Enums"]["order_status"];
export type OrderSource = Database["public"]["Enums"]["order_source"];
export type PaymentMethod = Database["public"]["Enums"]["payment_method"];
export type IngredientUnit = Database["public"]["Enums"]["ingredient_unit"];
export type StockTxnType = Database["public"]["Enums"]["stock_txn_type"];

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"];
export type Ingredient = Database["public"]["Tables"]["ingredients"]["Row"];
export type ProductIngredient =
  Database["public"]["Tables"]["product_ingredients"]["Row"];
export type Location = Database["public"]["Tables"]["locations"]["Row"];
export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];
export type OrderStatusHistory =
  Database["public"]["Tables"]["order_status_history"]["Row"];
export type Payment = Database["public"]["Tables"]["payments"]["Row"];
export type InventoryTransaction =
  Database["public"]["Tables"]["inventory_transactions"]["Row"];
export type Notification = Database["public"]["Tables"]["notifications"]["Row"];
export type ActivityLog = Database["public"]["Tables"]["activity_logs"]["Row"];
export type PrinterSettings =
  Database["public"]["Tables"]["printer_settings"]["Row"];
export type Expense = Database["public"]["Tables"]["expenses"]["Row"];
export type Settings = Database["public"]["Tables"]["settings"]["Row"];

export type OrderWithItems = Order & {
  items: OrderItem[];
  location: Pick<Location, "id" | "name" | "code"> | null;
};

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  cashier: "Cashier",
  kitchen: "Kitchen",
  waiter: "Waiter",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: "New",
  PREPARING: "Preparing",
  READY: "Ready",
  SERVED: "Served",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  "NEW",
  "PREPARING",
  "READY",
  "SERVED",
  "COMPLETED",
];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  ZAAD: "ZAAD",
  EDAHAB: "eDahab",
  OTHER: "Other",
};

export const INGREDIENT_UNIT_LABELS: Record<IngredientUnit, string> = {
  kg: "kg",
  g: "g",
  L: "L",
  ml: "ml",
  pcs: "pcs",
  box: "box",
  pack: "pack",
};

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  note?: string;
  imageUrl?: string | null;
}
