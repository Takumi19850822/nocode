"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Card";
import type { AppRecordExportListItem } from "@/lib/exports/parseExportRow";
import type { AppRecordExport } from "@/types";
import { Download } from "lucide-react";

const STATUS_LABELS: Record<AppRecordExport["status"], string> = {
  pending: "待機中",
  processing: "生成中",
  completed: "完了",
  failed: "失敗",
};

const STATUS_VARIANT: Record<
  AppRecordExport["status"],
  "default" | "success" | "warning" | "danger"
> = {
  pending: "default",
  processing: "warning",
  completed: "success",
  failed: "danger",
};

interface ExportListTableProps {
  exports: AppRecordExportListItem[];
  onDownload: (item: AppRecordExportListItem) => void;
  /** true: アプリ名を先頭列に表示（テナント全体一覧） */
  showAppName?: boolean;
}

export function ExportListTable({
  exports,
  onDownload,
  showAppName = true,
}: ExportListTableProps) {
  if (exports.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-8">まだ出力履歴がありません</p>
    );
  }

  return (
    <div className="scroll-table-wrap">
      <table className="scroll-table text-sm">
        <thead>
          <tr>
            {showAppName && <th>アプリ</th>}
            <th>ファイル名</th>
            <th>件数</th>
            <th>状態</th>
            <th>作成日時</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {exports.map((item) => (
            <tr key={item.id}>
              {showAppName && (
                <td className="font-medium" data-label="アプリ">
                  <Link href={`/apps/${item.app_id}`}>
                    {item.app_name}
                  </Link>
                </td>
              )}
              <td data-label="ファイル名">{item.file_name}</td>
              <td data-label="件数">
                {item.row_count != null ? `${item.row_count}件` : "-"}
              </td>
              <td data-label="状態">
                <Badge variant={STATUS_VARIANT[item.status]}>
                  {STATUS_LABELS[item.status]}
                </Badge>
                {item.status === "failed" && item.error_message && (
                  <p className="text-xs text-red-500 mt-1 max-w-xs break-words">
                    {item.error_message}
                  </p>
                )}
              </td>
              <td className="text-gray-500 whitespace-nowrap" data-label="作成日時">
                {new Date(item.created_at).toLocaleString("ja-JP")}
              </td>
              <td data-label="操作">
                {item.status === "completed" ? (
                  <button
                    type="button"
                    onClick={() => onDownload(item)}
                    className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-900 transition-colors text-sm"
                  >
                    <Download className="w-4 h-4" />
                    DL
                  </button>
                ) : (
                  <span className="text-gray-400 text-sm">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
