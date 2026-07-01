import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { RecordReference } from "@/types";

export const runtime = "edge";

type RouteContext = {
  params: Promise<{ appId: string; recordId: string }>;
};

async function verifyRecordAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  appId: string,
  recordId: string
) {
  const { data: record } = await supabase
    .from("app_records")
    .select("id, app_id")
    .eq("id", recordId)
    .eq("app_id", appId)
    .single();

  return record;
}

async function fetchRecordReferences(
  supabase: Awaited<ReturnType<typeof createClient>>,
  recordId: string
): Promise<RecordReference[]> {
  const { data: refs, error } = await supabase
    .from("app_record_values")
    .select("id, record_id, value, field_id")
    .eq("referenced_record_id", recordId);

  if (error) throw new Error(error.message);
  if (!refs?.length) return [];

  const recordIds = [...new Set(refs.map((r) => r.record_id))];
  const fieldIds = [...new Set(refs.map((r) => r.field_id))];

  const [{ data: records }, { data: fields }] = await Promise.all([
    supabase.from("app_records").select("id, app_id").in("id", recordIds),
    supabase.from("app_fields").select("id, label").in("id", fieldIds),
  ]);

  const appIds = [...new Set((records ?? []).map((r) => r.app_id))];
  const { data: apps } = appIds.length
    ? await supabase.from("apps").select("id, name").in("id", appIds)
    : { data: [] as { id: string; name: string }[] };

  const recordAppMap = new Map((records ?? []).map((r) => [r.id, r.app_id]));
  const appNameMap = new Map((apps ?? []).map((a) => [a.id, a.name]));
  const fieldLabelMap = new Map((fields ?? []).map((f) => [f.id, f.label]));

  return refs.map((row) => {
    const refAppId = recordAppMap.get(row.record_id);
    return {
      value_id: row.id,
      record_id: row.record_id,
      app_name: refAppId ? (appNameMap.get(refAppId) ?? "不明なアプリ") : "不明なアプリ",
      field_label: fieldLabelMap.get(row.field_id) ?? "検索フィールド",
      display_value: row.value || "（値なし）",
    };
  });
}

export async function GET(_req: Request, context: RouteContext) {
  const { appId, recordId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const record = await verifyRecordAccess(supabase, appId, recordId);
  if (!record) {
    return NextResponse.json({ error: "レコードが見つかりません" }, { status: 404 });
  }

  try {
    const references = await fetchRecordReferences(supabase, recordId);
    return NextResponse.json({ references, count: references.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "参照情報の取得に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  const { appId, recordId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const record = await verifyRecordAccess(supabase, appId, recordId);
  if (!record) {
    return NextResponse.json({ error: "レコードが見つかりません" }, { status: 404 });
  }

  const body = await req.json();
  const values = body.values as Array<{
    field_id: string;
    value: string;
    referenced_record_id?: string | null;
  }> | undefined;

  if (!values?.length) {
    return NextResponse.json({ error: "更新データがありません" }, { status: 400 });
  }

  const rows = values.map((v) => ({
    record_id: recordId,
    field_id: v.field_id,
    value: v.value ?? "",
    referenced_record_id: v.referenced_record_id ?? null,
  }));

  const { error } = await supabase
    .from("app_record_values")
    .upsert(rows, { onConflict: "record_id,field_id" });

  if (error) {
    const hint = error.message.includes("referenced_record_id")
      ? "（007_record_references.sql のマイグレーション未実行の可能性があります）"
      : "";
    return NextResponse.json({ error: `${error.message}${hint}` }, { status: 500 });
  }

  await supabase
    .from("app_records")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", recordId);

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, context: RouteContext) {
  const { appId, recordId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const record = await verifyRecordAccess(supabase, appId, recordId);
  if (!record) {
    return NextResponse.json({ error: "レコードが見つかりません" }, { status: 404 });
  }

  const { data: refs } = await supabase
    .from("app_record_values")
    .select("id")
    .eq("referenced_record_id", recordId);

  const clearedCount = refs?.length ?? 0;

  if (clearedCount > 0) {
    const { error: clearError } = await supabase
      .from("app_record_values")
      .update({ value: "", referenced_record_id: null })
      .eq("referenced_record_id", recordId);

    if (clearError) {
      return NextResponse.json({ error: clearError.message }, { status: 500 });
    }
  }

  const { error: deleteError } = await supabase
    .from("app_records")
    .delete()
    .eq("id", recordId)
    .eq("app_id", appId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, cleared_references: clearedCount });
}
