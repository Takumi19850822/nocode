"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { fetchAllRecordValues } from "@/lib/records/fetchAllRecordValues";
import { formatFieldDisplayValue } from "@/lib/records/formatFieldValue";
import { getKanbanColumnOrder } from "@/lib/views/helpers";
import { createClient } from "@/lib/supabase/client";
import type { AppField, AppRecord, KanbanViewConfig } from "@/types";

interface KanbanViewProps {
  appId: string;
  config: KanbanViewConfig;
  fields: AppField[];
  records: AppRecord[];
  onRecordUpdated?: () => void;
}

export function KanbanView({
  appId,
  config,
  fields,
  records,
  onRecordUpdated,
}: KanbanViewProps) {
  const [valuesByRecord, setValuesByRecord] = useState<
    Record<string, Record<string, string>>
  >({});
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const statusField = fields.find((f) => f.id === config.status_field_id);
  const titleField = fields.find((f) => f.id === config.title_field_id);
  const cardFields = useMemo(() => {
    const map = new Map(fields.map((f) => [f.id, f]));
    return config.card_field_ids
      .map((id) => map.get(id))
      .filter((f): f is AppField => f != null);
  }, [config.card_field_ids, fields]);

  const columnValues = useMemo(() => {
    if (!statusField) return [];
    return getKanbanColumnOrder(statusField, config.option_order);
  }, [statusField, config.option_order]);

  const columnLabels = useMemo(() => {
    if (!statusField) return new Map<string, string>();
    return new Map(statusField.options.map((o) => [o.value, o.label]));
  }, [statusField]);

  const recordIds = records.map((r) => r.id);

  useEffect(() => {
    if (recordIds.length === 0) {
      setValuesByRecord({});
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const supabase = createClient();
    fetchAllRecordValues(supabase, recordIds).then((map) => {
      if (!cancelled) {
        setValuesByRecord(map);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [recordIds.join(",")]);

  const recordsByColumn = useMemo(() => {
    const map = new Map<string, AppRecord[]>();
    const unassigned: AppRecord[] = [];
    columnValues.forEach((v) => map.set(v, []));

    if (!statusField) return { map, unassigned };

    for (const record of records) {
      const status = valuesByRecord[record.id]?.[statusField.id] ?? "";
      if (status && map.has(status)) {
        map.get(status)!.push(record);
      } else {
        unassigned.push(record);
      }
    }
    return { map, unassigned };
  }, [records, valuesByRecord, statusField, columnValues]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const updateStatus = useCallback(
    async (recordId: string, newStatus: string) => {
      if (!statusField || updating) return;
      setUpdating(true);

      setValuesByRecord((prev) => ({
        ...prev,
        [recordId]: { ...prev[recordId], [statusField.id]: newStatus },
      }));

      try {
        const res = await fetch(`/api/apps/${appId}/records/${recordId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            values: [{ field_id: statusField.id, value: newStatus }],
          }),
        });
        if (!res.ok) throw new Error("更新に失敗しました");
        onRecordUpdated?.();
      } catch {
        const supabase = createClient();
        const map = await fetchAllRecordValues(supabase, [recordId]);
        setValuesByRecord((prev) => ({ ...prev, ...map }));
      } finally {
        setUpdating(false);
      }
    },
    [appId, statusField, updating, onRecordUpdated]
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || !statusField) return;

    const recordId = String(active.id);
    const overId = String(over.id);

    if (overId.startsWith("column:")) {
      const newStatus = overId.slice("column:".length);
      const current = valuesByRecord[recordId]?.[statusField.id] ?? "";
      if (newStatus !== current) {
        updateStatus(recordId, newStatus);
      }
    }
  }

  if (!statusField || !titleField) {
    return (
      <p className="text-sm text-red-600 text-center py-6">
        カンバン設定が不正です。ステータス・タイトルフィールドを確認してください。
      </p>
    );
  }

  if (
    statusField.field_type !== "select" &&
    statusField.field_type !== "radio"
  ) {
    return (
      <p className="text-sm text-red-600 text-center py-6">
        ステータスにはプルダウンまたはラジオボタンフィールドを指定してください。
      </p>
    );
  }

  const activeRecord = activeId ? records.find((r) => r.id === activeId) : null;

  if (loading) {
    return <p className="text-sm text-gray-400 text-center py-12">読み込み中...</p>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-2 min-h-[420px]">
        {columnValues.map((colValue) => (
          <KanbanColumn
            key={colValue}
            columnId={`column:${colValue}`}
            label={columnLabels.get(colValue) ?? colValue}
            records={recordsByColumn.map.get(colValue) ?? []}
            appId={appId}
            titleField={titleField}
            cardFields={cardFields}
            valuesByRecord={valuesByRecord}
          />
        ))}
        {recordsByColumn.unassigned.length > 0 && (
          <KanbanColumn
            columnId="column:"
            label="未設定"
            records={recordsByColumn.unassigned}
            appId={appId}
            titleField={titleField}
            cardFields={cardFields}
            valuesByRecord={valuesByRecord}
            droppable={false}
          />
        )}
      </div>

      <DragOverlay>
        {activeRecord ? (
          <KanbanCard
            record={activeRecord}
            appId={appId}
            titleField={titleField}
            cardFields={cardFields}
            values={valuesByRecord[activeRecord.id] ?? {}}
            isDragging
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({
  columnId,
  label,
  records,
  appId,
  titleField,
  cardFields,
  valuesByRecord,
  droppable = true,
}: {
  columnId: string;
  label: string;
  records: AppRecord[];
  appId: string;
  titleField: AppField;
  cardFields: AppField[];
  valuesByRecord: Record<string, Record<string, string>>;
  droppable?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: columnId,
    disabled: !droppable,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-64 rounded-lg border ${
        isOver ? "border-blue-400 bg-blue-50/50" : "border-gray-200 bg-gray-50"
      }`}
    >
      <div className="px-3 py-2 border-b border-gray-200 bg-white rounded-t-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-800 truncate">{label}</span>
          <span className="text-xs text-gray-400 shrink-0 ml-2">{records.length}</span>
        </div>
      </div>
      <div className="p-2 space-y-2 min-h-[360px]">
        {records.map((record) => (
          <DraggableKanbanCard
            key={record.id}
            record={record}
            appId={appId}
            titleField={titleField}
            cardFields={cardFields}
            values={valuesByRecord[record.id] ?? {}}
          />
        ))}
      </div>
    </div>
  );
}

function DraggableKanbanCard(props: {
  record: AppRecord;
  appId: string;
  titleField: AppField;
  cardFields: AppField[];
  values: Record<string, string>;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: props.record.id,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <KanbanCard {...props} isDragging={isDragging} />
    </div>
  );
}

function KanbanCard({
  record,
  appId,
  titleField,
  cardFields,
  values,
  isDragging,
}: {
  record: AppRecord;
  appId: string;
  titleField: AppField;
  cardFields: AppField[];
  values: Record<string, string>;
  isDragging?: boolean;
}) {
  const href = `/apps/${appId}/records/${record.id}`;
  const title = formatFieldDisplayValue(titleField, values[titleField.id]);

  return (
    <div
      className={`rounded-lg border bg-white p-3 shadow-sm cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-60 border-blue-300 shadow-md" : "border-gray-200 hover:border-blue-200"
      }`}
    >
      <Link
        href={href}
        className="text-sm font-medium text-gray-900 hover:text-blue-600 block truncate"
        onClick={(e) => e.stopPropagation()}
      >
        {title}
      </Link>
      {cardFields.map((f) => (
        <div key={f.id} className="mt-1.5 text-xs text-gray-500">
          <span className="text-gray-400">{f.label}: </span>
          {formatFieldDisplayValue(f, values[f.id])}
        </div>
      ))}
    </div>
  );
}
