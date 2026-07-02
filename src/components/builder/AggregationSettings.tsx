"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { FilterBar } from "@/components/filters/FilterBar";
import { AggregationView } from "@/components/records/AggregationView";
import type {
  AppAggregation,
  AppField,
  AppRecord,
  AggregationAxis,
  AggregationConfig,
  AggregationDisplay,
  DateUnit,
  FilterConfig,
} from "@/types";
import { EMPTY_FILTER } from "@/types";
import { ArrowLeft, Plus, Pencil, Trash2, BarChart3, Save } from "lucide-react";

interface AggregationSettingsProps {
  appId: string;
  fields: AppField[];
  previewRecords: AppRecord[];
}

const DISPLAY_LABELS: Record<AggregationDisplay, string> = {
  table: "表",
  bar: "棒グラフ",
  line: "折れ線グラフ",
};

type AxisSlot = {
  fieldId: string;
  dateUnit: DateUnit;
};

const EMPTY_AXIS: AxisSlot = { fieldId: "", dateUnit: "month" };

function isDateFieldId(fields: AppField[], id: string) {
  const f = fields.find((x) => x.id === id);
  return f?.field_type === "date" || f?.field_type === "datetime";
}

function axisFromConfig(axis: AggregationAxis | undefined): AxisSlot {
  if (!axis) return { ...EMPTY_AXIS };
  return { fieldId: axis.field_id, dateUnit: axis.date_unit ?? "month" };
}

function buildAxis(
  slot: AxisSlot,
  fields: AppField[]
): AggregationAxis | undefined {
  if (!slot.fieldId) return undefined;
  return {
    field_id: slot.fieldId,
    ...(isDateFieldId(fields, slot.fieldId) ? { date_unit: slot.dateUnit } : {}),
  };
}

function AxisKeyFields({
  label,
  optional,
  slot,
  onChange,
  fieldOptions,
  fields,
}: {
  label: string;
  optional?: boolean;
  slot: AxisSlot;
  onChange: (slot: AxisSlot) => void;
  fieldOptions: { label: string; value: string }[];
  fields: AppField[];
}) {
  const showDateUnit = isDateFieldId(fields, slot.fieldId);

  return (
    <div className="space-y-1">
      <Select
        label={label}
        value={slot.fieldId}
        onChange={(e) => onChange({ ...slot, fieldId: e.target.value })}
        options={[
          { label: optional ? "なし" : "選択してください", value: "" },
          ...fieldOptions,
        ]}
      />
      {showDateUnit && (
        <Select
          label="日付の単位"
          value={slot.dateUnit}
          onChange={(e) => onChange({ ...slot, dateUnit: e.target.value as DateUnit })}
          options={[
            { label: "月単位", value: "month" },
            { label: "日単位", value: "day" },
          ]}
        />
      )}
    </div>
  );
}

export function AggregationSettings({ appId, fields, previewRecords }: AggregationSettingsProps) {
  const [aggregations, setAggregations] = useState<AppAggregation[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [type, setType] = useState<"simple" | "cross">("simple");
  const [row1, setRow1] = useState<AxisSlot>({ fieldId: "", dateUnit: "month" });
  const [row2, setRow2] = useState<AxisSlot>({ ...EMPTY_AXIS });
  const [row3, setRow3] = useState<AxisSlot>({ ...EMPTY_AXIS });
  const [col1, setCol1] = useState<AxisSlot>({ ...EMPTY_AXIS });
  const [col2, setCol2] = useState<AxisSlot>({ ...EMPTY_AXIS });
  const [col3, setCol3] = useState<AxisSlot>({ ...EMPTY_AXIS });
  const [measureKind, setMeasureKind] = useState<"count" | "sum" | "avg">("count");
  const [measureFieldId, setMeasureFieldId] = useState("");
  const [display, setDisplay] = useState<AggregationDisplay>("table");
  const [defaultFilter, setDefaultFilter] = useState<FilterConfig>(EMPTY_FILTER);

  const supabase = createClient();

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("app_aggregations")
      .select("*")
      .eq("app_id", appId)
      .order("sort_order");
    setAggregations((data as AppAggregation[] | null) ?? []);
    setLoading(false);
  }, [appId]);

  useEffect(() => {
    load();
  }, [load]);

  const fieldOptions = fields.map((f) => ({ label: f.label || "(無名)", value: f.id }));
  const measureFieldOptions = fields
    .filter((f) => f.field_type === "number" || f.field_type === "calculation")
    .map((f) => ({ label: f.label || "(無名)", value: f.id }));

  function resetForm() {
    setName("");
    setType("simple");
    setRow1({ fieldId: fields[0]?.id ?? "", dateUnit: "month" });
    setRow2({ ...EMPTY_AXIS });
    setRow3({ ...EMPTY_AXIS });
    setCol1({ ...EMPTY_AXIS });
    setCol2({ ...EMPTY_AXIS });
    setCol3({ ...EMPTY_AXIS });
    setMeasureKind("count");
    setMeasureFieldId(measureFieldOptions[0]?.value ?? "");
    setDisplay("table");
    setDefaultFilter(EMPTY_FILTER);
    setError("");
  }

  function openCreate() {
    setEditingId(null);
    resetForm();
    setOpen(true);
  }

  function openEdit(agg: AppAggregation) {
    const c = agg.config;
    setEditingId(agg.id);
    setName(agg.name);
    setType(c.type);
    setRow1(axisFromConfig(c.row));
    setRow2(axisFromConfig(c.row2));
    setRow3(axisFromConfig(c.row3));
    setCol1(axisFromConfig(c.col));
    setCol2(axisFromConfig(c.col2));
    setCol3(axisFromConfig(c.col3));
    setMeasureKind(c.measure.kind);
    setMeasureFieldId(c.measure.kind === "count" ? "" : c.measure.field_id);
    setDisplay(c.display);
    setDefaultFilter(c.filter ?? EMPTY_FILTER);
    setError("");
    setOpen(true);
  }

  function buildConfig(showError: boolean): AggregationConfig | null {
    const rowAxis = buildAxis(row1, fields);
    if (!rowAxis) {
      if (showError) setError("集計キー（縦軸 第一キー）を選択してください");
      return null;
    }
    if (measureKind !== "count" && !measureFieldId) {
      if (showError) setError("合計/平均の対象となる数値フィールドを選択してください");
      return null;
    }
    if (type === "cross" && !col1.fieldId) {
      if (showError) setError("クロス集計では横軸（第一キー）を選択してください");
      return null;
    }

    const config: AggregationConfig = {
      type,
      row: rowAxis,
      measure:
        measureKind === "count"
          ? { kind: "count" }
          : { kind: measureKind, field_id: measureFieldId },
      display,
      ...(defaultFilter.conditions.length > 0 ? { filter: defaultFilter } : {}),
    };

    const row2Axis = buildAxis(row2, fields);
    const row3Axis = buildAxis(row3, fields);
    if (row2Axis) config.row2 = row2Axis;
    if (row3Axis) config.row3 = row3Axis;

    if (type === "cross" && col1.fieldId) {
      config.col = buildAxis(col1, fields)!;
      const col2Axis = buildAxis(col2, fields);
      const col3Axis = buildAxis(col3, fields);
      if (col2Axis) config.col2 = col2Axis;
      if (col3Axis) config.col3 = col3Axis;
    }

    return config;
  }

  // プレビュー用（エラー表示なし・常時再計算）
  const previewConfig = useMemo(
    () => buildConfig(false),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [row1, row2, row3, col1, col2, col3, type, measureKind, measureFieldId, display, defaultFilter, fields]
  );

  const previewAggregation: AppAggregation | null = useMemo(() => {
    if (!previewConfig) return null;
    return {
      id: editingId ?? "preview",
      app_id: appId,
      name: name.trim() || "プレビュー",
      config: previewConfig,
      sort_order: 0,
      created_at: "",
      updated_at: "",
    };
  }, [previewConfig, editingId, appId, name]);

  async function handleSave() {
    setError("");
    if (!name.trim()) {
      setError("集計の名前を入力してください");
      return;
    }
    const config = buildConfig(true);
    if (!config) return;

    setSaving(true);

    if (editingId) {
      const { error: e } = await supabase
        .from("app_aggregations")
        .update({ name: name.trim(), config })
        .eq("id", editingId);
      if (e) {
        setError(`保存に失敗しました: ${e.message}`);
        setSaving(false);
        return;
      }
    } else {
      const { error: e } = await supabase.from("app_aggregations").insert({
        app_id: appId,
        name: name.trim(),
        config,
        sort_order: aggregations.length,
      });
      if (e) {
        const hint = e.message.includes("app_aggregations")
          ? "（010_field_layout_and_aggregations.sql のマイグレーション未実行の可能性があります）"
          : "";
        setError(`保存に失敗しました: ${e.message}${hint}`);
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    setOpen(false);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("この集計を削除しますか？")) return;
    await supabase.from("app_aggregations").delete().eq("id", id);
    load();
  }

  if (open) {
    const previewRecordIds = previewRecords.map((r) => r.id);

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
          >
            <ArrowLeft className="w-4 h-4" />
            集計一覧に戻る
          </button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-1" />
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Input
              label="名前"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 月別売上"
              required
            />

            <Select
              label="集計タイプ"
              value={type}
              onChange={(e) => setType(e.target.value as "simple" | "cross")}
              options={[
                { label: "単純集計", value: "simple" },
                { label: "クロス集計", value: "cross" },
              ]}
            />
            <p className="text-xs text-gray-500 -mt-2">
              {type === "simple"
                ? "月別・日別の推移グラフは単純集計＋下の「縦軸（集計キー）」に日付フィールドを指定してください。"
                : "日付×別カテゴリ（例：月×商品）の比較表・グラフ向けです。"}
            </p>

            <div className="space-y-3 rounded-lg border border-gray-200 p-3">
              <p className="text-xs font-medium text-gray-600">縦軸（集計キー）</p>
              <p className="text-xs text-gray-500 -mt-1">
                表示時は最大3キーまでネストして集計します（クロス集計時は行方向）。
              </p>
              <AxisKeyFields
                label="第一キー"
                slot={row1}
                onChange={setRow1}
                fieldOptions={fieldOptions}
                fields={fields}
              />
              <AxisKeyFields
                label="第二キー（任意）"
                optional
                slot={row2}
                onChange={setRow2}
                fieldOptions={fieldOptions}
                fields={fields}
              />
              <AxisKeyFields
                label="第三キー（任意）"
                optional
                slot={row3}
                onChange={setRow3}
                fieldOptions={fieldOptions}
                fields={fields}
              />
            </div>

            {type === "cross" && (
              <div className="space-y-3 rounded-lg border border-gray-200 p-3">
                <p className="text-xs font-medium text-gray-600">横軸（集計キー）</p>
                <AxisKeyFields
                  label="第一キー"
                  slot={col1}
                  onChange={setCol1}
                  fieldOptions={fieldOptions}
                  fields={fields}
                />
                <AxisKeyFields
                  label="第二キー（任意）"
                  optional
                  slot={col2}
                  onChange={setCol2}
                  fieldOptions={fieldOptions}
                  fields={fields}
                />
                <AxisKeyFields
                  label="第三キー（任意）"
                  optional
                  slot={col3}
                  onChange={setCol3}
                  fieldOptions={fieldOptions}
                  fields={fields}
                />
              </div>
            )}

            <div className="space-y-1">
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

            <Select
              label="表示形式"
              value={display}
              onChange={(e) => setDisplay(e.target.value as AggregationDisplay)}
              options={[
                { label: "表", value: "table" },
                { label: "棒グラフ", value: "bar" },
                { label: "折れ線グラフ", value: "line" },
              ]}
            />

            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-700">デフォルトの絞り込み条件</p>
              <p className="text-xs text-gray-500">
                実行画面を開いたときの初期状態です。実行画面でも変更できます。
              </p>
              <FilterBar fields={fields} value={defaultFilter} onChange={setDefaultFilter} compact />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <div className="lg:sticky lg:top-4 lg:self-start">
            <p className="text-xs font-medium text-gray-500 mb-2">プレビュー</p>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              {previewRecordIds.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                  プレビュー用のレコードがありません
                </p>
              ) : previewAggregation ? (
                <AggregationView
                  aggregation={previewAggregation}
                  fields={fields}
                  recordIds={previewRecordIds}
                />
              ) : (
                <p className="text-sm text-gray-400 text-center py-8">
                  縦軸キーなどを入力するとプレビューが表示されます
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          集計/グラフを作成すると、レコード一覧の「グラフ」から表示できます。
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" />
          追加
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">読み込み中...</p>
      ) : aggregations.length === 0 ? (
        <p className="text-sm text-gray-400">集計はまだありません。</p>
      ) : (
        <ul className="space-y-2">
          {aggregations.map((agg) => (
            <li
              key={agg.id}
              className="flex items-center justify-between gap-2 border border-gray-200 rounded-lg px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <BarChart3 className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="truncate text-sm font-medium">{agg.name}</span>
                <Badge>{agg.config.type === "cross" ? "クロス集計" : "単純集計"}</Badge>
                <Badge variant="default">{DISPLAY_LABELS[agg.config.display]}</Badge>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => openEdit(agg)}
                  className="text-gray-400 hover:text-blue-600 p-1"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(agg.id)}
                  className="text-gray-400 hover:text-red-600 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
