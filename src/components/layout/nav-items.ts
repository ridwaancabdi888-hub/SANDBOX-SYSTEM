import {
  LayoutDashboard,
  ClipboardList,
  UtensilsCrossed,
  Boxes,
  QrCode,
  Users,
  CreditCard,
  Receipt,
  BarChart3,
  History,
  Settings,
  ShoppingCart,
  ChefHat,
  HandPlatter,
  PlusCircle,
  Printer,
  type LucideIcon,
} from "lucide-react";
import type { AppRole } from "@/lib/types/domain";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Icon components can't cross the server/client props boundary (RSC
// serialization rejects function values), so nav item lists — icons and
// all — live here as a client-importable module instead of being built in
// each server layout.tsx and passed down as a prop.
export const NAV_ITEMS_BY_ROLE: Record<AppRole, NavItem[]> = {
  admin: [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/orders", label: "Orders", icon: ClipboardList },
    { href: "/admin/menu", label: "Menu", icon: UtensilsCrossed },
    { href: "/admin/inventory", label: "Inventory", icon: Boxes },
    { href: "/admin/locations", label: "QR Locations", icon: QrCode },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/payments", label: "Payments", icon: CreditCard },
    { href: "/admin/expenses", label: "Expenses", icon: Receipt },
    { href: "/admin/reports", label: "Reports", icon: BarChart3 },
    { href: "/admin/activity", label: "Activity Log", icon: History },
    { href: "/admin/settings", label: "Settings", icon: Settings },
  ],
  cashier: [
    { href: "/cashier", label: "POS", icon: ShoppingCart },
    { href: "/cashier/orders", label: "Orders", icon: ClipboardList },
    { href: "/cashier/payments", label: "Payments", icon: CreditCard },
    { href: "/cashier/printer", label: "Printer", icon: Printer },
  ],
  kitchen: [{ href: "/kitchen", label: "Kitchen Display", icon: ChefHat }],
  waiter: [
    { href: "/waiter", label: "Dashboard", icon: HandPlatter },
    { href: "/waiter/new-order", label: "New Order", icon: PlusCircle },
  ],
};

export { activeNavHref } from "./nav-active";
