import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TenantUserManager } from "@/components/users/TenantUserManager";

export default async function AdminTenantUsersPage({
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
    <TenantUserManager
      tenantId={tenant.id}
      tenantName={tenant.name}
      backHref="/admin/tenants"
    />
  );
}
