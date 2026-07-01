import { stripNumberCommas } from "@/lib/utils";
import type {
  AggregationAxis,
  AggregationConfig,
  AppField,
  DateUnit,
} from "@/types";

const EMPTY_LABEL = "（空欄）";

export interface AggregationResult {
  /** 縦軸のキー（表示順） */
  rowKeys: string[];
  /** 横軸の系列キー（単純集計は1系列） */
  colKeys: string[];
  /** matrix[rowKey][colKey] = 集計値 */
  matrix: Record<string, Record<string, number>>;
}

function bucketDate(value: string, unit: DateUnit): string {
  // "YYYY-MM-DD" / "YYYY-MM-DDTHH:mm" を想定
  const ymd = value.slice(0, 10);
  if (unit === "month") return ymd.slice(0, 7); // YYYY-MM
  return ymd; // YYYY-MM-DD
}

function isDateField(field: AppField | undefined): boolean {
  return field?.field_type === "date" || field?.field_type === "datetime";
}

/** 1つの軸について、レコードの表示キーを求める */
function keyForAxis(
  axis: AggregationAxis,
  field: AppField | undefined,
  rawValue: string | undefined
): string {
  const value = (rawValue ?? "").trim();
  if (!value) return EMPTY_LABEL;

  if (isDateField(field) && axis.date_unit) {
    return bucketDate(value, axis.date_unit);
  }

  // 選択肢系はラベルに変換
  if (field && field.options.length > 0) {
    const opt = field.options.find((o) => o.value === value);
    if (opt) return opt.label;
  }

  return value;
}

function sortKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    if (a === EMPTY_LABEL) return 1;
    if (b === EMPTY_LABEL) return -1;
    return a.localeCompare(b, "ja", { numeric: true });
  });
}

/** 設定から有効な縦軸キーを最大3つ取得 */
export function getRowAxes(config: AggregationConfig): AggregationAxis[] {
  const axes = [config.row];
  if (config.row2) axes.push(config.row2);
  if (config.row3) axes.push(config.row3);
  return axes;
}

/** 設定から有効な横軸キーを最大3つ取得（クロス集計時） */
export function getColAxes(config: AggregationConfig): AggregationAxis[] {
  if (!config.col) return [];
  const axes = [config.col];
  if (config.col2) axes.push(config.col2);
  if (config.col3) axes.push(config.col3);
  return axes;
}

/** 複数軸のキーを結合 */
function combineAxisKeys(
  axes: AggregationAxis[],
  fields: AppField[],
  values: Record<string, string>
): string {
  const parts = axes.map((axis) => {
    const field = fields.find((f) => f.id === axis.field_id);
    return keyForAxis(axis, field, values[axis.field_id]);
  });
  return parts.join(" / ");
}

/** 集計値のラベル（表示用） */
export function measureLabel(config: AggregationConfig, fields: AppField[]): string {
  const m = config.measure;
  if (m.kind === "count") return "件数";
  const f = fields.find((x) => x.id === m.field_id);
  const name = f?.label ?? "値";
  return m.kind === "sum" ? `${name} 合計` : `${name} 平均`;
}

/** 縦軸の第一キーが日付/日時フィールドか */
export function isDateRowAxis(config: AggregationConfig, fields: AppField[]): boolean {
  const rowField = fields.find((f) => f.id === config.row.field_id);
  return isDateField(rowField);
}

/** グラフ横軸（X軸）のラベル */
export function chartXAxisLabel(config: AggregationConfig, fields: AppField[]): string {
  if (isDateRowAxis(config, fields)) {
    const unit = config.row.date_unit === "day" ? "日" : "月";
    const rowField = fields.find((f) => f.id === config.row.field_id);
    const name = rowField?.label ?? "日付";
    return `${name}（${unit}別）`;
  }
  const rowField = fields.find((f) => f.id === config.row.field_id);
  return rowField?.label ?? "項目";
}

/**
 * 集計を計算する。
 * @param recordIds 対象レコードID（全件）
 * @param valuesByRecord レコードID -> (フィールドID -> 値)
 */
export function computeAggregation(
  config: AggregationConfig,
  fields: AppField[],
  recordIds: string[],
  valuesByRecord: Record<string, Record<string, string>>
): AggregationResult {
  const rowAxes = getRowAxes(config);
  const colAxes = getColAxes(config);
  const isCross = config.type === "cross" && colAxes.length > 0;
  const singleColKey = measureLabel(config, fields);

  // sum/avg 用のアキュムレータ
  const sumMap: Record<string, Record<string, number>> = {};
  const cntMap: Record<string, Record<string, number>> = {};
  const rowKeySet = new Set<string>();
  const colKeySet = new Set<string>();

  for (const rid of recordIds) {
    const values = valuesByRecord[rid] ?? {};

    const rowKey = combineAxisKeys(rowAxes, fields, values);
    rowKeySet.add(rowKey);

    const colKey = isCross ? combineAxisKeys(colAxes, fields, values) : singleColKey;
    colKeySet.add(colKey);

    // メジャー加算値
    let add = 0;
    if (config.measure.kind === "count") {
      add = 1;
    } else {
      const raw = values[config.measure.field_id] ?? "";
      const num = Number(stripNumberCommas(raw));
      add = Number.isFinite(num) ? num : 0;
    }

    (sumMap[rowKey] ??= {})[colKey] = (sumMap[rowKey]?.[colKey] ?? 0) + add;
    (cntMap[rowKey] ??= {})[colKey] = (cntMap[rowKey]?.[colKey] ?? 0) + 1;
  }

  const rowKeys = sortKeys([...rowKeySet]);
  const colKeys = isCross ? sortKeys([...colKeySet]) : [singleColKey];

  const matrix: Record<string, Record<string, number>> = {};
  for (const rk of rowKeys) {
    matrix[rk] = {};
    for (const ck of colKeys) {
      const sum = sumMap[rk]?.[ck] ?? 0;
      const cnt = cntMap[rk]?.[ck] ?? 0;
      if (config.measure.kind === "avg") {
        matrix[rk][ck] = cnt > 0 ? sum / cnt : 0;
      } else {
        // count / sum とも合計値でよい（count は add=1 の合計）
        matrix[rk][ck] = sum;
      }
    }
  }

  return { rowKeys, colKeys, matrix };
}

/** recharts 用のデータ配列に変換 */
export function resultToChartData(
  result: AggregationResult
): Array<Record<string, string | number>> {
  return result.rowKeys.map((rk) => {
    const row: Record<string, string | number> = { name: rk };
    for (const ck of result.colKeys) {
      row[ck] = Math.round((result.matrix[rk]?.[ck] ?? 0) * 100) / 100;
    }
    return row;
  });
}
