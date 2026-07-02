import { stripNumberCommas } from "@/lib/utils";
import type { AppField, FilterCondition, FilterConfig } from "@/types";

function dateOnly(raw: string): string {
  return raw.slice(0, 10);
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

function evaluateCondition(
  cond: FilterCondition,
  field: AppField | undefined,
  rawValue: string | undefined
): boolean {
  const raw = (rawValue ?? "").trim();

  switch (cond.operator) {
    case "eq":
    case "neq":
    case "lt":
    case "lte":
    case "gt":
    case "gte": {
      const num = Number(stripNumberCommas(raw));
      const target = Number(cond.value ?? "");
      if (!Number.isFinite(num) || !Number.isFinite(target)) return false;
      if (cond.operator === "eq") return num === target;
      if (cond.operator === "neq") return num !== target;
      if (cond.operator === "lt") return num < target;
      if (cond.operator === "lte") return num <= target;
      if (cond.operator === "gt") return num > target;
      return num >= target;
    }

    case "text_eq":
      return raw === (cond.value ?? "").trim();

    case "text_contains":
      return raw.toLowerCase().includes((cond.value ?? "").trim().toLowerCase());

    case "text_in": {
      const targets = new Set((cond.values ?? []).map((v) => v.trim()).filter(Boolean));
      if (targets.size === 0) return false;
      if (field?.field_type === "checkbox") {
        return raw.split(",").some((v) => targets.has(v.trim()));
      }
      return targets.has(raw);
    }

    case "date_on":
    case "date_before":
    case "date_after": {
      if (!raw || !cond.value) return false;
      const rawDate = dateOnly(raw);
      const target = dateOnly(cond.value);
      if (cond.operator === "date_on") return rawDate === target;
      if (cond.operator === "date_before") return rawDate < target;
      return rawDate > target;
    }

    case "date_this_month":
    case "date_last_month":
    case "date_next_month": {
      if (!raw) return false;
      const d = new Date(dateOnly(raw));
      if (Number.isNaN(d.getTime())) return false;
      const now = new Date();
      const delta =
        cond.operator === "date_this_month" ? 0 : cond.operator === "date_last_month" ? -1 : 1;
      return monthKey(d) === monthKey(shiftMonth(now, delta));
    }

    default:
      return true;
  }
}

/** フィルタ条件をレコード1件に適用（未設定 or 条件0件なら常に true） */
export function matchesFilter(
  filter: FilterConfig | undefined,
  fields: AppField[],
  values: Record<string, string>
): boolean {
  if (!filter || filter.conditions.length === 0) return true;

  const results = filter.conditions.map((cond) => {
    const field = fields.find((f) => f.id === cond.field_id);
    return evaluateCondition(cond, field, values[cond.field_id]);
  });

  return filter.logic === "or" ? results.some(Boolean) : results.every(Boolean);
}

/** 有効な（フィールドが実在し、値が入力済みの）条件のみに絞る */
export function sanitizeFilterConfig(
  filter: FilterConfig | undefined,
  fields: AppField[]
): FilterConfig | undefined {
  if (!filter || filter.conditions.length === 0) return undefined;
  const validIds = new Set(fields.map((f) => f.id));
  const conditions = filter.conditions.filter((c) => validIds.has(c.field_id));
  if (conditions.length === 0) return undefined;
  return { logic: filter.logic, conditions };
}
