import {
  PageBody,
  PageFrame,
  PageHeader,
} from "@/components/layout/PageLayout";

export default function AdminSettingsPage() {
  return (
    <PageFrame>
      <PageHeader title="システム設定" description="Admin > 設定" />
      <PageBody>
        <p className="text-gray-500">システム全体の設定項目は今後追加予定です。</p>
      </PageBody>
    </PageFrame>
  );
}
