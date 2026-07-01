import { stripNumberCommas } from "@/lib/utils";
import type {
  AggregationAxis,
  AggregationConfig,
  AppField,
  DateUnit,
} from "@/types";

const EMPTY_LABEL = "（空欄）";

export interface AggregationResult {
  /** 表・グラフの行キー（横軸 / 左列） */
  rowKeys: string[];
  /** 表・グラフの列キー（系列 / 色分け） */
  colKeys: string[];
  /** matrix[rowKey][colKey] = 集計値 */
  matrix: Record<string, Record<string, number>>;
}

function bucketDate(value: string, unit: DateUnit): string {
  const ymd = value.slice(0, 10);
  if (unit === "month") return ymd.slice(0, 7);
  return ymd;
}

function isDateField(field: AppField | undefined): boolean {
  return field?.field_type === "date" || field?.field_type === "datetime";
}

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

/** 縦軸が2つ以上 → 第一キーを系列、第二キー以降を行（グラフ横軸）に割り当て */
export function usesRowSeriesPivot(config: AggregationConfig): boolean {
  return getRowAxes(config).length >= 2;
}

/** グラフ横軸・表の行見出しに使う縦軸キー */
export function getDisplayRowAxes(config: AggregationConfig): AggregationAxis[] {
  const rowAxes = getRowAxes(config);
  if (usesRowSeriesPivot(config)) return rowAxes.slice(1);
  return rowAxes;
}

/** 系列（色分け）の元になる縦軸第一キー */
export function getSeriesRowAxis(config: AggregationConfig): AggregationAxis | undefined {
  if (!usesRowSeriesPivot(config)) return undefined;
  return config.row;
}

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

function fieldForAxis(fields: AppField[], axis: AggregationAxis): AppField | undefined {
  return fields.find((f) => f.id === axis.field_id);
}

/** 集計値のラベル（表示用） */
export function measureLabel(config: AggregationConfig, fields: AppField[]): string {
  const m = config.measure;
  if (m.kind === "count") return "件数";
  const f = fields.find((x) => x.id === m.field_id);
  const name = f?.label ?? "値";
  return m.kind === "sum" ? `${name} 合計` : `${name} 平均`;
}

/** 縦軸の第一キーが日付/日時フィールドか（単一キー時の後方互換） */
export function isDateRowAxis(config: AggregationConfig, fields: AppField[]): boolean {
  return getDisplayRowAxes(config).some((axis) =>
    isDateField(fieldForAxis(fields, axis))
  );
}

/** グラフ横軸（X軸）のラベル */
export function chartXAxisLabel(config: AggregationConfig, fields: AppField[]): string {
  const xAxes = getDisplayRowAxes(config);

  if (xAxes.length === 1) {
    const field = fieldForAxis(fields, xAxes[0]);
    if (isDateField(field)) {
      const unit = xAxes[0].date_unit === "day" ? "日" : "月";
      return `${field?.label ?? "日付"}（${unit}別）`;
    }
    return field?.label ?? "項目";
  }

  return xAxes
    .map((axis) => fieldForAxis(fields, axis)?.label ?? "項目")
    .join(" / ");
}

/** 系列（凡例）のラベル */
export function chartSeriesAxisLabel(config: AggregationConfig, fields: AppField[]): string {
  if (usesRowSeriesPivot(config)) {
    const field = fieldForAxis(fields, config.row);
    return field?.label ?? "系列";
  }
  if (config.type === "cross" && config.col) {
    const colAxes = getColAxes(config);
    return colAxes
      .map((axis) => fieldForAxis(fields, axis)?.label ?? "項目")
      .join(" / ");
  }
  return measureLabel(config, fields);
}

export function computeAggregation(
  config: AggregationConfig,
  fields: AppField[],
  recordIds: string[],
  valuesByRecord: Record<string, Record<string, string>>
): AggregationResult {
  const rowAxes = getRowAxes(config);
  const colAxes = getColAxes(config);
  const isCross = config.type === "cross" && colAxes.length > 0;
  const pivotRows = usesRowSeriesPivot(config);
  const singleColKey = measureLabel(config, fields);

  const sumMap: Record<string, Record<string, number>> = {};
  const cntMap: Record<string, Record<string, number>> = {};
  const rowKeySet = new Set<string>();
  const colKeySet = new Set<string>();

  for (const rid of recordIds) {
    const values = valuesByRecord[rid] ?? {};

    let rowKey: string;
    let colKey: string;

    if (pivotRows) {
      // 第一キー → 系列（色）、第二キー以降 → 行（グラフの横軸）
      rowKey = combineAxisKeys(rowAxes.slice(1), fields, values);
      const seriesBase = keyForAxis(
        rowAxes[0],
        fieldForAxis(fields, rowAxes[0]),
        values[rowAxes[0].field_id]
      );
      if (isCross) {
        colKey = `${seriesBase} / ${combineAxisKeys(colAxes, fields, values)}`;
      } else {
        colKey = seriesBase;
      }
    } else {
      rowKey = combineAxisKeys(rowAxes, fields, values);
      colKey = isCross ? combineAxisKeys(colAxes, fields, values) : singleColKey;
    }

    rowKeySet.add(rowKey);
    colKeySet.add(colKey);

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
  const colKeys =
    pivotRows || isCross ? sortKeys([...colKeySet]) : [singleColKey];

  const matrix: Record<string, Record<string, number>> = {};
  for (const rk of rowKeys) {
    matrix[rk] = {};
    for (const ck of colKeys) {
      const sum = sumMap[rk]?.[ck] ?? 0;
      const cnt = cntMap[rk]?.[ck] ?? 0;
      if (config.measure.kind === "avg") {
        matrix[rk][ck] = cnt > 0 ? sum / cnt : 0;
      } else {
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
