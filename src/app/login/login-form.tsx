"use client";

import { useActionState } from "react";
import { Mail, Lock, LogIn } from "lucide-react";
import { signInAction, type AuthFormState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useT } from "@/lib/i18n";

const initialState: AuthFormState = {};

export function LoginForm({
  next,
  inactiveError,
}: {
  next?: string;
  inactiveError?: boolean;
}) {
  const [state, formAction, pending] = useActionState(signInAction, initialState);
  const t = useT();

  return (
    <Card>
      <CardContent className="pt-5">
        <form action={formAction} className="space-y-4">
          {next && <input type="hidden" name="next" value={next} />}

          {(state.error || inactiveError) && (
            <div className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">
              {state.error ?? t("auth.accountInactive")}
            </div>
          )}

          <div>
            <Label htmlFor="email">{t("auth.email")}</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                className="pl-9"
                placeholder={t("auth.emailPlaceholder")}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="password">{t("auth.password")}</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="pl-9"
                placeholder="••••••••"
              />
            </div>
          </div>

          <Button type="submit" className="w-full" size="lg" loading={pending}>
            <LogIn className="h-4 w-4" />
            {t("auth.signIn")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
