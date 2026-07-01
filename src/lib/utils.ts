import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generateFieldName(label: string): string {
  return label
    .replace(/[^\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase() || "field";
}

/** 計算式を評価（四則演算のみ、安全な eval） */
export function evaluateExpression(
  expression: string,
  fieldValues: Record<string, number>
): number | null {
  try {
    let expr = expression;
    for (const [name, val] of Object.entries(fieldValues)) {
      expr = expr.replace(new RegExp(`\\{${name}\\}`, "g"), String(val));
    }
    // 安全チェック: 数字・演算子・括弧・小数点のみ
    if (!/^[\d\s+\-*/().]+$/.test(expr)) return null;
    // eslint-disable-next-line no-new-func
    const result = new Function(`"use strict"; return (${expr})`)();
    return typeof result === "number" && isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

/** トークン配列から計算式文字列を生成 */
export function tokensToExpression(
  tokens: Array<{ type: string; field_name?: string; value?: string | number }>
): string {
  return tokens
    .map((t) => {
      if (t.type === "field") return `{${t.field_name}}`;
      if (t.type === "operator") return ` ${t.value} `;
      if (t.type === "number") return String(t.value);
      return "";
    })
    .join("")
    .trim();
}

/** YYYY-MM-DD 形式の本日の日付 */
export function todayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 数値文字列に3桁カンマを付与（小数対応） */
export function formatNumberWithCommas(value: string): string {
  if (!value) return "";
  const normalized = value.replace(/,/g, "");
  if (normalized === "-" || normalized === ".") return normalized;
  const sign = normalized.startsWith("-") ? "-" : "";
  const unsigned = sign ? normalized.slice(1) : normalized;
  const [intPart, decPart] = unsigned.split(".");
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (decPart !== undefined) return `${sign}${formattedInt}.${decPart}`;
  return `${sign}${formattedInt}`;
}

/** カンマを除去した数値文字列 */
export function stripNumberCommas(value: string): string {
  return value.replace(/,/g, "");
}
