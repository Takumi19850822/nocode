import { NextResponse } from "next/server";
import { canAssignRole, canManageTenantAdmins, requireTenantManager } from "@/lib/auth/permissions";
import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/passwordPolicy";
import type { UserRole } from "@/types";
type RouteContext = { params: Promise<{ tenantId: string }> };

type MemberRow = {
  role: UserRole;
  is_active: boolean;
  profiles: { id: string; email: string; display_name: string } | { id: string; email: string; display_name: string }[] | null;
};

export async function GET(_req: Request, context: RouteContext) {
  const { tenantId } = await context.params;
  const auth = await requireTenantManager(tenantId);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenant_members")
    .select("role, is_active, profiles(id, email, display_name)")
    .eq("tenant_id", tenantId)
    .order("created_at");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const users = ((data as MemberRow[] | null) ?? []).flatMap((m) => {
    const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    if (!p) return [];
    return [
      {
        id: p.id,
        email: p.email,
        display_name: p.display_name,
        role: m.role,
        is_active: m.is_active,
      },
    ];
  });

  return NextResponse.json({
    users,
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
  const email = String(body.email ?? "").trim().toLowerCase();
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
  const admin = hasAdminClient() ? createAdminClient() : null;
  // 書き込みは可能なら service role（RLS/トリガーはサービスロールを信頼）
  const writeClient = admin ?? supabase;

  // 既存プロフィールをメール検索（admin があれば全ユーザー横断で検索可能）
  const lookupClient = admin ?? supabase;
  const { data: existingProfile } = await lookupClient
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  let userId: string;
  let created = false;

  if (existingProfile) {
    userId = existingProfile.id;
    if (displayName) {
      await writeClient.from("profiles").update({ display_name: displayName }).eq("id", userId);
    }
  } else {
    // 新規ユーザー作成には secret key が必要
    if (!admin) {
      return NextResponse.json(
        {
          error:
            "新規ユーザー作成には SUPABASE_SECRET_KEY の設定が必要です。既存ユーザーのみ追加できます。",
        },
        { status: 503 }
      );
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `パスワードは${MIN_PASSWORD_LENGTH}文字以上必要です` },
        { status: 400 }
      );
    }

    const { data: createdUser, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });
    if (createErr || !createdUser.user) {
      return NextResponse.json(
        { error: createErr?.message ?? "ユーザー作成に失敗しました" },
        { status: 500 }
      );
    }
    userId = createdUser.user.id;
    created = true;
    await admin.from("profiles").update({ display_name: displayName }).eq("id", userId);
  }

  // メンバーシップを追加（既存なら role / 有効化を更新）
  const { error: memberErr } = await writeClient
    .from("tenant_members")
    .upsert(
      { user_id: userId, tenant_id: tenantId, role, is_active: true },
      { onConflict: "user_id,tenant_id" }
    );

  if (memberErr) {
    return NextResponse.json({ error: memberErr.message }, { status: 500 });
  }

  return NextResponse.json({ userId, created });
}
