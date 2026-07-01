import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TenantAppsManager } from "@/components/apps/TenantAppsManager";

export default async function AdminTenantAppsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name")
    .eq("id", id)
    .single();

  if (!tenant) notFound();

  return (
    <TenantAppsManager
      tenantId={tenant.id}
      tenantName={tenant.name}
      backHref="/admin/tenants"
    />
  );
}
