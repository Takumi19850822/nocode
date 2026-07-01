"use client";

import { formatFieldDisplayValue } from "@/lib/records/formatFieldValue";
import { fieldGridColumn } from "@/types";
import type { AppField } from "@/types";

interface RecordDetailViewProps {
  fields: AppField[];
  values: Record<string, string>;
}

export function RecordDetailView({ fields, values }: RecordDetailViewProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-10 gap-3 auto-rows-min">
      {fields.map((field) => {
        const raw = values[field.id];
        const display = formatFieldDisplayValue(field, raw);
        const isEmpty = !raw || display === "-";

        return (
          <div
            key={field.id}
            style={{
              gridColumn: fieldGridColumn(field.width, field.break_before),
            }}
            className="field-layout-item min-w-0 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2.5"
          >
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
              {field.label}
            </dt>
            <dd
              className={
                isEmpty
                  ? "text-sm text-gray-300 italic"
                  : "text-[15px] font-medium text-gray-900 whitespace-pre-wrap break-words leading-relaxed"
              }
            >
              {display}
            </dd>
          </div>
        );
      })}
    </div>
  );
}
