import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Card";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import {
  PageBody,
  PageFrame,
  PageHeader,
  PageSection,
} from "@/components/layout/PageLayout";
import { getProfileDisplayName } from "@/lib/auth/profileDisplayName";
import type { UserRole } from "@/types";

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "スーパー管理者",
  tenant_admin: "テナント管理者",
  user: "一般ユーザー",
};

export default async function HomePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const roleLabel = ROLE_LABELS[profile.role as UserRole];

  return (
    <PageFrame>
      <PageHeader
        title="ダッシュボード"
        description={`ようこそ、${getProfileDisplayName(profile) || "（氏名未設定）"} さん`}
      />

      <PageBody>
        <PageSection title="アカウント情報">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-gray-500">メール</dt>
              <dd className="font-medium">{profile.email}</dd>
            </div>
            <div>
              <dt className="text-gray-500">ロール</dt>
              <dd>
                <Badge variant={profile.role === "super_admin" ? "warning" : "default"}>
                  {roleLabel}
                </Badge>
              </dd>
            </div>
          </dl>
        </PageSection>

        {(profile.role === "super_admin" || profile.role === "tenant_admin") && (
          <PageSection title="クイックリンク" bordered>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {profile.role === "super_admin" && (
                <QuickLink
                  href="/admin/tenants"
                  title="テナント管理"
                  description="テナントの作成・編集・削除"
                />
              )}
              {(profile.role === "tenant_admin" || profile.role === "super_admin") && (
                <>
                  <QuickLink
                    href="/tenant/apps"
                    title="アプリ管理"
                    description="ノーコードアプリの設計・設定"
                  />
                  <QuickLink
                    href="/tenant/users"
                    title="ユーザー管理"
                    description="テナント内ユーザーの追加・管理"
                  />
                </>
              )}
            </div>
          </PageSection>
        )}
      </PageBody>
    </PageFrame>
  );
}

function QuickLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
      <Link href={href} className="inline-block mt-4">
        <Button size="sm">開く</Button>
      </Link>
    </div>
  );
}
