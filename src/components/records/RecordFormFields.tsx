"use client";

import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { evaluateExpression, formatNumberWithCommas, stripNumberCommas } from "@/lib/utils";
import { fieldGridColumn } from "@/types";
import type {
  AppField,
  CalculationFieldConfig,
  NumberFieldConfig,
  SearchFieldConfig,
} from "@/types";
import { Search } from "lucide-react";

interface RecordFormFieldsProps {
  fields: AppField[];
  formValues: Record<string, string>;
  onValuesChange: (next: Record<string, string>) => void;
  currentUserName?: string;
  searchQuery?: Record<string, string>;
  onSearchQueryChange?: (fieldId: string, query: string) => void;
  searchResults?: Record<string, unknown[]>;
  onSearch?: (field: AppField) => void;
  onApplySearchResult?: (
    field: AppField,
    result: { record_id: string; values: Record<string, string> }
  ) => void;
}

export function RecordFormFields({
  fields,
  formValues,
  onValuesChange,
  currentUserName = "",
  searchQuery = {},
  onSearchQueryChange,
  searchResults = {},
  onSearch,
  onApplySearchResult,
}: RecordFormFieldsProps) {
  function setValue(fieldId: string, value: string) {
    const next = { ...formValues, [fieldId]: value };
    fields
      .filter((f) => f.field_type === "calculation")
      .forEach((f) => {
        const cfg = f.config as CalculationFieldConfig;
        const numValues: Record<string, number> = {};
        fields.forEach((ff) => {
          if (ff.field_type === "number" || ff.field_type === "calculation") {
            numValues[ff.name] = Number(next[ff.id] ?? 0);
          }
        });
        const result = evaluateExpression(cfg.expression, numValues);
        if (result !== null) next[f.id] = String(result);
      });
    onValuesChange(next);
  }

  function fieldWrapper(field: AppField, content: React.ReactNode) {
    return (
      <div
        key={field.id}
        style={{
          gridColumn: fieldGridColumn(field.width, field.break_before),
        }}
        className="min-w-0"
      >
        {content}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-10 gap-3 auto-rows-min">
      {fields.map((field) => {
        const value = formValues[field.id] ?? "";

        switch (field.field_type) {
          case "textarea":
            return fieldWrapper(
              field,
              <Textarea
                label={field.label}
                value={value}
                onChange={(e) => setValue(field.id, e.target.value)}
                required={field.is_required}
                placeholder={field.placeholder}
              />
            );
          case "number": {
            const numCfg = field.config as NumberFieldConfig;
            const useComma = numCfg.use_comma_separator ?? false;
            return fieldWrapper(
              field,
              useComma ? (
                <Input
                  label={field.label}
                  type="text"
                  inputMode="decimal"
                  value={formatNumberWithCommas(value)}
                  onChange={(e) => {
                    const raw = stripNumberCommas(e.target.value);
                    if (raw === "" || /^-?\d*\.?\d*$/.test(raw)) setValue(field.id, raw);
                  }}
                  required={field.is_required}
                  placeholder={field.placeholder}
                />
              ) : (
                <Input
                  label={field.label}
                  type="number"
                  value={value}
                  onChange={(e) => setValue(field.id, e.target.value)}
                  required={field.is_required}
                  placeholder={field.placeholder}
                />
              )
            );
          }
          case "date":
            return fieldWrapper(
              field,
              <Input
                label={field.label}
                type="date"
                value={value}
                onChange={(e) => setValue(field.id, e.target.value)}
                required={field.is_required}
              />
            );
          case "datetime":
            return fieldWrapper(
              field,
              <Input
                label={field.label}
                type="datetime-local"
                value={value}
                onChange={(e) => setValue(field.id, e.target.value)}
                required={field.is_required}
              />
            );
          case "select":
            return fieldWrapper(
              field,
              <Select
                label={field.label}
                value={value}
                onChange={(e) => setValue(field.id, e.target.value)}
                required={field.is_required}
                options={[
                  { label: "選択してください", value: "" },
                  ...field.options.map((o) => ({ label: o.label, value: o.value })),
                ]}
              />
            );
          case "radio":
            return fieldWrapper(
              field,
              <fieldset>
                <legend className="text-sm font-medium text-gray-700 mb-1">
                  {field.label}
                  {field.is_required && <span className="text-red-500 ml-1">*</span>}
                </legend>
                <div className="space-y-1">
                  {field.options.map((o) => (
                    <label key={o.value} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={field.id}
                        value={o.value}
                        checked={value === o.value}
                        onChange={() => setValue(field.id, o.value)}
                        required={field.is_required}
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          case "checkbox":
            return fieldWrapper(
              field,
              <fieldset>
                <legend className="text-sm font-medium text-gray-700 mb-1">{field.label}</legend>
                <div className="space-y-1">
                  {field.options.map((o) => {
                    const checked = value.split(",").includes(o.value);
                    return (
                      <label key={o.value} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const current = value ? value.split(",") : [];
                            const next = checked
                              ? current.filter((v) => v !== o.value)
                              : [...current, o.value];
                            setValue(field.id, next.join(","));
                          }}
                        />
                        {o.label}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );
          case "search":
            return fieldWrapper(
              field,
              <>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {field.label}
                  {field.is_required && <span className="text-red-500 ml-1">*</span>}
                </label>
                <div className="flex gap-2">
                  <input
                    className="flex-1 px-3 py-2 border rounded-lg text-sm"
                    value={searchQuery[field.id] ?? ""}
                    onChange={(e) => onSearchQueryChange?.(field.id, e.target.value)}
                    placeholder="検索..."
                  />
                  <Button type="button" size="sm" onClick={() => onSearch?.(field)}>
                    <Search className="w-4 h-4" />
                  </Button>
                </div>
                {(searchResults[field.id]?.length ?? 0) > 0 && (
                  <ul className="mt-1 border rounded-lg divide-y max-h-40 overflow-y-auto">
                    {(
                      searchResults[field.id] as Array<{
                        record_id: string;
                        values: Record<string, string>;
                      }>
                    ).map((r) => {
                      const cfg = field.config as SearchFieldConfig;
                      const display = r.values[cfg.display_field_id] ?? r.record_id;
                      return (
                        <li key={r.record_id}>
                          <button
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50"
                            onClick={() => onApplySearchResult?.(field, r)}
                          >
                            {display}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {value && <p className="text-xs text-gray-500 mt-1">選択: {value}</p>}
              </>
            );
          case "calculation":
            return fieldWrapper(
              field,
              <Input label={field.label} value={value} readOnly className="bg-gray-50 font-mono" />
            );
          case "login_user":
            return fieldWrapper(
              field,
              <Input
                label={field.label}
                value={value || currentUserName}
                readOnly
                className="bg-gray-50"
                placeholder={currentUserName ? undefined : "（氏名未設定）"}
              />
            );
          default:
            return fieldWrapper(
              field,
              <Input
                label={field.label}
                value={value}
                onChange={(e) => setValue(field.id, e.target.value)}
                required={field.is_required}
                placeholder={field.placeholder}
              />
            );
        }
      })}
    </div>
  );
}
