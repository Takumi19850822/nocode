"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import {
  computeAggregation,
  measureLabel,
  resultToChartData,
  type AggregationResult,
} from "@/lib/aggregations/compute";
import type { AppAggregation, AppField } from "@/types";

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
  const supabase = createClient();

  useEffect(() => {
    if (recordIds.length === 0) {
      setValuesByRecord({});
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    // 集計は全レコードの値が必要。まとめて取得（チャンク分割で in 制限を回避）
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

  const result: AggregationResult = useMemo(
    () => computeAggregation(aggregation.config, fields, recordIds, valuesByRecord),
    [aggregation.config, fields, recordIds, valuesByRecord]
  );

  const chartData = useMemo(() => resultToChartData(result), [result]);
  const measure = measureLabel(aggregation.config, fields);

  if (loading) {
    return <p className="text-sm text-gray-400 py-6 text-center">集計中...</p>;
  }

  if (recordIds.length === 0) {
    return <p className="text-sm text-gray-400 py-6 text-center">対象データがありません</p>;
  }

  const { display } = aggregation.config;

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">集計値: {measure}</p>

      {display === "table" && <AggregationTable result={result} />}

      {display === "bar" && (
        <div className="w-full" style={{ height: 340 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              {result.colKeys.map((ck, i) => (
                <Bar key={ck} dataKey={ck} fill={COLORS[i % COLORS.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {display === "line" && (
        <div className="w-full" style={{ height: 340 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
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

      {/* グラフ表示時も数値表を併記 */}
      {display !== "table" && <AggregationTable result={result} />}
    </div>
  );
}

function AggregationTable({ result }: { result: AggregationResult }) {
  const { rowKeys, colKeys, matrix } = result;
  const showColHeader = colKeys.length > 1 || colKeys[0] !== "件数";

  const colTotals: Record<string, number> = {};
  colKeys.forEach((ck) => {
    colTotals[ck] = rowKeys.reduce((s, rk) => s + (matrix[rk]?.[ck] ?? 0), 0);
  });

  const fmt = (n: number) =>
    Number.isInteger(n) ? n.toLocaleString() : (Math.round(n * 100) / 100).toLocaleString();

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="py-2 pr-4 font-medium"></th>
            {showColHeader ? (
              colKeys.map((ck) => (
                <th key={ck} className="py-2 px-3 font-medium text-right whitespace-nowrap">
                  {ck}
                </th>
              ))
            ) : (
              <th className="py-2 px-3 font-medium text-right">{colKeys[0]}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rowKeys.map((rk) => (
            <tr key={rk} className="border-b last:border-0">
              <td className="py-2 pr-4 font-medium whitespace-nowrap">{rk}</td>
              {colKeys.map((ck) => (
                <td key={ck} className="py-2 px-3 text-right tabular-nums">
                  {fmt(matrix[rk]?.[ck] ?? 0)}
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t-2 border-gray-300 font-medium">
            <td className="py-2 pr-4">合計</td>
            {colKeys.map((ck) => (
              <td key={ck} className="py-2 px-3 text-right tabular-nums">
                {fmt(colTotals[ck])}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
