import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/server";
import { parseExportListRow } from "@/lib/exports/parseExportRow";

/** テナント内の Excel 出力一覧（アプリ名付き） */
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (profile.globalRole !== "super_admin" && !profile.active_tenant_id) {
    return NextResponse.json(
      { error: "作業中テナントが設定されていません" },
      { status: 403 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_record_exports")
    .select("*, apps(name)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    const hint = error.message.includes("app_record_exports")
      ? "（011_record_exports.sql のマイグレーション未実行の可能性があります）"
      : "";
    return NextResponse.json({ error: `${error.message}${hint}` }, { status: 500 });
  }

  return NextResponse.json({
    exports: (data ?? []).map(parseExportListRow),
  });
}
