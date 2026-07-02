"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { fetchAllRecordValues } from "@/lib/records/fetchAllRecordValues";
import { formatFieldDisplayValue } from "@/lib/records/formatFieldValue";
import {
  addDays,
  endOfMonth,
  isSameDay,
  parseRecordDate,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toDateKey,
} from "@/lib/views/helpers";
import { createClient } from "@/lib/supabase/client";
import type { AppField, AppRecord, CalendarMode, CalendarViewConfig } from "@/types";

interface CalendarViewProps {
  appId: string;
  config: CalendarViewConfig;
  fields: AppField[];
  records: AppRecord[];
}

const MODE_LABELS: Record<CalendarMode, string> = {
  day: "日",
  week: "週",
  month: "月",
};

const WEEKDAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

export function CalendarView({ appId, config, fields, records }: CalendarViewProps) {
  const [mode, setMode] = useState<CalendarMode>(config.default_mode);
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [valuesByRecord, setValuesByRecord] = useState<
    Record<string, Record<string, string>>
  >({});
  const [loading, setLoading] = useState(true);

  const dateField = fields.find((f) => f.id === config.date_field_id);
  const titleField = config.title_field_id
    ? fields.find((f) => f.id === config.title_field_id)
    : null;
  const extraFields = useMemo(() => {
    const ids = config.field_ids ?? [];
    if (ids.length === 0) return [];
    const map = new Map(fields.map((f) => [f.id, f]));
    return ids.map((id) => map.get(id)).filter((f): f is AppField => f != null);
  }, [config.field_ids, fields]);

  const recordIds = records.map((r) => r.id);

  useEffect(() => {
    setMode(config.default_mode);
  }, [config.default_mode, config.date_field_id]);

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

  const eventsByDate = useMemo(() => {
    const map = new Map<string, AppRecord[]>();
    if (!dateField) return map;

    for (const record of records) {
      const raw = valuesByRecord[record.id]?.[dateField.id];
      const d = parseRecordDate(raw);
      if (!d) continue;
      const key = toDateKey(d);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(record);
    }
    return map;
  }, [records, valuesByRecord, dateField]);

  if (!dateField) {
    return (
      <p className="text-sm text-red-600 text-center py-6">
        日付フィールドが見つかりません。ビュー設定を確認してください。
      </p>
    );
  }

  function goToday() {
    setCursor(startOfDay(new Date()));
  }

  function goPrev() {
    if (mode === "day") setCursor(addDays(cursor, -1));
    else if (mode === "week") setCursor(addDays(cursor, -7));
    else setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  }

  function goNext() {
    if (mode === "day") setCursor(addDays(cursor, 1));
    else if (mode === "week") setCursor(addDays(cursor, 7));
    else setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
  }

  function headerLabel(): string {
    if (mode === "day") {
      return cursor.toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
      });
    }
    if (mode === "week") {
      const start = startOfWeek(cursor);
      const end = addDays(start, 6);
      return `${start.toLocaleDateString("ja-JP", { month: "short", day: "numeric" })} 〜 ${end.toLocaleDateString("ja-JP", { month: "short", day: "numeric", year: "numeric" })}`;
    }
    return cursor.toLocaleDateString("ja-JP", { year: "numeric", month: "long" });
  }

  function renderEvent(record: AppRecord) {
    const values = valuesByRecord[record.id] ?? {};
    const title = titleField
      ? formatFieldDisplayValue(titleField, values[titleField.id])
      : `#${record.id.slice(0, 8)}`;
    const href = `/apps/${appId}/records/${record.id}`;

    return (
      <Link
        key={record.id}
        href={href}
        className="block rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-900 hover:bg-blue-100 transition-colors"
      >
        <span className="font-medium truncate block">{title}</span>
        {extraFields.map((f) => (
          <span key={f.id} className="text-blue-700/80 truncate block">
            {f.label}: {formatFieldDisplayValue(f, values[f.id])}
          </span>
        ))}
      </Link>
    );
  }

  function renderDayCell(day: Date, inMonth = true) {
    const key = toDateKey(day);
    const dayEvents = eventsByDate.get(key) ?? [];
    const isToday = isSameDay(day, new Date());

    return (
      <div
        key={key}
        className={`min-h-[100px] border border-gray-200 p-1.5 ${inMonth ? "bg-white" : "bg-gray-50"}`}
      >
        <div
          className={`text-xs font-medium mb-1 ${isToday ? "text-blue-600" : inMonth ? "text-gray-700" : "text-gray-400"}`}
        >
          {day.getDate()}
        </div>
        <div className="space-y-1">
          {dayEvents.slice(0, 3).map(renderEvent)}
          {dayEvents.length > 3 && (
            <p className="text-[10px] text-gray-500 px-1">+{dayEvents.length - 3}件</p>
          )}
        </div>
      </div>
    );
  }

  function renderDayView() {
    const key = toDateKey(cursor);
    const dayEvents = eventsByDate.get(key) ?? [];

    return (
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 border-b border-gray-200">
          {cursor.toLocaleDateString("ja-JP", { weekday: "long" })}
        </div>
        <div className="p-4 space-y-2 min-h-[200px]">
          {dayEvents.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">この日の予定はありません</p>
          ) : (
            dayEvents.map(renderEvent)
          )}
        </div>
      </div>
    );
  }

  function renderWeekView() {
    const start = startOfWeek(cursor);
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

    return (
      <div className="grid grid-cols-7 gap-0 border border-gray-200 rounded-lg overflow-hidden">
        {days.map((day, i) => (
          <div key={toDateKey(day)} className="border-r border-gray-200 last:border-r-0">
            <div className="bg-gray-50 text-center text-xs font-medium text-gray-600 py-1.5 border-b border-gray-200">
              {WEEKDAY_LABELS[i]}
            </div>
            {renderDayCell(day)}
          </div>
        ))}
      </div>
    );
  }

  function renderMonthView() {
    const monthStart = startOfMonth(cursor);
    const monthEnd = endOfMonth(cursor);
    const gridStart = startOfWeek(monthStart);
    const cells: Date[] = [];
    let d = gridStart;
    while (d <= monthEnd || cells.length % 7 !== 0) {
      cells.push(new Date(d));
      d = addDays(d, 1);
      if (cells.length > 42) break;
    }

    return (
      <div>
        <div className="grid grid-cols-7 border border-gray-200 rounded-t-lg overflow-hidden">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="bg-gray-50 text-center text-xs font-medium text-gray-600 py-2 border-r border-gray-200 last:border-r-0"
            >
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 border-x border-b border-gray-200 rounded-b-lg overflow-hidden">
          {cells.map((day) =>
            renderDayCell(day, day.getMonth() === cursor.getMonth())
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={goPrev} aria-label="前へ">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={goToday}>
            今日
          </Button>
          <Button variant="secondary" size="sm" onClick={goNext} aria-label="次へ">
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium text-gray-800 ml-1">{headerLabel()}</span>
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {(["day", "week", "month"] as CalendarMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 text-sm transition-colors ${
                mode === m
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-12">読み込み中...</p>
      ) : mode === "day" ? (
        renderDayView()
      ) : mode === "week" ? (
        renderWeekView()
      ) : (
        renderMonthView()
      )}
    </div>
  );
}
