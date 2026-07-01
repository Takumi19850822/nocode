"use client";

import { FIELD_TYPE_LABELS } from "@/types";
import type { FieldType } from "@/types";
import {
  Type,
  AlignLeft,
  Hash,
  Calendar,
  Clock,
  Timer,
  ChevronDown,
  Circle,
  CheckSquare,
  Search,
  Calculator,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

const FIELD_ICONS: Record<FieldType, React.ComponentType<{ className?: string }>> = {
  text: Type,
  textarea: AlignLeft,
  number: Hash,
  date: Calendar,
  datetime: Clock,
  duration: Timer,
  select: ChevronDown,
  radio: Circle,
  checkbox: CheckSquare,
  search: Search,
  calculation: Calculator,
  login_user: User,
};

interface FieldTypePickerProps {
  value: FieldType;
  onChange: (type: FieldType) => void;
}

export function FieldTypePicker({ value, onChange }: FieldTypePickerProps) {
  const types = Object.keys(FIELD_TYPE_LABELS) as FieldType[];

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">フィールド種類</label>
      <div className="grid grid-cols-2 gap-2">
        {types.map((type) => {
          const Icon = FIELD_ICONS[type];
          const selected = value === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => onChange(type)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-colors",
                selected
                  ? "border-blue-500 bg-blue-50 text-blue-800 ring-1 ring-blue-200"
                  : "border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0", selected ? "text-blue-600" : "text-gray-500")} />
              <span className="truncate">{FIELD_TYPE_LABELS[type]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** フィールド種類変更時の type 固有設定を初期化 */
export function defaultConfigForType(type: FieldType): Pick<AppFieldLike, "options" | "config"> {
  return {
    options:
      type === "select" || type === "radio" || type === "checkbox"
        ? [{ label: "選択肢1", value: "1" }]
        : [],
    config:
      type === "search"
        ? { source_app_id: "", source_field_id: "", display_field_id: "", mappings: [] }
        : type === "calculation"
          ? { expression: "", tokens: [] }
          : {},
  };
}

interface AppFieldLike {
  options: { label: string; value: string }[];
  config: Record<string, unknown>;
}
