import { NextResponse } from "next/server";
import { canAssignRole, requireTenantManager } from "@/lib/auth/permissions";
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
  const displayName = body.display_name !== undefined ? String(body.display_name).trim() : undefined;
  const role = body.role as UserRole | undefined;
  const isActive = body.is_active as boolean | undefined;

  const supabase = await createClient();

  const { data: target } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .eq("tenant_id", tenantId)
    .single();

  if (!target) {
    return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
  }

  if (role && !canAssignRole(auth.profile, role, tenantId)) {
    return NextResponse.json({ error: "このロールは設定できません" }, { status: 403 });
  }

  if (displayName !== undefined && !displayName) {
    return NextResponse.json({ error: "氏名は必須です" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (displayName !== undefined) updates.display_name = displayName;
  if (role !== undefined) updates.role = role;
  if (isActive !== undefined) updates.is_active = isActive;

  const { error } = await supabase.from("profiles").update(updates).eq("id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
