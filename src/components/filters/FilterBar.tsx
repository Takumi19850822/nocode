"use client";

import { v4 as uuidv4 } from "uuid";
import { Plus, Filter as FilterIcon, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import {
  defaultOperatorForField,
  filterKindForField,
  operatorNeedsMultiValue,
  operatorNeedsValue,
  operatorsForField,
} from "@/lib/filters/fieldFilterMeta";
import type { AppField, FilterCondition, FilterConfig, FilterLogic } from "@/types";

interface FilterBarProps {
  fields: AppField[];
  value: FilterConfig;
  onChange: (next: FilterConfig) => void;
  /** true の場合、常に展開表示（設定画面用）。false は折りたたみ可能なポップオーバー的表示は行わず常時展開のみサポート */
  compact?: boolean;
}

function emptyCondition(field: AppField | undefined): FilterCondition {
  return {
    id: uuidv4(),
    field_id: field?.id ?? "",
    operator: defaultOperatorForField(field),
  };
}

export function FilterBar({ fields, value, onChange, compact = false }: FilterBarProps) {
  const conditions = value.conditions;

  function updateCondition(id: string, patch: Partial<FilterCondition>) {
    onChange({
      ...value,
      conditions: conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  }

  function addCondition() {
    onChange({ ...value, conditions: [...conditions, emptyCondition(fields[0])] });
  }

  function removeCondition(id: string) {
    onChange({ ...value, conditions: conditions.filter((c) => c.id !== id) });
  }

  function changeField(id: string, fieldId: string) {
    const field = fields.find((f) => f.id === fieldId);
    updateCondition(id, {
      field_id: fieldId,
      operator: defaultOperatorForField(field),
      value: undefined,
      values: undefined,
    });
  }

  function setLogic(logic: FilterLogic) {
    onChange({ ...value, logic });
  }

  const fieldOptions = fields.map((f) => ({ label: f.label || "(無名)", value: f.id }));

  return (
    <div className={compact ? "space-y-2" : "space-y-3 rounded-lg border border-gray-200 bg-gray-50/60 p-3"}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
          <FilterIcon className="w-3.5 h-3.5" />
          絞り込み
        </div>
        {conditions.length > 0 && (
          <button
            type="button"
            onClick={() => onChange({ ...value, conditions: [] })}
            className="text-xs text-gray-400 hover:text-red-600"
          >
            条件をクリア
          </button>
        )}
      </div>

      {conditions.length === 0 ? (
        <button
          type="button"
          onClick={addCondition}
          disabled={fields.length === 0}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 disabled:text-gray-300"
        >
          <Plus className="w-3.5 h-3.5" />
          条件を追加
        </button>
      ) : (
        <div className="space-y-2">
          {conditions.map((cond, i) => {
            const field = fields.find((f) => f.id === cond.field_id);
            const kind = filterKindForField(field);
            const ops = operatorsForField(field);
            const needsValue = operatorNeedsValue(cond.operator);
            const needsMulti = operatorNeedsMultiValue(cond.operator);

            return (
              <div key={cond.id} className="flex flex-col sm:flex-row sm:items-start gap-1.5">
                {i > 0 && (
                  <div className="hidden sm:flex items-center justify-center w-14 shrink-0 pt-2 text-xs font-semibold text-gray-400">
                    {value.logic === "or" ? "または" : "かつ"}
                  </div>
                )}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-1.5 min-w-0">
                  <Select
                    value={cond.field_id}
                    onChange={(e) => changeField(cond.id, e.target.value)}
                    options={[{ label: "フィールド", value: "" }, ...fieldOptions]}
                  />
                  <Select
                    value={cond.operator}
                    onChange={(e) =>
                      updateCondition(cond.id, {
                        operator: e.target.value as FilterCondition["operator"],
                        value: undefined,
                        values: undefined,
                      })
                    }
                    options={ops.map((o) => ({ label: o.label, value: o.value }))}
                  />
                  {needsValue ? (
                    needsMulti ? (
                      kind === "select" && field ? (
                        <div className="flex flex-wrap gap-1 items-center px-2 py-1.5 border border-gray-300 rounded-lg bg-white min-h-[38px]">
                          {field.options.map((opt) => {
                            const checked = (cond.values ?? []).includes(opt.value);
                            return (
                              <label
                                key={opt.value}
                                className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-gray-100 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  className="rounded"
                                  checked={checked}
                                  onChange={() => {
                                    const cur = new Set(cond.values ?? []);
                                    if (checked) cur.delete(opt.value);
                                    else cur.add(opt.value);
                                    updateCondition(cond.id, { values: [...cur] });
                                  }}
                                />
                                {opt.label}
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <Input
                          placeholder="値をカンマ区切りで入力"
                          value={(cond.values ?? []).join(",")}
                          onChange={(e) =>
                            updateCondition(cond.id, {
                              values: e.target.value.split(",").map((v) => v.trim()).filter(Boolean),
                            })
                          }
                        />
                      )
                    ) : kind === "date" ? (
                      <Input
                        type="date"
                        value={cond.value ?? ""}
                        onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                      />
                    ) : kind === "number" ? (
                      <Input
                        type="number"
                        value={cond.value ?? ""}
                        onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                      />
                    ) : kind === "select" && field ? (
                      <Select
                        value={cond.value ?? ""}
                        onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                        options={[
                          { label: "選択してください", value: "" },
                          ...field.options.map((o) => ({ label: o.label, value: o.value })),
                        ]}
                      />
                    ) : (
                      <Input
                        value={cond.value ?? ""}
                        onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                        placeholder="値"
                      />
                    )
                  ) : (
                    <div className="hidden sm:block" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeCondition(cond.id)}
                  className="shrink-0 self-start sm:self-center p-2 text-gray-400 hover:text-red-600"
                  title="条件を削除"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              条件の関係:
              <div className="flex rounded-md border border-gray-300 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setLogic("and")}
                  className={`px-2 py-1 ${value.logic === "and" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                >
                  かつ (AND)
                </button>
                <button
                  type="button"
                  onClick={() => setLogic("or")}
                  className={`px-2 py-1 ${value.logic === "or" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                >
                  または (OR)
                </button>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={addCondition}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              条件を追加
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function filterHasConditions(filter: FilterConfig | undefined): boolean {
  return Boolean(filter && filter.conditions.length > 0);
}
