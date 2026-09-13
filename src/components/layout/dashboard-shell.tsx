"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/lib/actions/auth";
import { NotificationBell } from "./notification-bell";
import { BrandLogo } from "./brand-logo";
import { ThemeToggleButton } from "./theme-toggle";
import { NAV_ITEMS_BY_ROLE, activeNavHref, type NavItem } from "./nav-items";
import { ROLE_LABELS, type AppRole, type Notification } from "@/lib/types/domain";

export type { NavItem };

export function DashboardShell({
  role,
  section = role,
  fullName,
  notifications,
  showSoundToggle,
  cafeteriaName,
  logoUrl,
  children,
}: {
  role: AppRole;
  /** Which nav list to show — defaults to `role`, but a section layout
   * (e.g. /cashier) should pass its own section so an admin browsing
   * into another role's area sees that area's nav, not the admin menu. */
  section?: AppRole;
  fullName: string;
  notifications: Notification[];
  showSoundToggle?: boolean;
  cafeteriaName?: string;
  logoUrl?: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navItems = NAV_ITEMS_BY_ROLE[section];
  const activeHref = activeNavHref(pathname, navItems);

  const initials = fullName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-card lg:flex lg:flex-col">
        <SidebarContent
          role={role}
          fullName={fullName}
          initials={initials}
          navItems={navItems}
          activeHref={activeHref}
          cafeteriaName={cafeteriaName}
          logoUrl={logoUrl}
        />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-overlay" onClick={() => setMobileOpen(false)} />
          <aside className="fixed inset-y-0 left-0 flex w-72 flex-col bg-card shadow-xl">
            <div className="flex justify-end p-3">
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="rounded-lg p-2 hover:bg-muted touch:min-h-11 touch:min-w-11 flex items-center justify-center"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarContent
              role={role}
              fullName={fullName}
              initials={initials}
              navItems={navItems}
              activeHref={activeHref}
              cafeteriaName={cafeteriaName}
              logoUrl={logoUrl}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="rounded-lg p-2 hover:bg-muted lg:hidden touch:min-h-11 touch:min-w-11 flex items-center justify-center"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-2">
            <ThemeToggleButton />
            <NotificationBell initial={notifications} showSoundToggle={showSoundToggle} />
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted touch:min-h-11 touch:min-w-11 justify-center"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
        </header>
        <main className="flex flex-1 flex-col overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({
  role,
  fullName,
  initials,
  navItems,
  activeHref,
  cafeteriaName,
  logoUrl,
  onNavigate,
}: {
  role: AppRole;
  fullName: string;
  initials: string;
  navItems: NavItem[];
  activeHref: string | null;
  cafeteriaName?: string;
  logoUrl?: string | null;
  onNavigate?: () => void;
}) {
  const name = cafeteriaName?.trim() || "SANDBOX";
  return (
    <>
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <BrandLogo logoUrl={logoUrl} name={name} size="sm" />
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-bold">{name}</div>
          <div className="text-[10px] text-muted-foreground">Cafeteria System</div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3 scrollbar-thin">
        {navItems.map((item) => {
          const active = item.href === activeHref;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors touch:py-3",
                active
                  ? "bg-brand-600 text-white"
                  : "text-foreground/80 hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex items-center gap-2 border-t border-border p-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
          {initials}
        </div>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-medium">{fullName}</div>
          <div className="text-[10px] text-muted-foreground">{ROLE_LABELS[role]}</div>
        </div>
      </div>
    </>
  );
}
