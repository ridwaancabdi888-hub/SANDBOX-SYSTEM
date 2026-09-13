import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/types/database.types";
import type { AppRole } from "@/lib/types/domain";

const ROLE_HOME: Record<AppRole, string> = {
  admin: "/admin",
  cashier: "/cashier",
  kitchen: "/kitchen",
  waiter: "/waiter",
};

const SECTION_ROLES: { prefix: string; roles: AppRole[] }[] = [
  { prefix: "/admin", roles: ["admin"] },
  { prefix: "/cashier", roles: ["cashier", "admin"] },
  { prefix: "/kitchen", roles: ["kitchen", "admin"] },
  { prefix: "/waiter", roles: ["waiter", "admin"] },
];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const section = SECTION_ROLES.find((s) => pathname.startsWith(s.prefix));

  if (!section) {
    return supabaseResponse;
  }

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.active) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "account_inactive");
    return NextResponse.redirect(url);
  }

  const role = profile.role as AppRole;

  if (!section.roles.includes(role)) {
    const url = request.nextUrl.clone();
    url.pathname = ROLE_HOME[role];
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
