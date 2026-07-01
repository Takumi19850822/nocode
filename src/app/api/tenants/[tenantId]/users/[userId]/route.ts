import { NextResponse } from "next/server";
import { canAssignRole, requireTenantManager } from "@/lib/auth/permissions";
import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types";
type RouteContext = {
  params: Promise<{ tenantId: string; userId: string }>;
};

export async function PATCH(req: Request, context: RouteContext) {
  const { tenantId, userId } = await context.params;
  const auth = await requireTenantManager(tenantId);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json();
  const displayName =
    body.display_name !== undefined ? String(body.display_name).trim() : undefined;
  const role = body.role as UserRole | undefined;
  const isActive = body.is_active as boolean | undefined;

  const supabase = await createClient();
  const writeClient = hasAdminClient() ? createAdminClient() : supabase;

  // 対象がこのテナントの在籍者か確認
  const { data: target } = await supabase
    .from("tenant_members")
    .select("role, is_active")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
  }

  if (role && !canAssignRole(auth.profile, role, tenantId)) {
    return NextResponse.json({ error: "このロールは設定できません" }, { status: 403 });
  }

  if (displayName !== undefined && !displayName) {
    return NextResponse.json({ error: "氏名は必須です" }, { status: 400 });
  }

  // メンバーシップ側（role / is_active）
  const memberUpdates: Record<string, unknown> = {};
  if (role !== undefined) memberUpdates.role = role;
  if (isActive !== undefined) memberUpdates.is_active = isActive;
  if (Object.keys(memberUpdates).length > 0) {
    const { error } = await writeClient
      .from("tenant_members")
      .update(memberUpdates)
      .eq("tenant_id", tenantId)
      .eq("user_id", userId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // プロフィール側（氏名）
  if (displayName !== undefined) {
    const { error } = await writeClient
      .from("profiles")
      .update({ display_name: displayName })
      .eq("id", userId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, context: RouteContext) {
  const { tenantId, userId } = await context.params;
  const auth = await requireTenantManager(tenantId);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = await createClient();
  const writeClient = hasAdminClient() ? createAdminClient() : supabase;

  const { error } = await writeClient
    .from("tenant_members")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
