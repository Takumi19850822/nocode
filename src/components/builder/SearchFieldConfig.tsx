"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { SearchFieldConfig, SearchFieldMapping, AppField } from "@/types";
import { Plus, Trash2, ArrowRight } from "lucide-react";

interface SearchFieldConfigPanelProps {
  config: SearchFieldConfig;
  currentAppId: string;
  allApps: { id: string; name: string }[];
  currentFields: AppField[];
  tenantId: string;
  onChange: (config: SearchFieldConfig) => void;
}

export function SearchFieldConfigPanel({
  config,
  currentAppId,
  allApps,
  currentFields,
  tenantId,
  onChange,
}: SearchFieldConfigPanelProps) {
  const [sourceFields, setSourceFields] = useState<AppField[]>([]);
  const supabase = createClient();

  const cfg: SearchFieldConfig = config ?? {
    source_app_id: "",
    source_field_id: "",
    display_field_id: "",
    mappings: [],
  };

  useEffect(() => {
    if (cfg.source_app_id) {
      loadSourceFields(cfg.source_app_id);
    }
  }, [cfg.source_app_id]);

  async function loadSourceFields(appId: string) {
    const { data } = await supabase
      .from("app_fields")
      .select("*")
      .eq("app_id", appId)
      .order("sort_order");
    setSourceFields(data ?? []);
  }

  function update(partial: Partial<SearchFieldConfig>) {
    onChange({ ...cfg, ...partial });
  }

  function addMapping() {
    update({
      mappings: [
        ...cfg.mappings,
        { source_field_id: "", target_field_id: "" },
      ],
    });
  }

  function updateMapping(index: number, partial: Partial<SearchFieldMapping>) {
    const mappings = [...cfg.mappings];
    mappings[index] = { ...mappings[index], ...partial };
    update({ mappings });
  }

  function removeMapping(index: number) {
    update({ mappings: cfg.mappings.filter((_, i) => i !== index) });
  }

  const searchableApps = allApps.filter((a) => a.id !== currentAppId);

  return (
    <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
      <h4 className="text-sm font-semibold text-blue-800">検索設定</h4>

      <Select
        label="検索対象アプリ"
        value={cfg.source_app_id}
        onChange={(e) => {
          update({
            source_app_id: e.target.value,
            source_field_id: "",
            display_field_id: "",
            mappings: [],
          });
        }}
        options={[
          { label: "選択してください", value: "" },
          ...searchableApps.map((a) => ({ label: a.name, value: a.id })),
        ]}
      />

      {cfg.source_app_id && (
        <>
          <Select
            label="検索キーフィールド"
            value={cfg.source_field_id}
            onChange={(e) => update({ source_field_id: e.target.value })}
            options={[
              { label: "選択してください", value: "" },
              ...sourceFields.map((f) => ({ label: f.label, value: f.id })),
            ]}
          />

          <Select
            label="表示フィールド（検索結果に表示）"
            value={cfg.display_field_id}
            onChange={(e) => update({ display_field_id: e.target.value })}
            options={[
              { label: "選択してください", value: "" },
              ...sourceFields.map((f) => ({ label: f.label, value: f.id })),
            ]}
          />

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              転記マッピング
            </label>
            <p className="text-xs text-gray-500">
              検索結果のフィールド値を、現在のアプリのフィールドに自動転記します
            </p>

            {cfg.mappings.map((mapping, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  className="flex-1 px-2 py-1.5 border rounded text-sm bg-white"
                  value={mapping.source_field_id}
                  onChange={(e) => updateMapping(i, { source_field_id: e.target.value })}
                >
                  <option value="">元フィールド</option>
                  {sourceFields.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
                <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />
                <select
                  className="flex-1 px-2 py-1.5 border rounded text-sm bg-white"
                  value={mapping.target_field_id}
                  onChange={(e) => updateMapping(i, { target_field_id: e.target.value })}
                >
                  <option value="">転記先</option>
                  {currentFields
                    .filter((f) => f.field_type !== "search" && f.field_type !== "calculation" && f.field_type !== "login_user")
                    .map((f) => (
                      <option key={f.id} value={f.id}>{f.label}</option>
                    ))}
                </select>
                <button onClick={() => removeMapping(i)} className="text-red-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            <Button variant="ghost" size="sm" onClick={addMapping}>
              <Plus className="w-3 h-3 mr-1" />
              マッピング追加
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
