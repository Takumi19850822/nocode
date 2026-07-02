import type { SupabaseClient } from "@supabase/supabase-js";

const CHUNK_SIZE = 300;

/** 複数レコードのフィールド値を一括取得 */
export async function fetchAllRecordValues(
  supabase: SupabaseClient,
  recordIds: string[]
): Promise<Record<string, Record<string, string>>> {
  if (recordIds.length === 0) return {};

  const map: Record<string, Record<string, string>> = {};

  for (let i = 0; i < recordIds.length; i += CHUNK_SIZE) {
    const chunk = recordIds.slice(i, i + CHUNK_SIZE);
    const { data } = await supabase
      .from("app_record_values")
      .select("record_id, field_id, value")
      .in("record_id", chunk);

    data?.forEach((v) => {
      (map[v.record_id] ??= {})[v.field_id] = v.value;
    });
  }

  return map;
}
