import type { AppField, FieldType, FilterOperator } from "@/types";

export type FilterValueKind = "number" | "text" | "select" | "date";

/** フィールドタイプごとの絞り込みカテゴリ */
export function filterKindForFieldType(fieldType: FieldType): FilterValueKind {
  if (fieldType === "number" || fieldType === "calculation" || fieldType === "duration") {
    return "number";
  }
  if (fieldType === "date" || fieldType === "datetime") return "date";
  if (fieldType === "select" || fieldType === "radio" || fieldType === "checkbox") return "select";
  return "text";
}

export function filterKindForField(field: AppField | undefined): FilterValueKind {
  if (!field) return "text";
  return filterKindForFieldType(field.field_type);
}

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: "=（一致）",
  neq: "≠（不一致）",
  lt: "＜（より下）",
  lte: "≦（以下）",
  gt: "＞（より上）",
  gte: "≧（以上）",
  text_eq: "一致する",
  text_contains: "含む",
  text_in: "選択したものと一致",
  date_on: "その日",
  date_before: "それ以前",
  date_after: "それ以降",
  date_this_month: "今月",
  date_last_month: "先月",
  date_next_month: "来月",
};

const OPERATORS_BY_KIND: Record<FilterValueKind, FilterOperator[]> = {
  number: ["eq", "neq", "lt", "lte", "gt", "gte"],
  text: ["text_eq", "text_contains", "text_in"],
  select: ["text_eq", "text_in", "text_contains"],
  date: [
    "date_on",
    "date_before",
    "date_after",
    "date_this_month",
    "date_last_month",
    "date_next_month",
  ],
};

export function operatorsForKind(kind: FilterValueKind): { value: FilterOperator; label: string }[] {
  return OPERATORS_BY_KIND[kind].map((op) => ({ value: op, label: OPERATOR_LABELS[op] }));
}

export function operatorsForField(field: AppField | undefined): { value: FilterOperator; label: string }[] {
  return operatorsForKind(filterKindForField(field));
}

export function defaultOperatorForField(field: AppField | undefined): FilterOperator {
  return operatorsForField(field)[0]?.value ?? "text_eq";
}

/** 演算子が値入力欄を必要とするか（今月/先月/来月は不要） */
export function operatorNeedsValue(operator: FilterOperator): boolean {
  return operator !== "date_this_month" && operator !== "date_last_month" && operator !== "date_next_month";
}

/** 演算子が複数値（チェックボックス/カンマ区切り）を使うか */
export function operatorNeedsMultiValue(operator: FilterOperator): boolean {
  return operator === "text_in";
}
