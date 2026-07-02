import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/permissions";
import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ userId: string }> };

export async function POST(req: Request, context: RouteContext) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!hasAdminClient()) {
    return NextResponse.json(
      { error: "SUPABASE_SECRET_KEY が未設定のため、スーパー管理者の付与ができません。" },
      { status: 503 }
    );
  }

  const { userId } = await context.params;
  const body = await req.json();
  const action = body.action as "grant" | "revoke" | undefined;

  if (action !== "grant" && action !== "revoke") {
    return NextResponse.json({ error: "action は grant または revoke を指定してください" }, { status: 400 });
  }

  if (action === "revoke" && userId === auth.profile.id) {
    return NextResponse.json({ error: "自分自身のスーパー管理者権限は解除できません" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: target, error: fetchError } = await supabase
    .from("profiles")
    .select("id, email, role")
    .eq("id", userId)
    .single();

  if (fetchError || !target) {
    return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
  }

  if (action === "grant" && target.role === "super_admin") {
    return NextResponse.json({ error: "既にスーパー管理者です" }, { status: 400 });
  }

  if (action === "revoke" && target.role !== "super_admin") {
    return NextResponse.json({ error: "スーパー管理者ではありません" }, { status: 400 });
  }

  if (action === "revoke") {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "super_admin");

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "最後のスーパー管理者は解除できません" },
        { status: 400 }
      );
    }
  }

  const admin = createAdminClient();
  const newRole = action === "grant" ? "super_admin" : "user";
  const { error: updateError } = await admin
    .from("profiles")
    .update({
      role: newRole,
      ...(action === "grant" ? { tenant_id: null } : {}),
    })
    .eq("id", userId);

  if (updateError) {
    const hint = updateError.message.includes("protect_profile")
      ? "（013_super_admin_grant.sql のマイグレーション未実行の可能性があります）"
      : "";
    return NextResponse.json({ error: `${updateError.message}${hint}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    role: newRole,
    email: target.email,
  });
}
