"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { FIELD_TYPE_LABELS } from "@/types";
import type { AppField } from "@/types";

interface ListFieldSettingsProps {
  fields: AppField[];
  listFieldIds: string[];
  onChange: (ids: string[]) => void;
}

export function ListFieldSettings({ fields, listFieldIds, onChange }: ListFieldSettingsProps) {
  function toggle(fieldId: string) {
    if (listFieldIds.includes(fieldId)) {
      onChange(listFieldIds.filter((id) => id !== fieldId));
    } else {
      onChange([...listFieldIds, fieldId]);
    }
  }

  function move(fieldId: string, direction: -1 | 1) {
    const index = listFieldIds.indexOf(fieldId);
    if (index < 0) return;
    const next = [...listFieldIds];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  if (fields.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-4">
        フィールドを追加すると一覧表示を設定できます
      </p>
    );
  }

  const selectedSet = new Set(listFieldIds);
  const selectedFields = listFieldIds
    .map((id) => fields.find((f) => f.id === id))
    .filter((f): f is AppField => f != null);
  const unselectedFields = fields.filter((f) => !selectedSet.has(f.id));

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        レコード一覧に表示するフィールドを選びます。未選択の場合は先頭5件が表示されます。
      </p>

      {selectedFields.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-600">表示する（順番）</p>
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
              <span className="flex-1 truncate font-medium text-gray-800">{field.label}</span>
              <span className="text-xs text-gray-400 shrink-0">
                {FIELD_TYPE_LABELS[field.field_type]}
              </span>
              <button
                type="button"
                disabled={i === 0}
                onClick={() => move(field.id, -1)}
                className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                title="上へ"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={i === selectedFields.length - 1}
                onClick={() => move(field.id, 1)}
                className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                title="下へ"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {unselectedFields.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-600">未選択</p>
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
              <span className="flex-1 truncate text-gray-700">{field.label}</span>
              <span className="text-xs text-gray-400 shrink-0">
                {FIELD_TYPE_LABELS[field.field_type]}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
