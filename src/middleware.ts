import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { UserRole } from "@/types";

function getPublishableKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  );
}

function isSignupExplicitlyAllowed() {
  return process.env.NEXT_PUBLIC_ALLOW_SIGNUP === "true";
}

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * CSRF対策: Cookieセッションに依存するAPIへの状態変更リクエストは
 * Origin（無ければReferer）がこのオリジン自身であることを要求する。
 * SameSite=Lax/Strict の防御に加えた多層防御。
 */
function isSameOriginRequest(request: NextRequest): boolean {
  const expectedOrigin = request.nextUrl.origin;
  const origin = request.headers.get("origin");
  if (origin) return origin === expectedOrigin;

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin === expectedOrigin;
    } catch {
      return false;
    }
  }

  // Origin/Referer どちらも無いリクエストは拒否（正規のブラウザ発行では通常付与される）
  return false;
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    getPublishableKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
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

  const isLoginPage = pathname === "/login";
  const isSignupPage = pathname === "/signup";
  const isPasswordReset =
    pathname === "/forgot-password" || pathname === "/reset-password";
  const isApiRoute = pathname.startsWith("/api/");
  const isPublic = isLoginPage || isSignupPage || isPasswordReset;

  // CSRF対策: API への状態変更リクエストは同一オリジンのみ許可
  if (isApiRoute && UNSAFE_METHODS.has(request.method) && !isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  // サインアップページ: 初回のみ or 明示的許可
  if (isSignupPage) {
    if (user) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    if (!isSignupExplicitlyAllowed()) {
      const { data: allowed } = await supabase.rpc("is_signup_allowed");
      if (!allowed) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("error", "signup_disabled");
        return NextResponse.redirect(url);
      }
    }
    return supabaseResponse;
  }

  if (!user && !isPublic && !isApiRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // ロール別ルート保護
  if (user && (pathname.startsWith("/admin") || pathname.startsWith("/tenant"))) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, active_tenant_id")
      .eq("id", user.id)
      .single();

    const globalRole = profile?.role as UserRole | undefined;
    const isSuperAdmin = globalRole === "super_admin";

    if (pathname.startsWith("/admin") && !isSuperAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/tenant") && !isSuperAdmin) {
      // active テナントで tenant_admin であることを要求
      let activeRoleIsAdmin = false;
      if (profile?.active_tenant_id) {
        const { data: membership } = await supabase
          .from("tenant_members")
          .select("role")
          .eq("user_id", user.id)
          .eq("tenant_id", profile.active_tenant_id)
          .eq("is_active", true)
          .maybeSingle();
        activeRoleIsAdmin = membership?.role === "tenant_admin";
      }

      if (!activeRoleIsAdmin) {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
