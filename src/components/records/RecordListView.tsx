"use client";

import Link from "next/link";
import { formatFieldDisplayValue } from "@/lib/records/formatFieldValue";
import { Pagination } from "@/components/ui/Pagination";
import type { AppField, AppRecord } from "@/types";
import { Eye, Trash2 } from "lucide-react";

interface RecordListViewProps {
  appId: string;
  records: AppRecord[];
  fields: AppField[];
  valuesByRecord: Record<string, Record<string, string>>;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onDelete: (recordId: string) => void;
}

export function RecordListView({
  appId,
  records,
  fields,
  valuesByRecord,
  page,
  pageSize,
  onPageChange,
  onDelete,
}: RecordListViewProps) {
  const pagedRecords = records.slice((page - 1) * pageSize, page * pageSize);

  if (records.length === 0) {
    return <p className="text-gray-400 text-center py-8">レコードがありません</p>;
  }

  return (
    <div>
      <div className="scroll-table-wrap">
        <table className="scroll-table text-sm">
          <thead>
            <tr>
              {fields.map((f) => (
                <th key={f.id}>{f.label}</th>
              ))}
              <th>作成日</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {pagedRecords.map((record) => (
              <RecordRow
                key={record.id}
                appId={appId}
                record={record}
                fields={fields}
                values={valuesByRecord[record.id] ?? {}}
                onDelete={() => onDelete(record.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        pageSize={pageSize}
        total={records.length}
        onPageChange={onPageChange}
      />
    </div>
  );
}

function RecordRow({
  appId,
  record,
  fields,
  values,
  onDelete,
}: {
  appId: string;
  record: AppRecord;
  fields: AppField[];
  values: Record<string, string>;
  onDelete: () => void;
}) {
  const detailHref = `/apps/${appId}/records/${record.id}`;

  return (
    <tr>
      {fields.map((f) => (
        <td key={f.id}>
          <Link href={detailHref}>{formatFieldDisplayValue(f, values[f.id])}</Link>
        </td>
      ))}
      <td className="text-gray-500">
        <Link href={detailHref}>
          {new Date(record.created_at).toLocaleDateString("ja-JP")}
        </Link>
      </td>
      <td>
        <div className="flex items-center gap-0.5">
          <Link
            href={detailHref}
            className="inline-flex items-center justify-center w-7 h-7 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            title="詳細"
          >
            <Eye className="w-4 h-4" />
          </Link>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center justify-center w-7 h-7 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="削除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
