import type { AppField } from "@/types";

const DEFAULT_LIST_COUNT = 5;

/** 一覧表示用フィールドを解決（未設定時は先頭5件） */
export function getListDisplayFields(
  allFields: AppField[],
  listFieldIds: string[] | null | undefined
): AppField[] {
  const ids = listFieldIds ?? [];
  if (ids.length === 0) {
    return allFields.slice(0, DEFAULT_LIST_COUNT);
  }
  const fieldMap = new Map(allFields.map((f) => [f.id, f]));
  return ids.map((id) => fieldMap.get(id)).filter((f): f is AppField => f != null);
}

/** 保存前に存在しないフィールドIDを除外 */
export function sanitizeListFieldIds(
  listFieldIds: string[],
  fields: AppField[]
): string[] {
  const validIds = new Set(fields.map((f) => f.id));
  return listFieldIds.filter((id) => validIds.has(id));
}
