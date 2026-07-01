"use client";

import { Input, Checkbox, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FIELD_TYPE_LABELS } from "@/types";
import type { AppField, FieldType, DateFieldConfig, NumberFieldConfig } from "@/types";
import { SearchFieldConfigPanel } from "./SearchFieldConfig";
import { CalculationWizard } from "./CalculationWizard";
import { prefectureOptions } from "@/lib/constants/prefectures";
import { Plus, Trash2 } from "lucide-react";

interface FieldEditorProps {
  field: AppField;
  allFields: AppField[];
  allApps: { id: string; name: string }[];
  tenantId: string;
  onChange: (field: AppField) => void;
  showTypeLabel?: boolean;
}

export function FieldEditor({
  field,
  allFields,
  allApps,
  tenantId,
  onChange,
  showTypeLabel = false,
}: FieldEditorProps) {
  function update(partial: Partial<AppField>) {
    onChange({ ...field, ...partial });
  }

  function updateOption(index: number, key: "label" | "value", val: string) {
    const options = [...field.options];
    options[index] = { ...options[index], [key]: val };
    update({ options });
  }

  function addOption() {
    update({
      options: [...field.options, { label: `選択肢${field.options.length + 1}`, value: String(field.options.length + 1) }],
    });
  }

  function removeOption(index: number) {
    update({ options: field.options.filter((_, i) => i !== index) });
  }

  function addPrefectures() {
    const existing = new Set(field.options.map((o) => o.label));
    const toAdd = prefectureOptions().filter((o) => !existing.has(o.label));
    update({ options: [...field.options, ...toAdd] });
  }

  function updateConfig(partial: Record<string, unknown>) {
    update({ config: { ...(field.config as Record<string, unknown>), ...partial } });
  }

  const hasOptions: FieldType[] = ["select", "radio", "checkbox"];
  const dateConfig = field.config as DateFieldConfig;
  const numberConfig = field.config as NumberFieldConfig;

  return (
    <div className="space-y-4">
      {showTypeLabel && (
        <p className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">
          種類: {FIELD_TYPE_LABELS[field.field_type]}
        </p>
      )}

      <Input
        label="ラベル"
        value={field.label}
        onChange={(e) => update({ label: e.target.value })}
      />
      <Input
        label="フィールド名（内部ID）"
        value={field.name}
        onChange={(e) => update({ name: e.target.value })}
      />
      {field.field_type !== "login_user" && (
        <Input
          label="プレースホルダー"
          value={field.placeholder}
          onChange={(e) => update({ placeholder: e.target.value })}
        />
      )}
      {field.field_type === "login_user" && (
        <p className="text-xs text-gray-500 bg-blue-50 rounded px-3 py-2">
          レコード作成時に、ログインユーザーの氏名（プロフィールの氏名）が自動入力されます（編集不可）。
        </p>
      )}
      <Checkbox
        label="必須項目"
        checked={field.is_required}
        onChange={(e) => update({ is_required: e.target.checked })}
      />
      <Checkbox
        label="このフィールドから改行する（新しい行に配置）"
        checked={field.break_before ?? false}
        onChange={(e) => update({ break_before: e.target.checked })}
      />

      {field.field_type === "date" && (
        <Checkbox
          label="デフォルトを本日の日付にする"
          checked={dateConfig.default_to_today ?? false}
          onChange={(e) => updateConfig({ default_to_today: e.target.checked })}
        />
      )}

      {field.field_type === "number" && (
        <Checkbox
          label="3桁ごとにカンマを表示する"
          checked={numberConfig.use_comma_separator ?? false}
          onChange={(e) => updateConfig({ use_comma_separator: e.target.checked })}
        />
      )}

      {hasOptions.includes(field.field_type) && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">選択肢</label>
          {field.options.map((opt, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="flex-1 px-2 py-1 border rounded text-sm"
                value={opt.label}
                onChange={(e) => updateOption(i, "label", e.target.value)}
                placeholder="ラベル"
              />
              <input
                className="w-20 px-2 py-1 border rounded text-sm"
                value={opt.value}
                onChange={(e) => updateOption(i, "value", e.target.value)}
                placeholder="値"
              />
              <button onClick={() => removeOption(i)} className="text-red-400 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={addOption}>
              <Plus className="w-3 h-3 mr-1" />
              選択肢追加
            </Button>
            {field.field_type === "select" && (
              <Button variant="ghost" size="sm" onClick={addPrefectures}>
                都道府県を追加
              </Button>
            )}
          </div>
        </div>
      )}

      {field.field_type === "search" && (
        <SearchFieldConfigPanel
          config={field.config as import("@/types").SearchFieldConfig}
          currentAppId={field.app_id}
          allApps={allApps}
          currentFields={allFields}
          tenantId={tenantId}
          onChange={(config) => update({ config })}
        />
      )}

      {field.field_type === "calculation" && (
        <CalculationWizard
          config={field.config as import("@/types").CalculationFieldConfig}
          availableFields={allFields.filter(
            (f) => f.id !== field.id && (f.field_type === "number" || f.field_type === "calculation")
          )}
          onChange={(config) => update({ config })}
        />
      )}
    </div>
  );
}
