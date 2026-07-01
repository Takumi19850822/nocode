import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const tenantId = String(body.tenantId ?? "");
  if (!tenantId) {
    return NextResponse.json({ error: "tenantId は必須です" }, { status: 400 });
  }

  // 在籍確認
  const { data: membership } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json(
      { error: "このテナントに所属していません" },
      { status: 403 }
    );
  }

  const { error } = await supabase
    .from("profiles")
    .update({ active_tenant_id: tenantId })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
