"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import {
  PageBody,
  PageFrame,
  PageHeader,
  PageSection,
} from "@/components/layout/PageLayout";
import { RecordFormFields } from "@/components/records/RecordFormFields";
import { RecordDeleteModal } from "@/components/records/RecordDeleteModal";
import { AggregationView } from "@/components/records/AggregationView";
import { formatFieldDisplayValue } from "@/lib/records/formatFieldValue";
import { getListDisplayFields } from "@/lib/records/getListDisplayFields";
import { getProfileDisplayName } from "@/lib/auth/profileDisplayName";
import { todayDateString } from "@/lib/utils";
import type {
  App,
  AppAggregation,
  AppField,
  AppRecord,
  SearchFieldConfig,
  DateFieldConfig,
} from "@/types";
import { Plus, Trash2, Eye, FileSpreadsheet } from "lucide-react";

export default function AppRuntimePage() {
  const params = useParams();
  const appId = params.id as string;

  const [app, setApp] = useState<App | null>(null);
  const [fields, setFields] = useState<AppField[]>([]);
  const [records, setRecords] = useState<AppRecord[]>([]);
  const [valuesByRecord, setValuesByRecord] = useState<
    Record<string, Record<string, string>>
  >({});
  const [aggregations, setAggregations] = useState<AppAggregation[]>([]);
  const [selectedAggId, setSelectedAggId] = useState("");
  const [page, setPage] = useState(1);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);
  const [searchResults, setSearchResults] = useState<Record<string, unknown[]>>({});
  const [searchQuery, setSearchQuery] = useState<Record<string, string>>({});
  const [searchRefs, setSearchRefs] = useState<Record<string, string>>({});
  const [currentUserName, setCurrentUserName] = useState("");
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState("");

  const supabase = createClient();
  const PAGE_SIZE = 20;

  useEffect(() => {
    loadApp();
    loadCurrentUser();
  }, [appId]);

  // 表示中ページのレコード値をまとめて1クエリで取得（N+1回避）
  useEffect(() => {
    const pageRecordIds = records
      .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
      .map((r) => r.id);
    if (pageRecordIds.length === 0) {
      setValuesByRecord({});
      return;
    }
    let cancelled = false;
    supabase
      .from("app_record_values")
      .select("record_id, field_id, value")
      .in("record_id", pageRecordIds)
      .then(({ data }) => {
        if (cancelled) return;
        const map: Record<string, Record<string, string>> = {};
        data?.forEach((v) => {
          (map[v.record_id] ??= {})[v.field_id] = v.value;
        });
        setValuesByRecord(map);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, page]);

  async function loadCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();
    setCurrentUserName(getProfileDisplayName(profile));
  }

  async function loadApp() {
    const { data: appData } = await supabase.from("apps").select("*").eq("id", appId).single();
    if (!appData) return;
    setApp(appData);

    const [fieldsRes, recordsRes, aggRes] = await Promise.all([
      supabase.from("app_fields").select("*").eq("app_id", appId).order("sort_order"),
      supabase.from("app_records").select("*").eq("app_id", appId).order("created_at", { ascending: false }),
      supabase.from("app_aggregations").select("*").eq("app_id", appId).order("sort_order"),
    ]);

    setFields(fieldsRes.data ?? []);
    setRecords(recordsRes.data ?? []);
    setAggregations((aggRes.data as AppAggregation[] | null) ?? []);
    setPage(1);
  }

  function initFormValues(userName: string): Record<string, string> {
    const initial: Record<string, string> = {};
    fields.forEach((f) => {
      if (f.field_type === "login_user") {
        initial[f.id] = userName;
      } else if (f.field_type === "date") {
        const cfg = f.config as DateFieldConfig;
        if (cfg.default_to_today) initial[f.id] = todayDateString();
      }
    });
    return initial;
  }

  async function openNewRecordForm() {
    const { data: { user } } = await supabase.auth.getUser();
    let userName = currentUserName;
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();
      userName = getProfileDisplayName(profile);
      setCurrentUserName(userName);
    }
    setFormValues(initFormValues(userName));
    setSearchRefs({});
    setShowForm(true);
    setSubmitError("");
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
    const { data: values } = await supabase
      .from("app_record_values")
      .select("*")
      .in("record_id", recordIds)
      .eq("field_id", cfg.source_field_id)
      .ilike("value", `%${query}%`);

    const matchedRecordIds = values?.map((v) => v.record_id) ?? [];
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!app) return;
    setSubmitError("");

    const { data: { user } } = await supabase.auth.getUser();

    let loginUserName = currentUserName;
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();
      loginUserName = getProfileDisplayName(profile);
    }

    const { data: record, error: recordError } = await supabase
      .from("app_records")
      .insert({
        app_id: appId,
        tenant_id: app.tenant_id,
        created_by: user?.id ?? null,
      })
      .select()
      .single();

    if (recordError || !record) {
      setSubmitError(recordError?.message ?? "レコードの作成に失敗しました");
      return;
    }

    const values = fields.map((f) => ({
      record_id: record.id,
      field_id: f.id,
      value: f.field_type === "login_user" ? loginUserName : (formValues[f.id] ?? ""),
      referenced_record_id: f.field_type === "search" ? (searchRefs[f.id] ?? null) : null,
    }));

    const { error: valuesError } = await supabase.from("app_record_values").insert(values);

    if (valuesError) {
      await supabase.from("app_records").delete().eq("id", record.id);
      const hint = valuesError.message.includes("referenced_record_id")
        ? "（007_record_references.sql のマイグレーション未実行の可能性があります）"
        : "";
      setSubmitError(`保存に失敗しました: ${valuesError.message}${hint}`);
      return;
    }

    setFormValues({});
    setSearchRefs({});
    setShowForm(false);
    loadApp();
  }

  if (!app) return <p className="text-gray-500">読み込み中...</p>;

  const listFields = getListDisplayFields(fields, app.list_field_ids);
  const pagedRecords = records.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectedAgg = aggregations.find((a) => a.id === selectedAggId) ?? null;
  const allRecordIds = records.map((r) => r.id);

  return (
    <PageFrame>
      <PageHeader
        title={app.name}
        description={app.description || undefined}
        actions={
          <>
            <Link href={`/apps/${appId}/export`}>
              <Button variant="excel" className="w-full sm:w-auto">
                <FileSpreadsheet className="w-4 h-4 mr-1" />
                Excel出力
              </Button>
            </Link>
            <Button onClick={openNewRecordForm} className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-1" />
              新規レコード
            </Button>
          </>
        }
      />

      <PageBody>
        {showForm && (
          <PageSection title="新規レコード">
            <form onSubmit={handleSubmit}>
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
              <div className="flex gap-2 mt-4">
                <Button type="submit">保存</Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowForm(false);
                    setSubmitError("");
                  }}
                >
                  キャンセル
                </Button>
              </div>
              {submitError && <p className="text-sm text-red-600 mt-3">{submitError}</p>}
            </form>
          </PageSection>
        )}

        {aggregations.length > 0 && (
          <PageSection
            title="グラフ / 集計"
            action={
              <div className="w-full sm:w-48">
                <Select
                  value={selectedAggId}
                  onChange={(e) => setSelectedAggId(e.target.value)}
                  options={[
                    { label: "選択してください", value: "" },
                    ...aggregations.map((a) => ({ label: a.name, value: a.id })),
                  ]}
                />
              </div>
            }
            bordered={showForm}
          >
            {selectedAgg ? (
              <AggregationView
                aggregation={selectedAgg}
                fields={fields}
                recordIds={allRecordIds}
              />
            ) : (
              <p className="text-sm text-gray-400 text-center py-6">
                上のプルダウンからグラフを選択してください
              </p>
            )}
          </PageSection>
        )}

        <PageSection
          title={`レコード一覧 (${records.length}件)`}
          bordered={showForm || aggregations.length > 0}
        >
          {records.length === 0 ? (
            <p className="text-gray-400 text-center py-8">レコードがありません</p>
          ) : (
            <div>
              <div className="scroll-table-wrap">
                <table className="scroll-table text-sm">
                  <thead>
                    <tr>
                      {listFields.map((f) => (
                        <th key={f.id}>{f.label}</th>
                      ))}
                      <th>作成日</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRecords.map((record) => (
                      <RecordRow
                        key={record.id}
                        appId={appId}
                        record={record}
                        fields={listFields}
                        values={valuesByRecord[record.id] ?? {}}
                        onDelete={() => setDeleteRecordId(record.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={records.length}
                onPageChange={setPage}
              />
            </div>
          )}
        </PageSection>
      </PageBody>

      <RecordDeleteModal
        appId={appId}
        recordId={deleteRecordId}
        open={deleteRecordId !== null}
        onClose={() => setDeleteRecordId(null)}
        onDeleted={loadApp}
      />
    </PageFrame>
  );
}

function RecordRow({
  appId,
  record,
  fields,
  values,
  onDelete,
}: {
  appId: string;
  record: AppRecord;
  fields: AppField[];
  values: Record<string, string>;
  onDelete: () => void;
}) {
  const detailHref = `/apps/${appId}/records/${record.id}`;

  return (
    <tr>
      {fields.map((f) => (
        <td key={f.id}>
          <Link href={detailHref}>
            {formatFieldDisplayValue(f, values[f.id])}
          </Link>
        </td>
      ))}
      <td className="text-gray-500">
        <Link href={detailHref}>
          {new Date(record.created_at).toLocaleDateString("ja-JP")}
        </Link>
      </td>
      <td>
        <div className="flex items-center gap-0.5">
          <Link
            href={detailHref}
            className="inline-flex items-center justify-center w-7 h-7 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            title="詳細"
          >
            <Eye className="w-4 h-4" />
          </Link>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center justify-center w-7 h-7 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="削除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
