"use client";

import { useRef, useCallback, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { FIELD_TYPE_LABELS, fieldGridColumn, GRID_COLUMNS, FIELD_WIDTH_STEP, snapFieldWidth } from "@/types";
import type { AppField } from "@/types";
import { Badge } from "@/components/ui/Card";

interface FieldCanvasProps {
  fields: AppField[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReorder: (fields: AppField[]) => void;
  onWidthChange: (id: string, width: number) => void;
  onDelete: (id: string) => void;
}

export function FieldCanvas({
  fields,
  selectedId,
  onSelect,
  onReorder,
  onWidthChange,
  onDelete,
}: FieldCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);
    const reordered = arrayMove(fields, oldIndex, newIndex).map((f, i) => ({
      ...f,
      sort_order: i,
    }));
    onReorder(reordered);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={fields.map((f) => f.id)} strategy={rectSortingStrategy}>
        <div
          ref={containerRef}
          className="grid grid-cols-10 gap-3 min-h-[200px] p-4 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 auto-rows-min"
        >
          {fields.length === 0 && (
            <p className="col-span-10 text-center text-gray-400 py-8">
              左のパレットからフィールドを追加してください
            </p>
          )}
          {fields.map((field) => (
            <SortableField
              key={field.id}
              field={field}
              selected={selectedId === field.id}
              containerRef={containerRef}
              onSelect={() => onSelect(field.id)}
              onWidthChange={(w) => onWidthChange(field.id, w)}
              onDelete={() => onDelete(field.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableField({
  field,
  selected,
  containerRef,
  onSelect,
  onWidthChange,
  onDelete,
}: {
  field: AppField;
  selected: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onSelect: () => void;
  onWidthChange: (width: number) => void;
  onDelete: () => void;
}) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const [resizing, setResizing] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: resizing ? undefined : transition,
    gridColumn: fieldGridColumn(field.width, field.break_before),
  };

  const mergeRef = useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node);
      fieldRef.current = node;
    },
    [setNodeRef]
  );

  const handleResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setResizing(true);

      const container = containerRef.current;
      const fieldEl = fieldRef.current;
      if (!container || !fieldEl) return;

      const containerRect = container.getBoundingClientRect();
      const fieldRect = fieldEl.getBoundingClientRect();
      const colWidth = containerRect.width / GRID_COLUMNS;

      function onMove(ev: PointerEvent) {
        const relativeX = ev.clientX - fieldRect.left;
        const spanCount = Math.max(1, Math.min(GRID_COLUMNS, Math.round(relativeX / colWidth)));
        onWidthChange(snapFieldWidth(spanCount * FIELD_WIDTH_STEP));
      }

      function onUp() {
        setResizing(false);
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      }

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [containerRef, onWidthChange]
  );

  return (
    <div
      ref={mergeRef}
      style={style}
      className={cn(
        "relative bg-white border rounded-lg p-3 cursor-pointer transition-shadow min-w-0",
        selected ? "border-blue-500 shadow-md ring-2 ring-blue-200" : "border-gray-200 hover:border-gray-300",
        isDragging && "opacity-50 shadow-lg z-20",
        resizing && "ring-2 ring-blue-300 select-none"
      )}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 touch-none"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <span className="text-xs font-medium text-gray-500 truncate">
          {FIELD_TYPE_LABELS[field.field_type]}
        </span>
        {field.is_required && <Badge variant="danger">必須</Badge>}
        <span className="ml-auto text-xs text-gray-400 shrink-0">{field.width}%</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-gray-400 hover:text-red-600 p-0.5 shrink-0"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      <label className="block text-sm font-medium text-gray-700 mb-1 truncate">
        {field.label}
        {field.is_required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <FieldPreview field={field} />

      {/* 幅リサイズハンドル（右端ドラッグ） */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="幅を調整"
        onPointerDown={handleResizeStart}
        className={cn(
          "absolute top-0 right-0 w-2 h-full cursor-col-resize rounded-r-lg",
          "hover:bg-blue-400/30 active:bg-blue-500/40 touch-none",
          "flex items-center justify-center group"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-0.5 h-8 bg-gray-300 rounded group-hover:bg-blue-500 group-active:bg-blue-600" />
      </div>
    </div>
  );
}

function FieldPreview({ field }: { field: AppField }) {
  const baseClass =
    "w-full px-3 py-2 border border-gray-200 rounded text-sm bg-gray-50 text-gray-400";

  switch (field.field_type) {
    case "textarea":
      return <div className={cn(baseClass, "h-16")} />;
    case "select":
      return <div className={cn(baseClass, "flex justify-between")}>選択してください ▼</div>;
    case "radio":
      return (
        <div className="space-y-1">
          {(field.options.length > 0 ? field.options : [{ label: "選択肢1", value: "1" }]).map(
            (o) => (
              <label key={o.value} className="flex items-center gap-2 text-sm text-gray-500">
                <input type="radio" disabled readOnly /> {o.label}
              </label>
            )
          )}
        </div>
      );
    case "checkbox":
      return (
        <div className="space-y-1">
          {(field.options.length > 0 ? field.options : [{ label: "選択肢1", value: "1" }]).map(
            (o) => (
              <label key={o.value} className="flex items-center gap-2 text-sm text-gray-500">
                <input type="checkbox" disabled readOnly /> {o.label}
              </label>
            )
          )}
        </div>
      );
    case "search":
      return (
        <div className={cn(baseClass, "flex items-center gap-2")}>
          <Settings className="w-4 h-4 shrink-0" />
          <span className="truncate">検索フィールド</span>
        </div>
      );
    case "calculation":
      return <div className={cn(baseClass, "font-mono")}>= 計算式</div>;
    case "login_user":
      return <div className={cn(baseClass, "bg-gray-100")}>ログインユーザ氏名</div>;
    default:
      return <div className={baseClass}>{field.placeholder || "入力..."}</div>;
  }
}
