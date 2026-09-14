import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/services/settings";
import { BrandLogo } from "@/components/layout/brand-logo";
import { getT } from "@/lib/i18n/server";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  // `settings` is publicly readable by design (the customer menu needs it), so
  // branding is available on this unauthenticated page without a privileged
  // client. Never widen this to columns a signed-out visitor shouldn't see.
  const supabase = await createClient();
  const [settings, t] = await Promise.all([
    getSettings(supabase).catch(() => null),
    getT(),
  ]);
  const name = settings?.cafeteria_name?.trim() || "SANDBOX";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-background to-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <BrandLogo
            logoUrl={settings?.logo_url}
            name={name}
            size="lg"
            rounded="rounded-2xl"
            className="mx-auto mb-4 shadow-lg shadow-brand-600/20"
          />
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">{name}</h1>
          <p className="text-sm text-muted-foreground">{t("auth.systemTagline")}</p>
        </div>
        <Suspense>
          <LoginFormWrapper searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function LoginFormWrapper({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  return <LoginForm next={params.next} inactiveError={params.error === "account_inactive"} />;
}
