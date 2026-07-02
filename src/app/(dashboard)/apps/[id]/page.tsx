"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import {
  PageBody,
  PageFrame,
  PageHeader,
  PageSection,
} from "@/components/layout/PageLayout";
import { RecordFormFields } from "@/components/records/RecordFormFields";
import { RecordDeleteModal } from "@/components/records/RecordDeleteModal";
import { AggregationView } from "@/components/records/AggregationView";
import { AppViewRenderer } from "@/components/records/AppViewRenderer";
import { FilterBar, filterHasConditions } from "@/components/filters/FilterBar";
import { matchesFilter } from "@/lib/filters/evaluate";
import { fetchAllRecordValues } from "@/lib/records/fetchAllRecordValues";
import { getProfileDisplayName } from "@/lib/auth/profileDisplayName";
import { todayDateString } from "@/lib/utils";
import type {
  App,
  AppAggregation,
  AppField,
  AppRecord,
  AppView,
  FilterConfig,
  SearchFieldConfig,
  DateFieldConfig,
} from "@/types";
import { EMPTY_FILTER, VIEW_TYPE_LABELS } from "@/types";
import { preserveDashboardScroll } from "@/lib/dom/preserveScroll";
import { Plus, FileSpreadsheet } from "lucide-react";

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
  const [views, setViews] = useState<AppView[]>([]);
  const [selectedAggId, setSelectedAggId] = useState("");
  const [selectedViewId, setSelectedViewId] = useState("");
  const [viewFilter, setViewFilter] = useState<FilterConfig>(EMPTY_FILTER);
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

  const selectedView = views.find((v) => v.id === selectedViewId) ?? null;

  useEffect(() => {
    loadApp();
    loadCurrentUser();
  }, [appId]);

  useEffect(() => {
    preserveDashboardScroll(() => {
      setPage(1);
      setViewFilter(selectedView?.config.filter ?? EMPTY_FILTER);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedViewId]);

  // フィルタ適用のため、全レコードの値を一括取得（ビュー共通）
  const recordIds = records.map((r) => r.id);
  useEffect(() => {
    if (recordIds.length === 0) {
      setValuesByRecord({});
      return;
    }
    let cancelled = false;
    fetchAllRecordValues(supabase, recordIds).then((map) => {
      if (!cancelled) setValuesByRecord(map);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordIds.join(",")]);

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

    const [fieldsRes, recordsRes, aggRes, viewsRes] = await Promise.all([
      supabase.from("app_fields").select("*").eq("app_id", appId).order("sort_order"),
      supabase.from("app_records").select("*").eq("app_id", appId).order("created_at", { ascending: false }),
      supabase.from("app_aggregations").select("*").eq("app_id", appId).order("sort_order"),
      supabase.from("app_views").select("*").eq("app_id", appId).order("sort_order"),
    ]);

    setFields(fieldsRes.data ?? []);
    setRecords(recordsRes.data ?? []);
    setAggregations((aggRes.data as AppAggregation[] | null) ?? []);
    setViews((viewsRes.data as AppView[] | null) ?? []);
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

  const selectedAgg = aggregations.find((a) => a.id === selectedAggId) ?? null;
  const allRecordIds = records.map((r) => r.id);

  const viewOptions = [
    ...(views.length > 0
      ? [{ label: "標準一覧（一覧表示設定）", value: "" }]
      : []),
    ...views.map((v) => ({
      label: `${v.name}（${VIEW_TYPE_LABELS[v.config.type]}）`,
      value: v.id,
    })),
  ];

  const filteredRecords = filterHasConditions(viewFilter)
    ? records.filter((r) => matchesFilter(viewFilter, fields, valuesByRecord[r.id] ?? {}))
    : records;

  const sectionTitle = selectedView
    ? `${selectedView.name} (${filteredRecords.length}件${filteredRecords.length !== records.length ? ` / 全${records.length}件` : ""})`
    : `レコード一覧 (${filteredRecords.length}件${filteredRecords.length !== records.length ? ` / 全${records.length}件` : ""})`;

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
                  onChange={(e) =>
                    preserveDashboardScroll(() => setSelectedAggId(e.target.value))
                  }
                  options={[
                    { label: "選択してください", value: "" },
                    ...aggregations.map((a) => ({ label: a.name, value: a.id })),
                  ]}
                />
              </div>
            }
            bordered={showForm}
          >
          <div className="min-h-[280px]">
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
          </div>
        </PageSection>
        )}

        <PageSection
          title={sectionTitle}
          bordered={showForm || aggregations.length > 0}
          action={
            views.length > 0 ? (
              <div className="w-full sm:w-56">
                <Select
                  value={selectedViewId}
                  onChange={(e) =>
                    preserveDashboardScroll(() => setSelectedViewId(e.target.value))
                  }
                  options={viewOptions}
                />
              </div>
            ) : undefined
          }
        >
          <div className="min-h-[320px] space-y-4">
            {fields.length > 0 && (
              <FilterBar
                fields={fields}
                value={viewFilter}
                onChange={(next) => {
                  setPage(1);
                  setViewFilter(next);
                }}
              />
            )}
            <AppViewRenderer
              appId={appId}
              app={app}
              fields={fields}
              records={filteredRecords}
              view={selectedView}
              valuesByRecord={valuesByRecord}
              page={page}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              onDelete={setDeleteRecordId}
              onRecordUpdated={loadApp}
            />
          </div>
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
