import { getCurrentProfile } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/types";

export async function requireSuperAdmin(): Promise<
  { profile: Profile } | { error: string; status: number }
> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Unauthorized", status: 401 };
  if (profile.role !== "super_admin") return { error: "Forbidden", status: 403 };
  return { profile };
}

export async function requireTenantManager(tenantId: string): Promise<
  { profile: Profile } | { error: string; status: number }
> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Unauthorized", status: 401 };
  if (profile.role === "super_admin") return { profile };
  if (profile.role === "tenant_admin" && profile.tenant_id === tenantId) {
    return { profile };
  }
  return { error: "Forbidden", status: 403 };
}

/** super_admin はアプリから付与不可。super_admin は tenant_admin/user のみ任命可能 */
export function canAssignRole(
  actor: Profile,
  role: UserRole,
  targetTenantId: string
): boolean {
  if (role === "super_admin") return false;

  if (actor.role === "super_admin") {
    return role === "tenant_admin" || role === "user";
  }

  // テナント管理者は一般ユーザーのみ追加・管理
  if (actor.role === "tenant_admin" && actor.tenant_id === targetTenantId) {
    return role === "user";
  }

  return false;
}

export function canManageTenantAdmins(actor: Profile): boolean {
  return actor.role === "super_admin";
}
