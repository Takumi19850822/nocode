import type { createClient } from "@/lib/supabase/server";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

export async function verifyAppAccess(supabase: SupabaseServer, appId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "認証が必要です", status: 401 as const };

  const { data: app, error } = await supabase
    .from("apps")
    .select("id, name, tenant_id")
    .eq("id", appId)
    .single();

  if (error || !app) {
    return { error: "アプリが見つかりません", status: 404 as const };
  }

  return { user, app };
}
