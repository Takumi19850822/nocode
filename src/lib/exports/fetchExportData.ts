import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppRecord } from "@/types";

const RECORD_CHUNK = 500;

/** アプリの全レコードと値を取得（エクスポート用） */
export async function fetchAllRecordValues(
  supabase: SupabaseClient,
  appId: string
): Promise<{ records: AppRecord[]; valuesByRecord: Record<string, Record<string, string>> }> {
  const { data: records, error } = await supabase
    .from("app_records")
    .select("*")
    .eq("app_id", appId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const list = (records as AppRecord[] | null) ?? [];
  const valuesByRecord: Record<string, Record<string, string>> = {};

  for (let i = 0; i < list.length; i += RECORD_CHUNK) {
    const chunkIds = list.slice(i, i + RECORD_CHUNK).map((r) => r.id);
    const { data: values, error: valErr } = await supabase
      .from("app_record_values")
      .select("record_id, field_id, value")
      .in("record_id", chunkIds);

    if (valErr) throw new Error(valErr.message);

    values?.forEach((v) => {
      (valuesByRecord[v.record_id] ??= {})[v.field_id] = v.value;
    });
  }

  return { records: list, valuesByRecord };
}
