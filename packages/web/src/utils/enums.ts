// 业务字段共享枚举（避免散落在各组件硬编码）

import type { TagProps } from 'element-plus'
type TagType = NonNullable<TagProps['type']>

// ─── 服务内容（合同字段）──────────────────────────────────
// 6 个固定选项，来源于产品需求；新增/修改请同步更新此处。
export const SERVICE_CONTENT_OPTIONS = [
  '等级保护测评',
  '等保（综合）',
  '安全咨询',
  '渗透测试',
  '风险评估',
  '其他',
] as const

export type ServiceContent = (typeof SERVICE_CONTENT_OPTIONS)[number]

// 服务内容 → 标签颜色
export const SERVICE_CONTENT_TAG_TYPE: Record<string, TagType> = {
  '等级保护测评': 'primary',
  '等保（综合）': 'success',
  '安全咨询': 'info',
  '渗透测试': 'warning',
  '风险评估': 'danger',
  '其他': 'info',
}

// ─── 发票相关 ────────────────────────────────────────────
export const INVOICE_TYPE_OPTIONS = ['专票', '普票', '其他'] as const
export const TAX_RATE_OPTIONS = ['0%', '1%', '3%', '6%', '9%', '13%'] as const

// ─── 费用类型（费用请款）───────────────────────────────────
export const EXPENSE_TYPE_OPTIONS = [
  '报名费',
  '代理费',
  '专家费',
  '合作费',
  '项目提成',
  '差旅费',
  '其它',
] as const

export type ExpenseType = (typeof EXPENSE_TYPE_OPTIONS)[number]

// 差旅费时灰化 invoice_type / tax_rate / invoice_amount
export const EXPENSE_TYPE_TRAVEL = '差旅费'
// 合作费时强制必填 partner_* 字段
export const EXPENSE_TYPE_PARTNER = '合作费'

// 附件危险扩展名黑名单
export const DANGEROUS_FILE_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.sh', '.com', '.scr', '.ps1',
] as const

export function isDangerousFile(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return DANGEROUS_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext))
}
