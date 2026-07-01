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
import {
  chartXAxisLabel,
  computeAggregation,
  isDateRowAxis,
  measureLabel,
  resultToChartData,
  type AggregationResult,
} from "@/lib/aggregations/compute";
import type {
  AggregationConfig,
  AggregationMeasure,
  AppAggregation,
  AppField,
} from "@/types";

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
  }, [aggregation.id, aggregation.config.measure, measureFieldOptions]);

  useEffect(() => {
    if (recordIds.length === 0) {
      setValuesByRecord({});
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
  }, [aggregation.id, recordIds]);

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
        : computeAggregation(effectiveConfig, fields, recordIds, valuesByRecord),
    [effectiveConfig, fields, recordIds, valuesByRecord, measureInvalid]
  );

  const chartData = useMemo(() => resultToChartData(result), [result]);
  const measure = measureLabel(effectiveConfig, fields);
  const xAxisLabel = chartXAxisLabel(effectiveConfig, fields);
  const isTimeSeries =
    effectiveConfig.type === "simple" && isDateRowAxis(effectiveConfig, fields);

  if (loading) {
    return <p className="text-sm text-gray-400 py-6 text-center">集計中...</p>;
  }

  if (recordIds.length === 0) {
    return <p className="text-sm text-gray-400 py-6 text-center">対象データがありません</p>;
  }

  const { display } = aggregation.config;
  const chartHeight = isTimeSeries ? 360 : 340;
  const chartBottomMargin = isTimeSeries ? 56 : 48;

  return (
    <div className="space-y-4 min-w-0">
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

      {isTimeSeries && display !== "table" && (
        <p className="text-xs text-gray-500">
          日付を横軸（下）に、{measure}を縦軸に表示しています（単純集計）。
        </p>
      )}
      {effectiveConfig.type === "cross" && display !== "table" && (
        <p className="text-xs text-gray-500">
          クロス集計：横軸（下）は縦軸キー、系列は横軸キーごとに表示されます。
        </p>
      )}

      {!measureInvalid && display === "table" && <AggregationTable result={result} measure={measure} />}

      {!measureInvalid && display === "bar" && (
        <div className="w-full min-w-0 overflow-hidden" style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 8, bottom: chartBottomMargin, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                interval={0}
                angle={isTimeSeries ? 0 : -25}
                textAnchor={isTimeSeries ? "middle" : "end"}
                height={isTimeSeries ? 48 : 60}
              >
                <Label value={xAxisLabel} offset={-4} position="insideBottom" fontSize={11} />
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
              <Legend wrapperStyle={{ fontSize: 12 }} />
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
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 8, bottom: chartBottomMargin, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                interval={0}
                angle={isTimeSeries ? 0 : -25}
                textAnchor={isTimeSeries ? "middle" : "end"}
                height={isTimeSeries ? 48 : 60}
              >
                <Label value={xAxisLabel} offset={-4} position="insideBottom" fontSize={11} />
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
              <Legend wrapperStyle={{ fontSize: 12 }} />
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
        <AggregationTable result={result} measure={measure} />
      )}
    </div>
  );
}

function AggregationTable({
  result,
  measure,
}: {
  result: AggregationResult;
  measure: string;
}) {
  const { rowKeys, colKeys, matrix } = result;
  const showColHeader = colKeys.length > 1 || colKeys[0] !== measure;

  const colTotals: Record<string, number> = {};
  colKeys.forEach((ck) => {
    colTotals[ck] = rowKeys.reduce((s, rk) => s + (matrix[rk]?.[ck] ?? 0), 0);
  });

  const fmt = (n: number) =>
    Number.isInteger(n) ? n.toLocaleString() : (Math.round(n * 100) / 100).toLocaleString();

  if (rowKeys.length === 0) return null;

  return (
    <div className="min-w-0">
      <table className="agg-table w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="py-2 pr-2 sm:pr-4 font-medium align-bottom"></th>
            {showColHeader ? (
              colKeys.map((ck) => (
                <th
                  key={ck}
                  className="py-2 px-1 sm:px-3 font-medium text-right align-bottom"
                >
                  {ck}
                </th>
              ))
            ) : (
              <th className="py-2 px-1 sm:px-3 font-medium text-right align-bottom">
                {colKeys[0]}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rowKeys.map((rk) => (
            <tr key={rk} className="border-b last:border-0">
              <td className="py-2 pr-2 sm:pr-4 font-medium">{rk}</td>
              {colKeys.map((ck) => (
                <td key={ck} className="py-2 px-1 sm:px-3 text-right tabular-nums">
                  {fmt(matrix[rk]?.[ck] ?? 0)}
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t-2 border-gray-300 font-medium">
            <td className="py-2 pr-2 sm:pr-4">合計</td>
            {colKeys.map((ck) => (
              <td key={ck} className="py-2 px-1 sm:px-3 text-right tabular-nums">
                {fmt(colTotals[ck])}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
