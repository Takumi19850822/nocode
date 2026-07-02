import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Profile, SessionProfile, TenantMembership, UserRole } from "@/types";
import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component からの呼び出し時は無視
        }
      },
    },
  });
}

export async function getCurrentProfile(): Promise<SessionProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profileRow) return null;
  const profile = profileRow as Profile;
  const globalRole = profile.role;
  const isSuperAdmin = globalRole === "super_admin";

  // 所属テナント（有効なもの）を取得
  const { data: memberRows } = await supabase
    .from("tenant_members")
    .select("tenant_id, role, is_active, tenants(name)")
    .eq("user_id", user.id)
    .eq("is_active", true);

  type MemberRow = {
    tenant_id: string;
    role: UserRole;
    is_active: boolean;
    tenants: { name: string } | { name: string }[] | null;
  };

  const memberships: TenantMembership[] = ((memberRows as MemberRow[] | null) ?? []).map(
    (m) => {
      const tenant = Array.isArray(m.tenants) ? m.tenants[0] : m.tenants;
      return {
        tenant_id: m.tenant_id,
        tenant_name: tenant?.name ?? "",
        role: m.role,
        is_active: m.is_active,
      };
    }
  );

  // active テナントの決定（未設定・無効なら先頭に既定）
  let activeTenantId = profile.active_tenant_id;
  if (!isSuperAdmin) {
    const isValid =
      activeTenantId != null &&
      memberships.some((m) => m.tenant_id === activeTenantId);
    if (!isValid) {
      activeTenantId = memberships[0]?.tenant_id ?? null;
      if (activeTenantId) {
        await supabase
          .from("profiles")
          .update({ active_tenant_id: activeTenantId })
          .eq("id", user.id);
      }
    }
  }

  const activeMembership = memberships.find((m) => m.tenant_id === activeTenantId);
  const effectiveRole: UserRole = isSuperAdmin
    ? "super_admin"
    : activeMembership?.role ?? "user";
  const effectiveTenantId = isSuperAdmin ? null : activeTenantId;

  return {
    ...profile,
    role: effectiveRole,
    tenant_id: effectiveTenantId,
    active_tenant_id: activeTenantId,
    memberships,
    globalRole,
  };
}
