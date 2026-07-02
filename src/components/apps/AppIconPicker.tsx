"use client";

import { cn } from "@/lib/utils";
import { APP_ICON_OPTIONS, DEFAULT_APP_ICON, type AppIconKey } from "@/lib/apps/appIcons";

interface AppIconPickerProps {
  value: AppIconKey;
  onChange: (key: AppIconKey) => void;
}

export function AppIconPicker({ value, onChange }: AppIconPickerProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">アイコン</p>
      <p className="text-xs text-gray-500">
        サイドバーのアプリ一覧に表示されます
      </p>
      <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-8">
        {APP_ICON_OPTIONS.map(({ key, label, Icon }) => {
          const selected = value === key;
          return (
            <button
              key={key}
              type="button"
              title={label}
              onClick={() => onChange(key)}
              className={cn(
                "flex items-center justify-center w-9 h-9 rounded-lg border transition-colors",
                selected
                  ? "border-blue-500 bg-blue-50 text-blue-600"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
              )}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { DEFAULT_APP_ICON };
