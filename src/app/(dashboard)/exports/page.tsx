"use client";

import { useCallback, useEffect, useState } from "react";
import {
  PageBody,
  PageFrame,
  PageHeader,
  PageSection,
} from "@/components/layout/PageLayout";
import { ExportListTable } from "@/components/records/ExportListTable";
import type { AppRecordExportListItem } from "@/lib/exports/parseExportRow";

export default function ExportsPage() {
  const [exports, setExports] = useState<AppRecordExportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadExports = useCallback(async () => {
    const res = await fetch("/api/exports");
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "一覧の取得に失敗しました");
      return;
    }
    setExports(body.exports ?? []);
    setError("");
  }, []);

  useEffect(() => {
    loadExports().finally(() => setLoading(false));
  }, [loadExports]);

  async function downloadExport(item: AppRecordExportListItem) {
    const res = await fetch(`/api/apps/${item.app_id}/exports/${item.id}/download`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "ダウンロードに失敗しました");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = item.file_name;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <p className="text-gray-500">読み込み中...</p>;
  }

  return (
    <PageFrame>
      <PageHeader
        title="Excel 出力"
        description="テナント内の Excel 出力履歴です。新規出力は各アプリの出力画面から行えます。"
      />

      <PageBody>
        {error && <p className="text-sm text-red-600">{error}</p>}

        <PageSection title="Excel 出力一覧">
          <ExportListTable exports={exports} onDownload={downloadExport} showAppName />
        </PageSection>

        <p className="text-xs text-gray-500">
          新規出力する場合は、左メニューのアプリ名からレコード一覧を開き、「Excel出力」ボタンをご利用ください。
        </p>
      </PageBody>
    </PageFrame>
  );
}
