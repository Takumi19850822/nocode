import type { AppRecordExport } from "@/types";

export interface AppRecordExportListItem extends AppRecordExport {
  app_name: string;
}

export function parseExportRow(row: Record<string, unknown>): AppRecordExport {
  return {
    id: row.id as string,
    app_id: row.app_id as string,
    tenant_id: row.tenant_id as string,
    created_by: (row.created_by as string | null) ?? null,
    field_ids: (row.field_ids as string[]) ?? [],
    include_created_at: Boolean(row.include_created_at),
    include_updated_at: Boolean(row.include_updated_at),
    file_name: row.file_name as string,
    storage_path: (row.storage_path as string | null) ?? null,
    status: row.status as AppRecordExport["status"],
    row_count: (row.row_count as number | null) ?? null,
    error_message: (row.error_message as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    completed_at: (row.completed_at as string | null) ?? null,
  };
}

export function parseExportListRow(row: Record<string, unknown>): AppRecordExportListItem {
  const apps = row.apps as { name: string } | { name: string }[] | null | undefined;
  const appName = Array.isArray(apps) ? apps[0]?.name : apps?.name;

  return {
    ...parseExportRow(row),
    app_name: appName ?? "（不明なアプリ）",
  };
}
