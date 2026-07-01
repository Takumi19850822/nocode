import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin";
import { fetchAllRecordValues } from "@/lib/exports/fetchExportData";
import {
  buildExportFileName,
  buildRecordExportXlsx,
  EXPORT_STORAGE_BUCKET,
  exportStoragePath,
} from "@/lib/exports/generateXlsx";
import { verifyAppAccess } from "@/lib/exports/verifyAppAccess";
import { parseExportRow } from "@/lib/exports/parseExportRow";
import type { AppField } from "@/types";

type RouteContext = { params: Promise<{ appId: string }> };

/** エクスポート履歴一覧（アプリ単位） */
export async function GET(_req: Request, context: RouteContext) {
  const { appId } = await context.params;
  const supabase = await createClient();
  const auth = await verifyAppAccess(supabase, appId);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data, error } = await supabase
    .from("app_record_exports")
    .select("*")
    .eq("app_id", appId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    const hint = error.message.includes("app_record_exports")
      ? "（011_record_exports.sql のマイグレーション未実行の可能性があります）"
      : "";
    return NextResponse.json({ error: `${error.message}${hint}` }, { status: 500 });
  }

  return NextResponse.json({
    exports: (data ?? []).map(parseExportRow),
  });
}

/** エクスポート生成 */
export async function POST(req: Request, context: RouteContext) {
  const { appId } = await context.params;
  const supabase = await createClient();
  const auth = await verifyAppAccess(supabase, appId);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!hasAdminClient()) {
    return NextResponse.json(
      { error: "SUPABASE_SECRET_KEY が未設定のためエクスポートできません" },
      { status: 500 }
    );
  }

  const body = await req.json();
  const fieldIds = body.field_ids as string[] | undefined;
  const includeCreatedAt = body.include_created_at !== false;
  const includeUpdatedAt = Boolean(body.include_updated_at);

  if (!fieldIds?.length) {
    return NextResponse.json({ error: "出力項目を1つ以上選択してください" }, { status: 400 });
  }

  const { data: fieldsData, error: fieldsError } = await supabase
    .from("app_fields")
    .select("*")
    .eq("app_id", appId)
    .order("sort_order");

  if (fieldsError) {
    return NextResponse.json({ error: fieldsError.message }, { status: 500 });
  }

  const fields = (fieldsData as AppField[] | null) ?? [];
  const validIds = new Set(fields.map((f) => f.id));
  const filteredFieldIds = fieldIds.filter((id) => validIds.has(id));
  if (filteredFieldIds.length === 0) {
    return NextResponse.json({ error: "有効な出力項目がありません" }, { status: 400 });
  }

  const fileName = buildExportFileName(auth.app.name);

  const { data: exportRow, error: insertError } = await supabase
    .from("app_record_exports")
    .insert({
      app_id: appId,
      tenant_id: auth.app.tenant_id,
      created_by: auth.user.id,
      field_ids: filteredFieldIds,
      include_created_at: includeCreatedAt,
      include_updated_at: includeUpdatedAt,
      file_name: fileName,
      status: "processing",
    })
    .select("*")
    .single();

  if (insertError || !exportRow) {
    const hint = insertError?.message.includes("app_record_exports")
      ? "（011_record_exports.sql のマイグレーション未実行の可能性があります）"
      : "";
    return NextResponse.json(
      { error: `${insertError?.message ?? "エクスポートの作成に失敗しました"}${hint}` },
      { status: 500 }
    );
  }

  const exportId = exportRow.id as string;
  const storagePath = exportStoragePath(auth.app.tenant_id, appId, exportId);

  try {
    const { records, valuesByRecord } = await fetchAllRecordValues(supabase, appId);
    const buffer = await buildRecordExportXlsx(fields, records, valuesByRecord, {
      fieldIds: filteredFieldIds,
      includeCreatedAt,
      includeUpdatedAt,
    });

    const admin = createAdminClient();
    const { error: uploadError } = await admin.storage
      .from(EXPORT_STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(
        uploadError.message.includes("Bucket not found")
          ? "Storage バケット record-exports がありません（011 マイグレーションを実行してください）"
          : uploadError.message
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from("app_record_exports")
      .update({
        status: "completed",
        storage_path: storagePath,
        row_count: records.length,
        completed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", exportId)
      .select("*")
      .single();

    if (updateError || !updated) {
      throw new Error(updateError?.message ?? "ステータス更新に失敗しました");
    }

    return NextResponse.json({ export: parseExportRow(updated) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "エクスポートに失敗しました";
    await supabase
      .from("app_record_exports")
      .update({ status: "failed", error_message: message })
      .eq("id", exportId);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
