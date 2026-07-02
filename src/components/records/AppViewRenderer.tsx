"use client";

import type { App, AppField, AppRecord, AppView } from "@/types";
import { CalendarView } from "./CalendarView";
import { KanbanView } from "./KanbanView";
import { RecordListView } from "./RecordListView";
import {
  defaultTableViewConfig,
  getFallbackListFields,
  getViewDisplayFields,
} from "@/lib/views/helpers";

interface AppViewRendererProps {
  appId: string;
  app: App;
  fields: AppField[];
  records: AppRecord[];
  view: AppView | null;
  valuesByRecord: Record<string, Record<string, string>>;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onDelete: (recordId: string) => void;
  onRecordUpdated?: () => void;
  /** false の場合、カンバンD&D・削除・行リンクを無効化（設定プレビュー用） */
  interactive?: boolean;
}

export function AppViewRenderer({
  appId,
  app,
  fields,
  records,
  view,
  valuesByRecord,
  page,
  pageSize,
  onPageChange,
  onDelete,
  onRecordUpdated,
  interactive = true,
}: AppViewRendererProps) {
  const config = view?.config ?? defaultTableViewConfig(app.list_field_ids);

  if (config.type === "calendar") {
    return (
      <CalendarView
        appId={appId}
        config={config}
        fields={fields}
        records={records}
      />
    );
  }

  if (config.type === "kanban") {
    return (
      <KanbanView
        appId={appId}
        config={config}
        fields={fields}
        records={records}
        onRecordUpdated={onRecordUpdated}
        interactive={interactive}
      />
    );
  }

  const listFields =
    view != null
      ? getViewDisplayFields(fields, config)
      : getFallbackListFields(fields, app.list_field_ids);

  return (
    <RecordListView
      appId={appId}
      records={records}
      fields={listFields}
      valuesByRecord={valuesByRecord}
      page={page}
      pageSize={pageSize}
      onPageChange={onPageChange}
      onDelete={onDelete}
      readOnly={!interactive}
    />
  );
}
