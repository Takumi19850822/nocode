import type { AppField, NumberFieldConfig } from "@/types";
import { formatNumberWithCommas } from "@/lib/utils";

export function formatFieldDisplayValue(field: AppField, raw: string | undefined): string {
  if (!raw) return "-";
  if (field.field_type === "number") {
    const cfg = field.config as NumberFieldConfig;
    if (cfg.use_comma_separator) return formatNumberWithCommas(raw);
  }
  if (field.field_type === "checkbox" && raw.includes(",")) {
    const labels = raw.split(",").map((v) => {
      const opt = field.options.find((o) => o.value === v);
      return opt?.label ?? v;
    });
    return labels.join(", ");
  }
  if (field.field_type === "select" || field.field_type === "radio") {
    const opt = field.options.find((o) => o.value === raw);
    return opt?.label ?? raw;
  }
  return raw;
}
