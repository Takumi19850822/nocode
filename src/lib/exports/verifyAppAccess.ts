import type { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/server";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

export async function verifyAppAccess(supabase: SupabaseServer, appId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "認証が必要です", status: 401 as const };

  const { data: app, error } = await supabase
    .from("apps")
    .select("id, name, tenant_id")
    .eq("id", appId)
    .single();

  if (error || !app) {
    return { error: "アプリが見つかりません", status: 404 as const };
  }

  // super_admin は全テナント可。それ以外は active テナントと一致必須
  if (profile.globalRole !== "super_admin") {
    if (!profile.active_tenant_id || profile.active_tenant_id !== app.tenant_id) {
      return { error: "このアプリにアクセスできません", status: 403 as const };
    }
    const isMember = profile.memberships.some(
      (m) => m.tenant_id === app.tenant_id && m.is_active
    );
    if (!isMember) {
      return { error: "このアプリにアクセスできません", status: 403 as const };
    }
  }

  return { user: { id: profile.id }, app, profile };
}
