import type { SupabaseClient } from "@supabase/supabase-js";

/** 指定 app に属する field_id のみ残す */
export async function filterFieldIdsForApp(
  supabase: SupabaseClient,
  appId: string,
  fieldIds: string[]
): Promise<string[]> {
  if (fieldIds.length === 0) return [];
  const unique = [...new Set(fieldIds)];
  const { data } = await supabase
    .from("app_fields")
    .select("id")
    .eq("app_id", appId)
    .in("id", unique);
  const valid = new Set((data ?? []).map((f) => f.id));
  return unique.filter((id) => valid.has(id));
}

/** レコード更新用: 全 field_id が app 所属か検証 */
export async function assertFieldIdsBelongToApp(
  supabase: SupabaseClient,
  appId: string,
  fieldIds: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const unique = [...new Set(fieldIds)];
  if (unique.length === 0) {
    return { ok: false, error: "更新フィールドが指定されていません" };
  }
  const filtered = await filterFieldIdsForApp(supabase, appId, unique);
  if (filtered.length !== unique.length) {
    return { ok: false, error: "無効なフィールドが含まれています" };
  }
  return { ok: true };
}
