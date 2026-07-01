import { NextResponse } from "next/server";
import { canAssignRole, canManageTenantAdmins, requireTenantManager } from "@/lib/auth/permissions";
import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types";
type RouteContext = { params: Promise<{ tenantId: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const { tenantId } = await context.params;
  const auth = await requireTenantManager(tenantId);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    users: data ?? [],
    canCreateUsers: hasAdminClient(),
    canManageTenantAdmins: canManageTenantAdmins(auth.profile),
  });
}

export async function POST(req: Request, context: RouteContext) {
  const { tenantId } = await context.params;
  const auth = await requireTenantManager(tenantId);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json();
  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");
  const displayName = String(body.display_name ?? "").trim();
  const role = (body.role ?? "user") as UserRole;

  if (!email) {
    return NextResponse.json({ error: "メールアドレスは必須です" }, { status: 400 });
  }
  if (!displayName) {
    return NextResponse.json({ error: "氏名は必須です" }, { status: 400 });
  }
  if (!canAssignRole(auth.profile, role, tenantId)) {
    return NextResponse.json({ error: "このロールは設定できません" }, { status: 403 });
  }

  const supabase = await createClient();

  // 既存ユーザーをテナントに追加
  const { data: existing } = await supabase
    .from("profiles")
    .select("id, email, tenant_id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("profiles")
      .update({
        tenant_id: tenantId,
        role,
        display_name: displayName,
      })
      .eq("id", existing.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ userId: existing.id, created: false });
  }

  // 新規ユーザー作成（secret key 必須）
  if (!hasAdminClient()) {
    return NextResponse.json(
      {
        error:
          "新規ユーザー作成には SUPABASE_SECRET_KEY の設定が必要です。.env を確認してください。",
      },
      { status: 503 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "パスワードは8文字以上必要です" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });

  if (createErr || !created.user) {
    return NextResponse.json(
      { error: createErr?.message ?? "ユーザー作成に失敗しました" },
      { status: 500 }
    );
  }

  const { error: profileErr } = await admin
    .from("profiles")
    .update({
      tenant_id: tenantId,
      role,
      display_name: displayName,
    })
    .eq("id", created.user.id);

  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  return NextResponse.json({ userId: created.user.id, created: true });
}
