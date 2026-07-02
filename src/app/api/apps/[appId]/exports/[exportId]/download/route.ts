import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin";
import { EXPORT_STORAGE_BUCKET, exportStoragePath } from "@/lib/exports/generateXlsx";
import { verifyAppAccess } from "@/lib/exports/verifyAppAccess";

type RouteContext = { params: Promise<{ appId: string; exportId: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const { appId, exportId } = await context.params;
  const supabase = await createClient();
  const auth = await verifyAppAccess(supabase, appId);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!hasAdminClient()) {
    return NextResponse.json(
      { error: "SUPABASE_SECRET_KEY が未設定のためダウンロードできません" },
      { status: 500 }
    );
  }

  const { data: exportRow, error } = await supabase
    .from("app_record_exports")
    .select("*")
    .eq("id", exportId)
    .eq("app_id", appId)
    .single();

  if (error || !exportRow) {
    return NextResponse.json({ error: "エクスポートが見つかりません" }, { status: 404 });
  }

  if (exportRow.status !== "completed" || !exportRow.storage_path) {
    return NextResponse.json(
      { error: "ファイルの準備ができていません" },
      { status: 409 }
    );
  }

  const expectedPath = exportStoragePath(auth.app.tenant_id, appId, exportId);
  if (exportRow.storage_path !== expectedPath) {
    return NextResponse.json({ error: "不正なファイルパスです" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: fileData, error: downloadError } = await admin.storage
    .from(EXPORT_STORAGE_BUCKET)
    .download(exportRow.storage_path);

  if (downloadError || !fileData) {
    return NextResponse.json(
      { error: downloadError?.message ?? "ファイルの取得に失敗しました" },
      { status: 500 }
    );
  }

  const fileName = exportRow.file_name as string;
  const encoded = encodeURIComponent(fileName);

  return new NextResponse(fileData, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`,
    },
  });
}
