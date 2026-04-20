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

/**
 * 掩码证书编号：前4位 + 中间 * + 后4位
 * 长度 < 8 时全掩码（使用 * 等长替换）
 * 例: "2500015586031331" → "2500********1331"
 */
export function maskCertificateNo(cert: string | null | undefined): string {
  if (!cert) return '-'
  const s = String(cert).trim()
  if (s.length < 8) return '*'.repeat(s.length || 0) || '-'
  const prefix = s.slice(0, 4)
  const suffix = s.slice(-4)
  const middleLen = s.length - 8
  return `${prefix}${'*'.repeat(middleLen)}${suffix}`
}

/**
 * 文件大小格式化（字节 → KB/MB）
 */
export function formatFileSize(bytes: number): string {
  if (!bytes) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
