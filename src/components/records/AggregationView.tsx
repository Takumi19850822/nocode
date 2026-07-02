"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { Select } from "@/components/ui/Input";
import { FilterBar, filterHasConditions } from "@/components/filters/FilterBar";
import { matchesFilter } from "@/lib/filters/evaluate";
import {
  chartSeriesAxisLabel,
  chartXAxisLabel,
  computeAggregation,
  computeHeaderPlan,
  computePivotTable,
  getColAxes,
  getRowAxes,
  isDateRowAxis,
  measureLabel,
  pivotAxisFieldLabels,
  pivotCell,
  resultToChartData,
  usesRowSeriesPivot,
  type AggregationResult,
  type PivotResult,
} from "@/lib/aggregations/compute";
import type {
  AggregationConfig,
  AggregationMeasure,
  AppAggregation,
  AppField,
  FilterConfig,
} from "@/types";
import { EMPTY_FILTER } from "@/types";

interface AggregationViewProps {
  aggregation: AppAggregation;
  fields: AppField[];
  recordIds: string[];
}

const COLORS = [
  "#2563eb",
  "#16a34a",
  "#ea580c",
  "#9333ea",
  "#0891b2",
  "#dc2626",
  "#ca8a04",
  "#4f46e5",
];

export function AggregationView({ aggregation, fields, recordIds }: AggregationViewProps) {
  const [valuesByRecord, setValuesByRecord] = useState<
    Record<string, Record<string, string>>
  >({});
  const [loading, setLoading] = useState(true);
  const [measureKind, setMeasureKind] = useState<"count" | "sum" | "avg">("count");
  const [measureFieldId, setMeasureFieldId] = useState("");
  const [filter, setFilter] = useState<FilterConfig>(aggregation.config.filter ?? EMPTY_FILTER);
  const supabase = createClient();

  const measureFieldOptions = useMemo(
    () =>
      fields
        .filter((f) => f.field_type === "number" || f.field_type === "calculation")
        .map((f) => ({ label: f.label || "(無名)", value: f.id })),
    [fields]
  );

  useEffect(() => {
    const m = aggregation.config.measure;
    setMeasureKind(m.kind);
    setMeasureFieldId(
      m.kind === "count" ? (measureFieldOptions[0]?.value ?? "") : m.field_id
    );
    setFilter(aggregation.config.filter ?? EMPTY_FILTER);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aggregation.id]);

  useEffect(() => {
    if (recordIds.length === 0) {
      setValuesByRecord({});
      setLoading(false);
      return;
    }

    // レコードIDが同じなら再取得しない（グラフ切替時のちらつき・スクロール跳ね防止）
    const loadedCount = recordIds.filter((id) => valuesByRecord[id] !== undefined).length;
    if (loadedCount === recordIds.length) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    (async () => {
      const map: Record<string, Record<string, string>> = {};
      const CHUNK = 300;
      for (let i = 0; i < recordIds.length; i += CHUNK) {
        const chunk = recordIds.slice(i, i + CHUNK);
        const { data } = await supabase
          .from("app_record_values")
          .select("record_id, field_id, value")
          .in("record_id", chunk);
        data?.forEach((v) => {
          (map[v.record_id] ??= {})[v.field_id] = v.value;
        });
      }
      if (!cancelled) {
        setValuesByRecord(map);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordIds.join(",")]);

  const filteredRecordIds = useMemo(() => {
    if (!filterHasConditions(filter)) return recordIds;
    return recordIds.filter((rid) => matchesFilter(filter, fields, valuesByRecord[rid] ?? {}));
  }, [recordIds, filter, fields, valuesByRecord]);

  const effectiveMeasure: AggregationMeasure = useMemo(() => {
    if (measureKind === "count") return { kind: "count" };
    return { kind: measureKind, field_id: measureFieldId };
  }, [measureKind, measureFieldId]);

  const effectiveConfig: AggregationConfig = useMemo(
    () => ({ ...aggregation.config, measure: effectiveMeasure }),
    [aggregation.config, effectiveMeasure]
  );

  const measureInvalid =
    measureKind !== "count" && !measureFieldId && measureFieldOptions.length > 0;

  const result: AggregationResult = useMemo(
    () =>
      measureInvalid
        ? { rowKeys: [], colKeys: [], matrix: {} }
        : computeAggregation(effectiveConfig, fields, filteredRecordIds, valuesByRecord),
    [effectiveConfig, fields, filteredRecordIds, valuesByRecord, measureInvalid]
  );

  const pivot: PivotResult = useMemo(
    () =>
      measureInvalid
        ? { rowTuples: [], colTuples: [], matrix: {} }
        : computePivotTable(effectiveConfig, fields, filteredRecordIds, valuesByRecord),
    [effectiveConfig, fields, filteredRecordIds, valuesByRecord, measureInvalid]
  );

  const chartData = useMemo(() => resultToChartData(result), [result]);
  const measure = measureLabel(effectiveConfig, fields);
  const xAxisLabel = chartXAxisLabel(effectiveConfig, fields);
  const seriesAxisLabel = chartSeriesAxisLabel(effectiveConfig, fields);
  const isTimeSeries = isDateRowAxis(effectiveConfig, fields);
  const rowPivot = usesRowSeriesPivot(effectiveConfig);

  if (loading) {
    return (
      <p className="text-sm text-gray-400 py-6 text-center min-h-[200px] flex items-center justify-center">
        集計中...
      </p>
    );
  }

  if (recordIds.length === 0) {
    return <p className="text-sm text-gray-400 py-6 text-center">対象データがありません</p>;
  }

  const { display } = aggregation.config;
  const hasMultiSeries = result.colKeys.length > 1;
  const chartHeight = hasMultiSeries ? 380 : 340;
  const chartMargin = {
    top: hasMultiSeries ? 44 : 12,
    right: 12,
    bottom: isTimeSeries || rowPivot ? 52 : 44,
    left: 4,
  };
  const xAxisHeight = isTimeSeries ? 36 : 52;

  return (
    <div className="space-y-4 min-w-0">
      <FilterBar fields={fields} value={filter} onChange={setFilter} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Select
          label="集計値"
          value={measureKind}
          onChange={(e) => setMeasureKind(e.target.value as "count" | "sum" | "avg")}
          options={[
            { label: "件数", value: "count" },
            { label: "合計", value: "sum" },
            { label: "平均", value: "avg" },
          ]}
        />
        {measureKind !== "count" && (
          <Select
            label="対象の数値フィールド"
            value={measureFieldId}
            onChange={(e) => setMeasureFieldId(e.target.value)}
            options={[
              { label: "選択してください", value: "" },
              ...measureFieldOptions,
            ]}
          />
        )}
      </div>

      {measureKind !== "count" && measureFieldOptions.length === 0 && (
        <p className="text-sm text-amber-600">
          合計/平均に使える数値フィールドがありません。
        </p>
      )}
      {measureInvalid && (
        <p className="text-sm text-amber-600">数値フィールドを選択してください。</p>
      )}

      {filteredRecordIds.length === 0 && !measureInvalid ? (
        <p className="text-sm text-gray-400 text-center py-6">
          絞り込み条件に一致するデータがありません
        </p>
      ) : (
        <>
          {rowPivot && display !== "table" && (
            <p className="text-xs text-gray-500">
              縦軸第一キー（{seriesAxisLabel}）で色分け、第二キー以降（{xAxisLabel}）を横軸（下）に表示しています。
            </p>
          )}
          {!rowPivot && isTimeSeries && display !== "table" && (
            <p className="text-xs text-gray-500">
              {xAxisLabel}を横軸（下）に、{measure}を縦軸に表示しています。
            </p>
          )}
          {!rowPivot && effectiveConfig.type === "cross" && display !== "table" && (
            <p className="text-xs text-gray-500">
              クロス集計：横軸（下）は縦軸キー、系列（色）は横軸キーごとに表示されます。
            </p>
          )}

          {!measureInvalid && display === "table" && (
            <PivotTable pivot={pivot} config={effectiveConfig} fields={fields} measure={measure} />
          )}

          {!measureInvalid && display === "bar" && (
            <div className="w-full min-w-0 overflow-hidden" style={{ height: chartHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={chartMargin}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    interval={0}
                    angle={isTimeSeries ? 0 : -25}
                    textAnchor={isTimeSeries ? "middle" : "end"}
                    height={xAxisHeight}
                  >
                    <Label
                      value={xAxisLabel}
                      offset={-2}
                      position="insideBottom"
                      fontSize={11}
                    />
                  </XAxis>
                  <YAxis tick={{ fontSize: 11 }} width={48}>
                    <Label
                      value={measure}
                      angle={-90}
                      position="insideLeft"
                      style={{ textAnchor: "middle", fontSize: 11 }}
                    />
                  </YAxis>
                  <Tooltip />
                  <Legend
                    verticalAlign={hasMultiSeries ? "top" : "bottom"}
                    wrapperStyle={{ fontSize: 12, paddingBottom: hasMultiSeries ? 4 : 0 }}
                  />
                  {result.colKeys.map((ck, i) => (
                    <Bar key={ck} dataKey={ck} fill={COLORS[i % COLORS.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {!measureInvalid && display === "line" && (
            <div className="w-full min-w-0 overflow-hidden" style={{ height: chartHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={chartMargin}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    interval={0}
                    angle={isTimeSeries ? 0 : -25}
                    textAnchor={isTimeSeries ? "middle" : "end"}
                    height={xAxisHeight}
                  >
                    <Label
                      value={xAxisLabel}
                      offset={-2}
                      position="insideBottom"
                      fontSize={11}
                    />
                  </XAxis>
                  <YAxis tick={{ fontSize: 11 }} width={48}>
                    <Label
                      value={measure}
                      angle={-90}
                      position="insideLeft"
                      style={{ textAnchor: "middle", fontSize: 11 }}
                    />
                  </YAxis>
                  <Tooltip />
                  <Legend
                    verticalAlign={hasMultiSeries ? "top" : "bottom"}
                    wrapperStyle={{ fontSize: 12, paddingBottom: hasMultiSeries ? 4 : 0 }}
                  />
                  {result.colKeys.map((ck, i) => (
                    <Line
                      key={ck}
                      type="monotone"
                      dataKey={ck}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {!measureInvalid && display !== "table" && (
            <PivotTable pivot={pivot} config={effectiveConfig} fields={fields} measure={measure} />
          )}
        </>
      )}
    </div>
  );
}

/** Excel のピボットテーブルのようにネストした行/列見出し（rowSpan/colSpan）で表示 */
function PivotTable({
  pivot,
  config,
  fields,
  measure,
}: {
  pivot: PivotResult;
  config: AggregationConfig;
  fields: AppField[];
  measure: string;
}) {
  const { rowTuples, colTuples } = pivot;
  if (rowTuples.length === 0) return null;

  const rowAxes = getRowAxes(config);
  const colAxes = getColAxes(config);
  const isCross = config.type === "cross" && colAxes.length > 0;

  const rowLevels = rowAxes.length;
  const colLevels = colTuples[0]?.length ?? 1;

  const rowPlan = computeHeaderPlan(rowTuples, rowLevels);
  const colPlan = computeHeaderPlan(colTuples, colLevels);
  const rowFieldLabels = pivotAxisFieldLabels(rowAxes, fields);

  const fmt = (n: number) =>
    Number.isInteger(n) ? n.toLocaleString() : (Math.round(n * 100) / 100).toLocaleString();

  const colTotals = colTuples.map((ct) =>
    rowTuples.reduce((s, rt) => s + pivotCell(pivot, rt, ct), 0)
  );

  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="agg-table w-full text-sm">
        <thead>
          {Array.from({ length: colLevels }, (_, level) => (
            <tr key={level}>
              {level === 0 && (
                <th rowSpan={colLevels} colSpan={rowLevels || 1} className="align-bottom bg-gray-50">
                  {isCross && rowLevels > 0 && (
                    <div className="flex divide-x divide-gray-200 -m-2">
                      {rowFieldLabels.map((label, i) => (
                        <span key={i} className="flex-1 px-2 text-xs font-normal text-gray-400 text-center">
                          {label}
                        </span>
                      ))}
                    </div>
                  )}
                </th>
              )}
              {colPlan[level].map((cell, i) =>
                cell ? (
                  <th key={i} colSpan={cell.span} className="text-center align-bottom">
                    {cell.label}
                  </th>
                ) : null
              )}
            </tr>
          ))}
        </thead>
        <tbody>
          {rowTuples.map((rt, ri) => (
            <tr key={ri}>
              {Array.from({ length: rowLevels }, (_, level) => {
                const cell = rowPlan[level][ri];
                if (!cell) return null;
                return (
                  <td key={level} rowSpan={cell.span} className="font-medium align-top">
                    {cell.label}
                  </td>
                );
              })}
              {colTuples.map((ct, ci) => (
                <td key={ci} className="text-right tabular-nums">
                  {fmt(pivotCell(pivot, rt, ct))}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <td colSpan={rowLevels || 1} className="font-semibold">
              合計
            </td>
            {colTuples.map((_, ci) => (
              <td key={ci} className="text-right tabular-nums font-semibold">
                {fmt(colTotals[ci])}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      {!isCross && <p className="text-xs text-gray-400 mt-1">{measure}</p>}
    </div>
  );
}
