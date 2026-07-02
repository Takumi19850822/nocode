"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import {
  PageBody,
  PageFrame,
  PageHeader,
  PageSection,
} from "@/components/layout/PageLayout";
import { FieldCanvas } from "@/components/builder/FieldCanvas";
import { ListFieldSettings } from "@/components/builder/ListFieldSettings";
import { AggregationSettings } from "@/components/builder/AggregationSettings";
import { ViewSettings } from "@/components/builder/ViewSettings";
import {
  FieldSettingsPanel,
  createDraftField,
  applyTypeToField,
} from "@/components/builder/FieldSettingsPanel";
import { generateFieldName } from "@/lib/utils";
import { sanitizeListFieldIds } from "@/lib/records/getListDisplayFields";
import { snapFieldWidth } from "@/types";
import type { App, AppField, FieldType } from "@/types";
import { Save, Plus } from "lucide-react";

type PanelMode = "idle" | "add" | "edit";

export default function AppBuilderPage() {
  const params = useParams();
  const appId = params.id as string;

  const [app, setApp] = useState<App | null>(null);
  const [fields, setFields] = useState<AppField[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>("idle");
  const [draftField, setDraftField] = useState<AppField | null>(null);
  const [allApps, setAllApps] = useState<{ id: string; name: string }[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [listFieldIds, setListFieldIds] = useState<string[]>([]);

  const supabase = createClient();
  const selectedField = fields.find((f) => f.id === selectedId) ?? null;
  const panelField = panelMode === "add" ? draftField : selectedField;

  useEffect(() => {
    loadApp();
  }, [appId]);

  async function loadApp() {
    const { data: appData } = await supabase
      .from("apps")
      .select("*")
      .eq("id", appId)
      .single();

    if (!appData) return;
    setApp(appData);
    setTenantId(appData.tenant_id);
    setListFieldIds(appData.list_field_ids ?? []);

    const [fieldsRes, appsRes] = await Promise.all([
      supabase.from("app_fields").select("*").eq("app_id", appId).order("sort_order"),
      supabase.from("apps").select("id, name").eq("tenant_id", appData.tenant_id),
    ]);

    setFields(
      fieldsRes.data?.map((f) => ({
        ...f,
        width: snapFieldWidth(f.width),
        break_before: f.break_before ?? false,
      })) ?? []
    );
    setAllApps(appsRes.data ?? []);
  }

  function startAddField() {
    setDraftField(createDraftField(appId, fields.length));
    setPanelMode("add");
    setSelectedId(null);
  }

  function cancelAddField() {
    setDraftField(null);
    setPanelMode("idle");
  }

  function confirmAddField() {
    if (!draftField || !draftField.label.trim()) {
      alert("ラベルを入力してください");
      return;
    }

    const newField: AppField = {
      ...draftField,
      id: uuidv4(),
      name: draftField.name.trim() || generateFieldName(draftField.label),
      label: draftField.label.trim(),
      sort_order: fields.length,
    };

    setFields([...fields, newField]);
    setSelectedId(newField.id);
    setDraftField(null);
    setPanelMode("edit");
  }

  function selectField(id: string) {
    setSelectedId(id);
    setPanelMode("edit");
    setDraftField(null);
  }

  function updateField(updated: AppField) {
    if (panelMode === "add" && draftField) {
      setDraftField(updated);
    } else {
      setFields(fields.map((f) => (f.id === updated.id ? updated : f)));
    }
  }

  function changeDraftType(type: FieldType) {
    if (!draftField) return;
    setDraftField(applyTypeToField(draftField, type));
  }

  function deleteField(id: string) {
    setFields(fields.filter((f) => f.id !== id));
    setListFieldIds((prev) => prev.filter((fid) => fid !== id));
    setSelectedId(null);
    setPanelMode("idle");
  }

  const handleSave = useCallback(async () => {
    if (!app) return;

    for (const f of fields) {
      if (!f.label.trim()) {
        setSaveError("ラベルが未入力のフィールドがあります");
        return;
      }
    }

    setSaving(true);
    setSaveError("");

    const currentIds = fields.map((f) => f.id);
    const { data: existing } = await supabase
      .from("app_fields")
      .select("id")
      .eq("app_id", appId);

    const toDelete = (existing ?? [])
      .filter((row) => !currentIds.includes(row.id))
      .map((row) => row.id);

    if (toDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from("app_fields")
        .delete()
        .in("id", toDelete);
      if (deleteError) {
        setSaveError(`削除に失敗しました: ${deleteError.message}`);
        setSaving(false);
        return;
      }
    }

    if (fields.length > 0) {
      const toUpsert = fields.map((f, i) => ({
        id: f.id,
        app_id: appId,
        name: f.name.trim() || generateFieldName(f.label),
        label: f.label.trim(),
        field_type: f.field_type,
        is_required: f.is_required,
        sort_order: i,
        width: snapFieldWidth(f.width),
        break_before: f.break_before ?? false,
        placeholder: f.placeholder,
        default_value: f.default_value,
        options: f.options,
        config: f.config,
      }));

      const { error: upsertError } = await supabase
        .from("app_fields")
        .upsert(toUpsert, { onConflict: "id" });

      if (upsertError) {
        const hint =
          upsertError.message.includes("login_user") ||
          upsertError.message.includes("invalid input value for enum")
            ? "（005_login_user_field_type.sql のマイグレーション未実行の可能性があります）"
            : "";
        setSaveError(`保存に失敗しました: ${upsertError.message}${hint}`);
        setSaving(false);
        return;
      }
    } else if ((existing ?? []).length > 0) {
      const { error: deleteAllError } = await supabase
        .from("app_fields")
        .delete()
        .eq("app_id", appId);
      if (deleteAllError) {
        setSaveError(`保存に失敗しました: ${deleteAllError.message}`);
        setSaving(false);
        return;
      }
    }

    const sanitizedListIds = sanitizeListFieldIds(listFieldIds, fields);
    const { error: appUpdateError } = await supabase
      .from("apps")
      .update({ list_field_ids: sanitizedListIds })
      .eq("id", appId);

    if (appUpdateError) {
      const hint = appUpdateError.message.includes("list_field_ids")
        ? "（008_list_field_ids.sql のマイグレーション未実行の可能性があります）"
        : "";
      setSaveError(`一覧設定の保存に失敗しました: ${appUpdateError.message}${hint}`);
      setSaving(false);
      return;
    }

    await loadApp();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [app, fields, listFieldIds, appId, supabase]);

  if (!app) return <p className="text-gray-500">読み込み中...</p>;

  return (
    <PageFrame>
      <PageHeader
        title={`${app.name} — フォーム設計`}
        description="ドラッグで並び替え、右端をドラッグで幅調整（10%刻み）"
        backHref="/tenant/apps"
        actions={
          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto shrink-0">
            <Save className="w-4 h-4 mr-1" />
            {saving ? "保存中..." : saved ? "保存しました!" : "保存"}
          </Button>
        }
      />

      <PageBody className="space-y-4">
        {saveError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {saveError}
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8">
            <PageSection
              title="フォームプレビュー"
              action={
                <Button size="sm" onClick={startAddField} disabled={panelMode === "add"}>
                  <Plus className="w-4 h-4 mr-1" />
                  フィールド追加
                </Button>
              }
            >
              <FieldCanvas
                fields={fields}
                selectedId={selectedId}
                onSelect={selectField}
                onReorder={setFields}
                onWidthChange={(id, width) => {
                  setFields(fields.map((f) => (f.id === id ? { ...f, width } : f)));
                }}
                onDelete={deleteField}
              />
            </PageSection>
          </div>

          <div className="lg:col-span-4 space-y-8">
            <PageSection title="設定">
              <FieldSettingsPanel
                mode={panelMode}
                field={panelField}
                allFields={fields}
                allApps={allApps}
                tenantId={tenantId}
                onFieldChange={updateField}
                onTypeChange={changeDraftType}
                onConfirmAdd={confirmAddField}
                onCancelAdd={cancelAddField}
                onDelete={
                  selectedField ? () => deleteField(selectedField.id) : undefined
                }
              />
            </PageSection>

            <PageSection title="一覧表示" bordered>
              <ListFieldSettings
                fields={fields}
                listFieldIds={listFieldIds}
                onChange={setListFieldIds}
              />
            </PageSection>

            <PageSection title="ビュー（一覧 / カレンダー / カンバン）" bordered>
              <ViewSettings appId={appId} fields={fields} listFieldIds={listFieldIds} />
            </PageSection>

            <PageSection title="集計 / グラフ" bordered>
              <AggregationSettings appId={appId} fields={fields} />
            </PageSection>
          </div>
        </div>
      </PageBody>
    </PageFrame>
  );
}
