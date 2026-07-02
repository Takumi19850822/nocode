"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Badge, Modal } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import {
  FIELD_TYPE_LABELS,
  VIEW_TYPE_LABELS,
  type AppField,
  type AppView,
  type CalendarMode,
  type KanbanViewConfig,
  type ViewConfig,
  type ViewType,
} from "@/types";
import { Plus, Pencil, Trash2, LayoutGrid } from "lucide-react";

interface ViewSettingsProps {
  appId: string;
  fields: AppField[];
  listFieldIds: string[];
}

function FieldPicker({
  fields,
  selectedIds,
  onChange,
  label,
}: {
  fields: AppField[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  label: string;
}) {
  function toggle(fieldId: string) {
    if (selectedIds.includes(fieldId)) {
      onChange(selectedIds.filter((id) => id !== fieldId));
    } else {
      onChange([...selectedIds, fieldId]);
    }
  }

  function move(fieldId: string, direction: -1 | 1) {
    const index = selectedIds.indexOf(fieldId);
    if (index < 0) return;
    const next = [...selectedIds];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  const selectedSet = new Set(selectedIds);
  const selectedFields = selectedIds
    .map((id) => fields.find((f) => f.id === id))
    .filter((f): f is AppField => f != null);
  const unselectedFields = fields.filter((f) => !selectedSet.has(f.id));

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-600">{label}</p>
      {selectedFields.length > 0 && (
        <div className="space-y-1">
          {selectedFields.map((field, i) => (
            <div
              key={field.id}
              className="flex items-center gap-2 px-2 py-1.5 bg-blue-50 border border-blue-100 rounded-lg text-sm"
            >
              <input
                type="checkbox"
                checked
                onChange={() => toggle(field.id)}
                className="rounded border-gray-300"
              />
              <span className="flex-1 truncate">{field.label}</span>
              <button
                type="button"
                disabled={i === 0}
                onClick={() => move(field.id, -1)}
                className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={i === selectedFields.length - 1}
                onClick={() => move(field.id, 1)}
                className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      {unselectedFields.map((field) => (
        <label
          key={field.id}
          className="flex items-center gap-2 px-2 py-1.5 border border-gray-200 rounded-lg text-sm cursor-pointer hover:bg-gray-50"
        >
          <input
            type="checkbox"
            checked={false}
            onChange={() => toggle(field.id)}
            className="rounded border-gray-300"
          />
          <span className="flex-1 truncate">{field.label}</span>
          <span className="text-xs text-gray-400">{FIELD_TYPE_LABELS[field.field_type]}</span>
        </label>
      ))}
    </div>
  );
}

export function ViewSettings({ appId, fields, listFieldIds }: ViewSettingsProps) {
  const [views, setViews] = useState<AppView[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [viewType, setViewType] = useState<ViewType>("table");
  const [tableFieldIds, setTableFieldIds] = useState<string[]>([]);
  const [dateFieldId, setDateFieldId] = useState("");
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("month");
  const [calendarTitleFieldId, setCalendarTitleFieldId] = useState("");
  const [calendarExtraFieldIds, setCalendarExtraFieldIds] = useState<string[]>([]);
  const [statusFieldId, setStatusFieldId] = useState("");
  const [kanbanTitleFieldId, setKanbanTitleFieldId] = useState("");
  const [kanbanCardFieldIds, setKanbanCardFieldIds] = useState<string[]>([]);
  const [kanbanOptionOrder, setKanbanOptionOrder] = useState<string[]>([]);

  const supabase = createClient();

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("app_views")
      .select("*")
      .eq("app_id", appId)
      .order("sort_order");
    setViews((data as AppView[] | null) ?? []);
    setLoading(false);
  }, [appId]);

  useEffect(() => {
    load();
  }, [load]);

  const fieldOptions = fields.map((f) => ({ label: f.label || "(無名)", value: f.id }));
  const dateFieldOptions = fields
    .filter((f) => f.field_type === "date" || f.field_type === "datetime")
    .map((f) => ({ label: f.label || "(無名)", value: f.id }));
  const statusFieldOptions = fields
    .filter((f) => f.field_type === "select" || f.field_type === "radio")
    .map((f) => ({ label: f.label || "(無名)", value: f.id }));

  const selectedStatusField = fields.find((f) => f.id === statusFieldId);

  function resetForm() {
    setName("");
    setViewType("table");
    setTableFieldIds(listFieldIds.length > 0 ? [...listFieldIds] : fields.slice(0, 5).map((f) => f.id));
    setDateFieldId(dateFieldOptions[0]?.value ?? "");
    setCalendarMode("month");
    setCalendarTitleFieldId(fields[0]?.id ?? "");
    setCalendarExtraFieldIds([]);
    setStatusFieldId(statusFieldOptions[0]?.value ?? "");
    setKanbanTitleFieldId(fields[0]?.id ?? "");
    setKanbanCardFieldIds([]);
    setKanbanOptionOrder([]);
    setError("");
  }

  function openCreate() {
    setEditingId(null);
    resetForm();
    setOpen(true);
  }

  function openEdit(view: AppView) {
    const c = view.config;
    setEditingId(view.id);
    setName(view.name);
    setViewType(c.type);
    if (c.type === "table") {
      setTableFieldIds(c.field_ids);
    } else if (c.type === "calendar") {
      setDateFieldId(c.date_field_id);
      setCalendarMode(c.default_mode);
      setCalendarTitleFieldId(c.title_field_id ?? "");
      setCalendarExtraFieldIds(c.field_ids ?? []);
    } else {
      setStatusFieldId(c.status_field_id);
      setKanbanTitleFieldId(c.title_field_id);
      setKanbanCardFieldIds(c.card_field_ids);
      setKanbanOptionOrder(c.option_order ?? []);
    }
    setError("");
    setOpen(true);
  }

  function buildConfig(): ViewConfig | null {
    if (viewType === "table") {
      return { type: "table", field_ids: tableFieldIds };
    }
    if (viewType === "calendar") {
      if (!dateFieldId) {
        setError("日付フィールドを選択してください");
        return null;
      }
      return {
        type: "calendar",
        date_field_id: dateFieldId,
        default_mode: calendarMode,
        ...(calendarTitleFieldId ? { title_field_id: calendarTitleFieldId } : {}),
        ...(calendarExtraFieldIds.length > 0 ? { field_ids: calendarExtraFieldIds } : {}),
      };
    }
    if (!statusFieldId) {
      setError("ステータス（プルダウン）フィールドを選択してください");
      return null;
    }
    if (!kanbanTitleFieldId) {
      setError("カードのラベルフィールドを選択してください");
      return null;
    }
    const config: KanbanViewConfig = {
      type: "kanban",
      status_field_id: statusFieldId,
      title_field_id: kanbanTitleFieldId,
      card_field_ids: kanbanCardFieldIds,
    };
    if (kanbanOptionOrder.length > 0) {
      config.option_order = kanbanOptionOrder;
    }
    return config;
  }

  async function handleSave() {
    setError("");
    if (!name.trim()) {
      setError("ビュー名を入力してください");
      return;
    }
    const config = buildConfig();
    if (!config) return;

    if (editingId) {
      const { error: e } = await supabase
        .from("app_views")
        .update({ name: name.trim(), config })
        .eq("id", editingId);
      if (e) {
        setError(`保存に失敗しました: ${e.message}`);
        return;
      }
    } else {
      const { error: e } = await supabase.from("app_views").insert({
        app_id: appId,
        name: name.trim(),
        config,
        sort_order: views.length,
      });
      if (e) {
        const hint = e.message.includes("app_views")
          ? "（012_app_views.sql のマイグレーション未実行の可能性があります）"
          : "";
        setError(`保存に失敗しました: ${e.message}${hint}`);
        return;
      }
    }
    setOpen(false);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("このビューを削除しますか？")) return;
    await supabase.from("app_views").delete().eq("id", id);
    load();
  }

  function moveKanbanOption(value: string, direction: -1 | 1) {
    const statusField = fields.find((f) => f.id === statusFieldId);
    if (!statusField) return;
    const base =
      kanbanOptionOrder.length > 0
        ? kanbanOptionOrder
        : statusField.options.map((o) => o.value);
    const index = base.indexOf(value);
    if (index < 0) return;
    const next = [...base];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setKanbanOptionOrder(next);
  }

  const kanbanColumns =
    selectedStatusField?.options.map((o) => o.value) ?? [];
  const displayKanbanOrder =
    kanbanOptionOrder.length > 0 ? kanbanOptionOrder : kanbanColumns;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          一覧・カレンダー・カンバンのビューを作成できます。実行画面で切り替えて表示します。
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" />
          追加
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">読み込み中...</p>
      ) : views.length === 0 ? (
        <p className="text-sm text-gray-400">
          ビューはまだありません。未設定時は「一覧表示」の設定が使われます。
        </p>
      ) : (
        <ul className="space-y-2">
          {views.map((view) => (
            <li
              key={view.id}
              className="flex items-center justify-between gap-2 border border-gray-200 rounded-lg px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <LayoutGrid className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="truncate text-sm font-medium">{view.name}</span>
                <Badge>{VIEW_TYPE_LABELS[view.config.type]}</Badge>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => openEdit(view)}
                  className="text-gray-400 hover:text-blue-600 p-1"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(view.id)}
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
        title={editingId ? "ビューを編集" : "ビューを追加"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSave}>保存</Button>
          </>
        }
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <Input
            label="名前"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 月間スケジュール"
            required
          />

          <Select
            label="ビュータイプ"
            value={viewType}
            onChange={(e) => setViewType(e.target.value as ViewType)}
            options={[
              { label: "一覧（表）", value: "table" },
              { label: "カレンダー", value: "calendar" },
              { label: "カンバン", value: "kanban" },
            ]}
          />

          {viewType === "table" && (
            <FieldPicker
              fields={fields}
              selectedIds={tableFieldIds}
              onChange={setTableFieldIds}
              label="表示するフィールド（順番）"
            />
          )}

          {viewType === "calendar" && (
            <>
              <Select
                label="日付フィールド"
                value={dateFieldId}
                onChange={(e) => setDateFieldId(e.target.value)}
                options={[
                  { label: "選択してください", value: "" },
                  ...dateFieldOptions,
                ]}
              />
              <Select
                label="初期表示"
                value={calendarMode}
                onChange={(e) => setCalendarMode(e.target.value as CalendarMode)}
                options={[
                  { label: "日", value: "day" },
                  { label: "週", value: "week" },
                  { label: "月", value: "month" },
                ]}
              />
              <Select
                label="イベントのタイトル（任意）"
                value={calendarTitleFieldId}
                onChange={(e) => setCalendarTitleFieldId(e.target.value)}
                options={[{ label: "なし", value: "" }, ...fieldOptions]}
              />
              <FieldPicker
                fields={fields}
                selectedIds={calendarExtraFieldIds}
                onChange={setCalendarExtraFieldIds}
                label="イベント内に表示するフィールド（任意）"
              />
            </>
          )}

          {viewType === "kanban" && (
            <>
              <Select
                label="ステータス（列）フィールド"
                value={statusFieldId}
                onChange={(e) => {
                  setStatusFieldId(e.target.value);
                  setKanbanOptionOrder([]);
                }}
                options={[
                  { label: "選択してください", value: "" },
                  ...statusFieldOptions,
                ]}
              />
              <p className="text-xs text-gray-500 -mt-2">
                プルダウンまたはラジオボタンを指定。左から選択肢の順に列が並びます。
              </p>
              <Select
                label="カードのラベル"
                value={kanbanTitleFieldId}
                onChange={(e) => setKanbanTitleFieldId(e.target.value)}
                options={[
                  { label: "選択してください", value: "" },
                  ...fieldOptions,
                ]}
              />
              <FieldPicker
                fields={fields}
                selectedIds={kanbanCardFieldIds}
                onChange={setKanbanCardFieldIds}
                label="カードに表示する値"
              />
              {selectedStatusField && displayKanbanOrder.length > 0 && (
                <div className="space-y-1 rounded-lg border border-gray-200 p-3">
                  <p className="text-xs font-medium text-gray-600">列の並び順</p>
                  {displayKanbanOrder.map((val, i) => {
                    const opt = selectedStatusField.options.find((o) => o.value === val);
                    return (
                      <div
                        key={val}
                        className="flex items-center gap-2 px-2 py-1 bg-gray-50 rounded text-sm"
                      >
                        <span className="flex-1 truncate">{opt?.label ?? val}</span>
                        <button
                          type="button"
                          disabled={i === 0}
                          onClick={() => moveKanbanOption(val, -1)}
                          className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={i === displayKanbanOrder.length - 1}
                          onClick={() => moveKanbanOption(val, 1)}
                          className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </Modal>
    </div>
  );
}
