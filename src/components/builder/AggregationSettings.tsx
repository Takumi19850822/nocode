"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Badge, Modal } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import type {
  AppAggregation,
  AppField,
  AggregationConfig,
  AggregationDisplay,
  DateUnit,
} from "@/types";
import { Plus, Pencil, Trash2, BarChart3 } from "lucide-react";

interface AggregationSettingsProps {
  appId: string;
  fields: AppField[];
}

const DISPLAY_LABELS: Record<AggregationDisplay, string> = {
  table: "表",
  bar: "棒グラフ",
  line: "折れ線グラフ",
};

function isDateFieldId(fields: AppField[], id: string) {
  const f = fields.find((x) => x.id === id);
  return f?.field_type === "date" || f?.field_type === "datetime";
}

export function AggregationSettings({ appId, fields }: AggregationSettingsProps) {
  const [aggregations, setAggregations] = useState<AppAggregation[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // フォーム状態
  const [name, setName] = useState("");
  const [type, setType] = useState<"simple" | "cross">("simple");
  const [rowFieldId, setRowFieldId] = useState("");
  const [rowDateUnit, setRowDateUnit] = useState<DateUnit>("month");
  const [colFieldId, setColFieldId] = useState("");
  const [colDateUnit, setColDateUnit] = useState<DateUnit>("month");
  const [col2FieldId, setCol2FieldId] = useState("");
  const [col2DateUnit, setCol2DateUnit] = useState<DateUnit>("month");
  const [measureKind, setMeasureKind] = useState<"count" | "sum" | "avg">("count");
  const [measureFieldId, setMeasureFieldId] = useState("");
  const [display, setDisplay] = useState<AggregationDisplay>("table");

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
    setRowFieldId(fields[0]?.id ?? "");
    setRowDateUnit("month");
    setColFieldId("");
    setColDateUnit("month");
    setCol2FieldId("");
    setCol2DateUnit("month");
    setMeasureKind("count");
    setMeasureFieldId(measureFieldOptions[0]?.value ?? "");
    setDisplay("table");
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
    setRowFieldId(c.row.field_id);
    setRowDateUnit(c.row.date_unit ?? "month");
    setColFieldId(c.col?.field_id ?? "");
    setColDateUnit(c.col?.date_unit ?? "month");
    setCol2FieldId(c.col2?.field_id ?? "");
    setCol2DateUnit(c.col2?.date_unit ?? "month");
    setMeasureKind(c.measure.kind);
    setMeasureFieldId(c.measure.kind === "count" ? "" : c.measure.field_id);
    setDisplay(c.display);
    setError("");
    setOpen(true);
  }

  function buildConfig(): AggregationConfig | null {
    if (!rowFieldId) {
      setError("集計キー（縦軸）を選択してください");
      return null;
    }
    if (measureKind !== "count" && !measureFieldId) {
      setError("合計/平均の対象となる数値フィールドを選択してください");
      return null;
    }
    if (type === "cross" && !colFieldId) {
      setError("クロス集計では横軸（第一キー）を選択してください");
      return null;
    }

    const config: AggregationConfig = {
      type,
      row: {
        field_id: rowFieldId,
        ...(isDateFieldId(fields, rowFieldId) ? { date_unit: rowDateUnit } : {}),
      },
      measure:
        measureKind === "count"
          ? { kind: "count" }
          : { kind: measureKind, field_id: measureFieldId },
      display,
    };

    if (type === "cross" && colFieldId) {
      config.col = {
        field_id: colFieldId,
        ...(isDateFieldId(fields, colFieldId) ? { date_unit: colDateUnit } : {}),
      };
      if (col2FieldId) {
        config.col2 = {
          field_id: col2FieldId,
          ...(isDateFieldId(fields, col2FieldId) ? { date_unit: col2DateUnit } : {}),
        };
      }
    }

    return config;
  }

  async function handleSave() {
    setError("");
    if (!name.trim()) {
      setError("集計の名前を入力してください");
      return;
    }
    const config = buildConfig();
    if (!config) return;

    if (editingId) {
      const { error: e } = await supabase
        .from("app_aggregations")
        .update({ name: name.trim(), config })
        .eq("id", editingId);
      if (e) {
        setError(`保存に失敗しました: ${e.message}`);
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
        return;
      }
    }
    setOpen(false);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("この集計を削除しますか？")) return;
    await supabase.from("app_aggregations").delete().eq("id", id);
    load();
  }

  const showRowDateUnit = isDateFieldId(fields, rowFieldId);
  const showColDateUnit = isDateFieldId(fields, colFieldId);
  const showCol2DateUnit = isDateFieldId(fields, col2FieldId);

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

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? "集計を編集" : "集計を追加"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSave}>保存</Button>
          </>
        }
      >
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

          <div className="space-y-1">
            <Select
              label={type === "cross" ? "縦軸（集計キー）" : "集計キー"}
              value={rowFieldId}
              onChange={(e) => setRowFieldId(e.target.value)}
              options={[{ label: "選択してください", value: "" }, ...fieldOptions]}
            />
            {showRowDateUnit && (
              <Select
                label="日付の単位"
                value={rowDateUnit}
                onChange={(e) => setRowDateUnit(e.target.value as DateUnit)}
                options={[
                  { label: "月単位", value: "month" },
                  { label: "日単位", value: "day" },
                ]}
              />
            )}
          </div>

          {type === "cross" && (
            <>
              <div className="space-y-1">
                <Select
                  label="横軸 第一キー"
                  value={colFieldId}
                  onChange={(e) => setColFieldId(e.target.value)}
                  options={[{ label: "選択してください", value: "" }, ...fieldOptions]}
                />
                {showColDateUnit && (
                  <Select
                    label="日付の単位"
                    value={colDateUnit}
                    onChange={(e) => setColDateUnit(e.target.value as DateUnit)}
                    options={[
                      { label: "月単位", value: "month" },
                      { label: "日単位", value: "day" },
                    ]}
                  />
                )}
              </div>
              <div className="space-y-1">
                <Select
                  label="横軸 第二キー（任意）"
                  value={col2FieldId}
                  onChange={(e) => setCol2FieldId(e.target.value)}
                  options={[{ label: "なし", value: "" }, ...fieldOptions]}
                />
                {showCol2DateUnit && (
                  <Select
                    label="日付の単位"
                    value={col2DateUnit}
                    onChange={(e) => setCol2DateUnit(e.target.value as DateUnit)}
                    options={[
                      { label: "月単位", value: "month" },
                      { label: "日単位", value: "day" },
                    ]}
                  />
                )}
              </div>
            </>
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

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </Modal>
    </div>
  );
}
