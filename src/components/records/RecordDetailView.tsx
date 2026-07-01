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
    <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 auto-rows-min">
      {fields.map((field) => (
        <div
          key={field.id}
          style={{
            gridColumn: fieldGridColumn(field.width, field.break_before),
          }}
          className="field-layout-item min-w-0"
        >
          <dt className="text-xs font-medium text-gray-500 mb-1">{field.label}</dt>
          <dd className="text-sm text-gray-900 whitespace-pre-wrap break-words">
            {formatFieldDisplayValue(field, values[field.id])}
          </dd>
        </div>
      ))}
    </div>
  );
}
