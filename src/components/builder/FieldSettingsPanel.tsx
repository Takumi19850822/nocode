"use client";

import { Button } from "@/components/ui/Button";
import { FieldEditor } from "./FieldEditor";
import { FieldTypePicker, defaultConfigForType } from "./FieldTypePicker";
import type { AppField, FieldType } from "@/types";
import { FIELD_TYPE_LABELS } from "@/types";

type PanelMode = "idle" | "add" | "edit";

interface FieldSettingsPanelProps {
  mode: PanelMode;
  field: AppField | null;
  allFields: AppField[];
  allApps: { id: string; name: string }[];
  tenantId: string;
  onFieldChange: (field: AppField) => void;
  onTypeChange: (type: FieldType) => void;
  onConfirmAdd: () => void;
  onCancelAdd: () => void;
  onDelete?: () => void;
}

export function FieldSettingsPanel({
  mode,
  field,
  allFields,
  allApps,
  tenantId,
  onFieldChange,
  onTypeChange,
  onConfirmAdd,
  onCancelAdd,
  onDelete,
}: FieldSettingsPanelProps) {
  if (mode === "idle") {
    return (
      <div className="text-center py-12 px-2">
        <p className="text-sm text-gray-400">
          「フィールド追加」ボタンで新規作成、
          <br />
          またはキャンバスのフィールドをクリックして編集
        </p>
      </div>
    );
  }

  if (!field) return null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-700">
          {mode === "add" ? "フィールドを追加" : "フィールド設定"}
        </h3>
        {mode === "add" && (
          <p className="text-xs text-gray-500 mt-1">
            種類を選び、設定してから「追加」を押してください
          </p>
        )}
        {mode === "edit" && (
          <p className="text-xs text-gray-500 mt-1">
            {FIELD_TYPE_LABELS[field.field_type]}
          </p>
        )}
      </div>

      {mode === "add" && (
        <FieldTypePicker value={field.field_type} onChange={onTypeChange} />
      )}

      <FieldEditor
        field={field}
        allFields={mode === "add" ? allFields : allFields}
        allApps={allApps}
        tenantId={tenantId}
        onChange={onFieldChange}
        showTypeLabel={mode === "edit"}
      />

      <div className="flex gap-2 pt-2 border-t border-gray-100">
        {mode === "add" ? (
          <>
            <Button variant="secondary" className="flex-1" onClick={onCancelAdd}>
              キャンセル
            </Button>
            <Button className="flex-1" onClick={onConfirmAdd}>
              追加
            </Button>
          </>
        ) : (
          onDelete && (
            <Button variant="danger" className="w-full" onClick={onDelete}>
              フィールドを削除
            </Button>
          )
        )}
      </div>
    </div>
  );
}

export function createDraftField(appId: string, sortOrder: number, type: FieldType = "text"): AppField {
  const label = "";
  const { options, config } = defaultConfigForType(type);
  return {
    id: "__draft__",
    app_id: appId,
    name: "",
    label,
    field_type: type,
    is_required: false,
    sort_order: sortOrder,
    width: 100,
    placeholder: "",
    default_value: "",
    options,
    config,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function applyTypeToField(field: AppField, type: FieldType): AppField {
  const { options, config } = defaultConfigForType(type);
  return { ...field, field_type: type, options, config };
}
