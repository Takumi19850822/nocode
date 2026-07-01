export type UserRole = "super_admin" | "tenant_admin" | "user";

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "datetime"
  | "duration"
  | "select"
  | "radio"
  | "checkbox"
  | "search"
  | "calculation"
  | "login_user";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  tenant_id: string | null;
  active_tenant_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** ユーザーの1テナントへの所属（テナントごとにロールを持つ） */
export interface TenantMembership {
  tenant_id: string;
  tenant_name: string;
  role: UserRole;
  is_active: boolean;
}

/**
 * ログイン中ユーザーの実効セッション情報。
 * role / tenant_id は「現在作業中(active)テナント」での実効値（super_admin は据え置き）。
 */
export interface SessionProfile extends Profile {
  memberships: TenantMembership[];
}

export interface App {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
  /** レコード一覧に表示するフィールドID（表示順）。空の場合は先頭5件 */
  list_field_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface FieldOption {
  label: string;
  value: string;
}

/** 検索フィールド設定 */
export interface SearchFieldConfig {
  source_app_id: string;
  source_field_id: string;
  display_field_id: string;
  mappings: SearchFieldMapping[];
}

export interface SearchFieldMapping {
  source_field_id: string;
  target_field_id: string;
}

/** 計算フィールド設定 */
export interface CalculationFieldConfig {
  expression: string;
  tokens: CalculationToken[];
}

/** 日付フィールド設定 */
export interface DateFieldConfig {
  default_to_today?: boolean;
}

/** 数値フィールド設定 */
export interface NumberFieldConfig {
  use_comma_separator?: boolean;
}

export type FieldConfig =
  | SearchFieldConfig
  | CalculationFieldConfig
  | DateFieldConfig
  | NumberFieldConfig
  | Record<string, unknown>;

export type CalculationToken =
  | { type: "field"; field_id: string; field_name: string }
  | { type: "operator"; value: "+" | "-" | "*" | "/" | "(" | ")" }
  | { type: "number"; value: number };

export interface AppField {
  id: string;
  app_id: string;
  name: string;
  label: string;
  field_type: FieldType;
  is_required: boolean;
  sort_order: number;
  width: number;
  placeholder: string;
  default_value: string;
  options: FieldOption[];
  config: FieldConfig;
  created_at: string;
  updated_at: string;
}

export interface AppRecord {
  id: string;
  app_id: string;
  tenant_id: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppRecordValue {
  id: string;
  record_id: string;
  field_id: string;
  value: string;
  referenced_record_id: string | null;
}

/** 他レコードからの参照情報（削除確認用） */
export interface RecordReference {
  value_id: string;
  record_id: string;
  app_name: string;
  field_label: string;
  display_value: string;
}

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "テキスト（1行）",
  textarea: "テキスト（複数行）",
  number: "数値",
  date: "日付",
  datetime: "日時",
  duration: "所要時間",
  select: "プルダウン",
  radio: "ラジオボタン",
  checkbox: "チェックボックス",
  search: "検索",
  calculation: "計算",
  login_user: "ログインユーザ氏名",
};

export const GRID_COLUMNS = 10;
export const FIELD_WIDTH_STEP = 10;
export const FIELD_WIDTH_MIN = 10;
export const FIELD_WIDTH_MAX = 100;

export const FIELD_WIDTH_OPTIONS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;

export type FieldWidth = (typeof FIELD_WIDTH_OPTIONS)[number];

/** 10列グリッド（10%単位）の span */
export function widthToGridSpan(width: number): number {
  return Math.max(1, Math.min(GRID_COLUMNS, Math.round(width / FIELD_WIDTH_STEP)));
}

export function snapFieldWidth(percent: number): number {
  const snapped = Math.round(percent / FIELD_WIDTH_STEP) * FIELD_WIDTH_STEP;
  return Math.max(FIELD_WIDTH_MIN, Math.min(FIELD_WIDTH_MAX, snapped));
}

export function gridSpanToWidth(span: number): number {
  return snapFieldWidth(span * FIELD_WIDTH_STEP);
}
