/**
 * @input Backend timestamp strings from REST responses
 * @output Shanghai-time formatted date-time strings for consistent UI rendering
 * @position Frontend shared time-format utility aligned with Asia/Shanghai business timezone
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */

function parseBackendDate(value?: string): Date | null {
  if (!value || !value.trim()) {
    return null;
  }
  const raw = value.trim();

  const withTimezone =
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(raw)
      ? `${raw.replace(" ", "T")}+08:00`
      : raw;

  const date = new Date(withTimezone);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

export function formatShanghaiDateTime(value?: string): string {
  const date = parseBackendDate(value);
  if (!date) {
    return value || "-";
  }
  const formatted = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
  return formatted.replace(/\//g, "-");
}

