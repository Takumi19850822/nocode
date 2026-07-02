import type { AppField, AppView, TableViewConfig, ViewConfig } from "@/types";
import { getListDisplayFields } from "../records/getListDisplayFields";

/** テーブルビューの表示フィールドを解決 */
export function getViewDisplayFields(
  fields: AppField[],
  config: TableViewConfig
): AppField[] {
  if (config.field_ids.length === 0) {
    return fields.slice(0, 5);
  }
  const fieldMap = new Map(fields.map((f) => [f.id, f]));
  return config.field_ids.map((id) => fieldMap.get(id)).filter((f): f is AppField => f != null);
}

/** list_field_ids からデフォルトのテーブルビュー設定を生成 */
export function defaultTableViewConfig(listFieldIds: string[]): TableViewConfig {
  return { type: "table", field_ids: listFieldIds ?? [] };
}

/** ビュー未設定時のフォールバック表示フィールド */
export function getFallbackListFields(
  fields: AppField[],
  listFieldIds: string[]
): AppField[] {
  return getListDisplayFields(fields, listFieldIds);
}

/** カンバン列の option value 順序 */
export function getKanbanColumnOrder(
  statusField: AppField,
  optionOrder?: string[]
): string[] {
  const defined = statusField.options.map((o) => o.value);
  if (!optionOrder?.length) return defined;
  const ordered = optionOrder.filter((v) => defined.includes(v));
  const rest = defined.filter((v) => !ordered.includes(v));
  return [...ordered, ...rest];
}

/** 日付文字列を Date に（失敗時 null） */
export function parseRecordDate(raw: string | undefined): Date | null {
  if (!raw?.trim()) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

export function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return startOfDay(addDays(d, diff));
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isViewConfigTable(config: ViewConfig): config is TableViewConfig {
  return config.type === "table";
}

export function viewTypeLabel(view: AppView): string {
  return view.name;
}
