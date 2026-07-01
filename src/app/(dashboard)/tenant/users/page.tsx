import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { TenantUserManager } from "@/components/users/TenantUserManager";

export default async function TenantUsersPage() {
  const profile = await getCurrentProfile();
  if (!profile?.tenant_id) {
    redirect("/");
  }

  const supabase = await createClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name")
    .eq("id", profile.tenant_id)
    .single();

  if (!tenant) redirect("/");

  return (
    <TenantUserManager
      tenantId={tenant.id}
      tenantName={tenant.name}
    />
  );
}
