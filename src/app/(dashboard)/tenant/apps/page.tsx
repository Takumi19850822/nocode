import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { TenantAppsManager } from "@/components/apps/TenantAppsManager";
import { Button } from "@/components/ui/Button";
import {
  PageBody,
  PageFrame,
  PageHeader,
  PageSection,
} from "@/components/layout/PageLayout";

export default async function TenantAppsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  if (profile.role === "super_admin" && !profile.tenant_id) {
    const supabase = await createClient();
    const { data: tenants } = await supabase
      .from("tenants")
      .select("id, name")
      .order("name");

    return (
      <PageFrame>
        <PageHeader
          title="アプリ管理"
          description="スーパー管理者はテナントごとにアプリを管理します"
        />

        <PageBody>
          <PageSection title="テナントを選択">
            <p className="text-sm text-gray-500 mb-4">
              super_admin は特定テナントに所属しません。管理したいテナントのアプリ画面を開いてください。
            </p>
            {tenants && tenants.length > 0 ? (
              <ul className="space-y-2">
                {tenants.map((t) => (
                  <li key={t.id}>
                    <Link href={`/admin/tenants/${t.id}/apps`}>
                      <Button variant="secondary" size="sm">
                        {t.name} のアプリ管理
                      </Button>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400 text-sm">
                テナントがありません。Admin → テナント管理 から作成してください。
              </p>
            )}
          </PageSection>
        </PageBody>
      </PageFrame>
    );
  }

  if (!profile.tenant_id) redirect("/");

  const supabase = await createClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name")
    .eq("id", profile.tenant_id)
    .single();

  if (!tenant) redirect("/");

  return <TenantAppsManager tenantId={tenant.id} tenantName={tenant.name} />;
}
