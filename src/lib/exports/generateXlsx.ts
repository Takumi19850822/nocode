import ExcelJS from "exceljs";
import { formatFieldDisplayValue } from "@/lib/records/formatFieldValue";
import type { AppField, AppRecord } from "@/types";

export interface ExportBuildOptions {
  fieldIds: string[];
  includeCreatedAt: boolean;
  includeUpdatedAt: boolean;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP");
}

/** レコードデータから .xlsx バイナリを生成 */
export async function buildRecordExportXlsx(
  fields: AppField[],
  records: AppRecord[],
  valuesByRecord: Record<string, Record<string, string>>,
  options: ExportBuildOptions
): Promise<Buffer> {
  const exportFields = options.fieldIds
    .map((id) => fields.find((f) => f.id === id))
    .filter((f): f is AppField => f != null);

  const headers: string[] = exportFields.map((f) => f.label || f.name);
  if (options.includeCreatedAt) headers.push("作成日");
  if (options.includeUpdatedAt) headers.push("更新日");

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Bridge-code";
  const sheet = workbook.addWorksheet("データ");

  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE5E7EB" },
    };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
    };
  });

  for (const record of records) {
    const values = valuesByRecord[record.id] ?? {};
    const row: (string | number)[] = exportFields.map((f) =>
      formatFieldDisplayValue(f, values[f.id])
    );
    if (options.includeCreatedAt) row.push(formatDateTime(record.created_at));
    if (options.includeUpdatedAt) row.push(formatDateTime(record.updated_at));
    sheet.addRow(row);
  }

  sheet.columns.forEach((col) => {
    col.width = 18;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function buildExportFileName(appName: string): string {
  const safe = appName.replace(/[\\/:*?"<>|]/g, "_").slice(0, 40);
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${safe}_${stamp}.xlsx`;
}

export const EXPORT_STORAGE_BUCKET = "record-exports";

export function exportStoragePath(
  tenantId: string,
  appId: string,
  exportId: string
): string {
  return `${tenantId}/${appId}/${exportId}.xlsx`;
}
