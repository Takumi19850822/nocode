"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import {
  PageBody,
  PageFrame,
  PageHeader,
  PageSection,
} from "@/components/layout/PageLayout";
import { RecordDetailView } from "@/components/records/RecordDetailView";
import { RecordFormFields } from "@/components/records/RecordFormFields";
import { RecordDeleteModal } from "@/components/records/RecordDeleteModal";
import type {
  App,
  AppField,
  AppRecord,
  SearchFieldConfig,
} from "@/types";
import { getProfileDisplayName } from "@/lib/auth/profileDisplayName";
import { Pencil, Trash2 } from "lucide-react";

export default function RecordDetailPage() {
  const params = useParams();
  const router = useRouter();
  const appId = params.id as string;
  const recordId = params.recordId as string;

  const [app, setApp] = useState<App | null>(null);
  const [record, setRecord] = useState<AppRecord | null>(null);
  const [fields, setFields] = useState<AppField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [searchRefs, setSearchRefs] = useState<Record<string, string | null>>({});
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState<Record<string, string>>({});
  const [searchResults, setSearchResults] = useState<Record<string, unknown[]>>({});
  const [currentUserName, setCurrentUserName] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const supabase = createClient();

  const loadRecord = useCallback(async () => {
    const { data: appData } = await supabase.from("apps").select("*").eq("id", appId).single();
    if (!appData) return;
    setApp(appData);

    const [{ data: recordData }, { data: fieldsData }, { data: valuesData }] = await Promise.all([
      supabase.from("app_records").select("*").eq("id", recordId).eq("app_id", appId).single(),
      supabase.from("app_fields").select("*").eq("app_id", appId).order("sort_order"),
      supabase.from("app_record_values").select("*").eq("record_id", recordId),
    ]);

    if (!recordData) return;
    setRecord(recordData);
    setFields(fieldsData ?? []);

    const valueMap: Record<string, string> = {};
    const refMap: Record<string, string | null> = {};
    valuesData?.forEach((v) => {
      valueMap[v.field_id] = v.value;
      if (v.referenced_record_id) refMap[v.field_id] = v.referenced_record_id;
    });

    const loginUserFields = (fieldsData ?? []).filter((f) => f.field_type === "login_user");
    if (loginUserFields.length > 0 && recordData.created_by) {
      const { data: creator } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", recordData.created_by)
        .single();
      const creatorName = getProfileDisplayName(creator);
      if (creatorName) {
        loginUserFields.forEach((f) => {
          valueMap[f.id] = creatorName;
        });
      }
    }

    setValues(valueMap);
    setFormValues(valueMap);
    setSearchRefs(refMap);
  }, [appId, recordId, supabase]);

  useEffect(() => {
    loadRecord();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();
      setCurrentUserName(getProfileDisplayName(profile));
    });
  }, [loadRecord, supabase]);

  function startEdit() {
    setFormValues({ ...values });
    setSaveError("");
    setEditing(true);
  }

  function cancelEdit() {
    setFormValues({ ...values });
    setEditing(false);
    setSaveError("");
  }

  async function handleSearch(field: AppField) {
    const cfg = field.config as SearchFieldConfig;
    if (!cfg.source_app_id || !cfg.source_field_id) return;

    const query = searchQuery[field.id] ?? "";
    if (!query.trim()) return;

    const { data: sourceRecords } = await supabase
      .from("app_records")
      .select("id")
      .eq("app_id", cfg.source_app_id);

    if (!sourceRecords?.length) {
      setSearchResults((prev) => ({ ...prev, [field.id]: [] }));
      return;
    }

    const recordIds = sourceRecords.map((r) => r.id);
    const { data: matched } = await supabase
      .from("app_record_values")
      .select("*")
      .in("record_id", recordIds)
      .eq("field_id", cfg.source_field_id)
      .ilike("value", `%${query}%`);

    const matchedRecordIds = matched?.map((v) => v.record_id) ?? [];
    if (!matchedRecordIds.length) {
      setSearchResults((prev) => ({ ...prev, [field.id]: [] }));
      return;
    }

    const { data: allValues } = await supabase
      .from("app_record_values")
      .select("*")
      .in("record_id", matchedRecordIds);

    const { data: sourceFields } = await supabase
      .from("app_fields")
      .select("*")
      .eq("app_id", cfg.source_app_id);

    const results = matchedRecordIds.map((rid) => {
      const recordValues = allValues?.filter((v) => v.record_id === rid) ?? [];
      const obj: Record<string, string> = {};
      recordValues.forEach((v) => {
        const sf = sourceFields?.find((f) => f.id === v.field_id);
        if (sf) obj[sf.id] = v.value;
      });
      return { record_id: rid, values: obj };
    });

    setSearchResults((prev) => ({ ...prev, [field.id]: results }));
  }

  function applySearchResult(
    field: AppField,
    result: { record_id: string; values: Record<string, string> }
  ) {
    const cfg = field.config as SearchFieldConfig;
    const displayValue = result.values[cfg.display_field_id] ?? "";
    setSearchRefs((prev) => ({ ...prev, [field.id]: result.record_id }));

    const next = { ...formValues, [field.id]: displayValue };
    cfg.mappings.forEach((mapping) => {
      const sourceVal = result.values[mapping.source_field_id];
      if (sourceVal !== undefined) next[mapping.target_field_id] = sourceVal;
    });
    setFormValues(next);
    setSearchResults((prev) => ({ ...prev, [field.id]: [] }));
  }

  async function handleSave() {
    setSaving(true);
    setSaveError("");

    let creatorName = "";
    if (record?.created_by) {
      const { data: creator } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", record.created_by)
        .single();
      creatorName = getProfileDisplayName(creator);
    }

    const payload = fields.map((f) => ({
      field_id: f.id,
      value: f.field_type === "login_user" ? creatorName : (formValues[f.id] ?? ""),
      referenced_record_id:
        f.field_type === "search" ? (searchRefs[f.id] ?? null) : null,
    }));

    try {
      const res = await fetch(`/api/apps/${appId}/records/${recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: payload }),
      });
      const body = await res.json();
      if (!res.ok) {
        setSaveError(body.error ?? "保存に失敗しました");
        return;
      }
      setEditing(false);
      await loadRecord();
    } catch {
      setSaveError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  if (!app || !record) {
    return <p className="text-gray-500">読み込み中...</p>;
  }

  return (
    <PageFrame>
      <PageHeader
        title={app.name}
        description="レコード詳細"
        backHref={`/apps/${appId}`}
        actions={
          !editing ? (
            <>
              <Button variant="secondary" onClick={startEdit}>
                <Pencil className="w-4 h-4 mr-1" />
                編集
              </Button>
              <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="w-4 h-4 mr-1" />
                削除
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={cancelEdit} disabled={saving}>
                キャンセル
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "保存中..." : "保存"}
              </Button>
            </>
          )
        }
      />

      <PageBody className="space-y-5">
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500 pb-4 border-b border-gray-100">
          <div className="flex gap-1.5">
            <dt className="font-medium text-gray-400">作成日</dt>
            <dd>{new Date(record.created_at).toLocaleString("ja-JP")}</dd>
          </div>
          {record.updated_at && record.updated_at !== record.created_at && (
            <div className="flex gap-1.5">
              <dt className="font-medium text-gray-400">更新日</dt>
              <dd>{new Date(record.updated_at).toLocaleString("ja-JP")}</dd>
            </div>
          )}
        </dl>

        {editing ? (
          <PageSection title="レコード編集">
            <RecordFormFields
              fields={fields}
              formValues={formValues}
              onValuesChange={setFormValues}
              currentUserName={currentUserName}
              searchQuery={searchQuery}
              onSearchQueryChange={(fieldId, q) =>
                setSearchQuery((prev) => ({ ...prev, [fieldId]: q }))
              }
              searchResults={searchResults}
              onSearch={handleSearch}
              onApplySearchResult={applySearchResult}
            />
            {saveError && <p className="text-sm text-red-600 mt-4">{saveError}</p>}
          </PageSection>
        ) : (
          <RecordDetailView fields={fields} values={values} />
        )}
      </PageBody>

      <RecordDeleteModal
        appId={appId}
        recordId={recordId}
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => router.push(`/apps/${appId}`)}
      />
    </PageFrame>
  );
}
