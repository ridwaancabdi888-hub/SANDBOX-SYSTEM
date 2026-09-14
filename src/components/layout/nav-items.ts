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
import type { TranslationKey } from "@/lib/i18n";

export interface NavItem {
  href: string;
  /** Resolved through `t()` at render time — the sidebar has to re-label
   *  itself when the language changes, so a literal string will not do. */
  labelKey: TranslationKey;
  icon: LucideIcon;
}

// Icon components can't cross the server/client props boundary (RSC
// serialization rejects function values), so nav item lists — icons and
// all — live here as a client-importable module instead of being built in
// each server layout.tsx and passed down as a prop.
export const NAV_ITEMS_BY_ROLE: Record<AppRole, NavItem[]> = {
  admin: [
    { href: "/admin", labelKey: "nav.dashboard", icon: LayoutDashboard },
    { href: "/admin/orders", labelKey: "nav.orders", icon: ClipboardList },
    { href: "/admin/menu", labelKey: "nav.menu", icon: UtensilsCrossed },
    { href: "/admin/inventory", labelKey: "nav.inventory", icon: Boxes },
    { href: "/admin/locations", labelKey: "nav.locations", icon: QrCode },
    { href: "/admin/users", labelKey: "nav.users", icon: Users },
    { href: "/admin/payments", labelKey: "nav.payments", icon: CreditCard },
    { href: "/admin/expenses", labelKey: "nav.expenses", icon: Receipt },
    { href: "/admin/reports", labelKey: "nav.reports", icon: BarChart3 },
    { href: "/admin/activity", labelKey: "nav.activity", icon: History },
    { href: "/admin/settings", labelKey: "nav.settings", icon: Settings },
  ],
  cashier: [
    { href: "/cashier", labelKey: "nav.pos", icon: ShoppingCart },
    { href: "/cashier/orders", labelKey: "nav.orders", icon: ClipboardList },
    { href: "/cashier/payments", labelKey: "nav.payments", icon: CreditCard },
    { href: "/cashier/printer", labelKey: "nav.printer", icon: Printer },
  ],
  kitchen: [{ href: "/kitchen", labelKey: "nav.kitchenDisplay", icon: ChefHat }],
  waiter: [
    { href: "/waiter", labelKey: "nav.dashboard", icon: HandPlatter },
    { href: "/waiter/new-order", labelKey: "nav.newOrder", icon: PlusCircle },
  ],
};

export { activeNavHref } from "./nav-active";
