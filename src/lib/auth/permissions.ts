import { getCurrentProfile } from "@/lib/supabase/server";
import type { SessionProfile, UserRole } from "@/types";

export async function requireSuperAdmin(): Promise<
  { profile: SessionProfile } | { error: string; status: number }
> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Unauthorized", status: 401 };
  if (profile.role !== "super_admin") return { error: "Forbidden", status: 403 };
  return { profile };
}

export async function requireTenantManager(tenantId: string): Promise<
  { profile: SessionProfile } | { error: string; status: number }
> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Unauthorized", status: 401 };
  if (profile.role === "super_admin") return { profile };

  const membership = profile.memberships.find((m) => m.tenant_id === tenantId);
  if (membership && membership.role === "tenant_admin") {
    return { profile };
  }
  return { error: "Forbidden", status: 403 };
}

/**
 * テナント内ロールの任命可否。
 * super_admin は tenant_admin/user を任命可能（テナント所属 API 経由）。
 * super_admin への昇格は /api/admin/users/[userId]/super-admin を使用。
 */
export function canAssignRole(
  actor: SessionProfile,
  role: UserRole,
  targetTenantId: string
): boolean {
  if (role === "super_admin") return false;

  if (actor.role === "super_admin") {
    return role === "tenant_admin" || role === "user";
  }

  const membership = actor.memberships.find((m) => m.tenant_id === targetTenantId);
  if (membership && membership.role === "tenant_admin") {
    return role === "user";
  }

  return false;
}

export function canManageTenantAdmins(actor: SessionProfile): boolean {
  return actor.role === "super_admin";
}
