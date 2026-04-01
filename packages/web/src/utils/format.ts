/**
 * 格式化时间为北京时间，格式：2026-03-31 12:56:31
 */
export function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '-'
  // 北京时间 = UTC+8
  const pad = (n: number) => String(n).padStart(2, '0')
  const bj = new Date(d.getTime() + (d.getTimezoneOffset() + 480) * 60000)
  return `${bj.getFullYear()}-${pad(bj.getMonth() + 1)}-${pad(bj.getDate())} ${pad(bj.getHours())}:${pad(bj.getMinutes())}:${pad(bj.getSeconds())}`
}
