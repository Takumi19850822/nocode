import {
  PageBody,
  PageFrame,
  PageHeader,
} from "@/components/layout/PageLayout";

export default function TenantSettingsPage() {
  return (
    <PageFrame>
      <PageHeader title="テナント設定" description="テナント > 設定" />
      <PageBody>
        <p className="text-gray-500">テナント固有の設定項目は今後追加予定です。</p>
      </PageBody>
    </PageFrame>
  );
}
