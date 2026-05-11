import type { ButtonProps, TagProps } from 'element-plus'

export type StatusTagType = NonNullable<TagProps['type']>
export type ActionButtonType = NonNullable<ButtonProps['type']>

export const statusLabel: Record<string, string> = {
  DRAFT: '草稿',
  SUBMITTED: '审核中',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  COMPLETED: '已完成',
  RUNNING: '进行中',
  CANCELLED: '已取消',
  PENDING: '待处理',
  IN_PROGRESS: '进行中',
  SKIPPED: '已跳过',
  ARCHIVED: '已归档',
  PARTIAL_ARCHIVE: '部分归档',
  PENDING_ARCHIVE: '待归档',
  NOT_ARCHIVED: '未归档',

  UNPAID: '未回款',
  PARTIAL: '部分回款',
  PAID: '已回款',

  LOCAL: '本地',
  DINGTALK: '钉钉',

  START: '启动流程',
  SUBMIT: '提交',
  APPROVE: '通过',
  REJECT: '驳回',
  REASSIGN: '转派',
  TRANSITION: '流转',
  AUTO_COMPLETE: '自动完成',
  AUTO: '自动',
  ALL_COMPLETE: '全部完成',
  ALL_APPROVED: '全部通过',
  ANY_REJECTED: '存在驳回',

  CONTRACT: '合同',
  PROJECT_REGISTER: '项目登记',

  CONTRACT_CREATE: '合同创建',
  CONTRACT_REVIEW: '合同审核',
  CONTRACT_AUTO_NUMBER: '自动编号',
  CONTRACT_ARCHIVE: '合同归档',
  PROJECT_REGISTER_NODE: '项目登记申请',
  DEPT_REVIEW: '部门经理确认',
  DIRECTOR_REVIEW: '项目主管审核并分配',
  POLICE_REGISTER: '公安登记',
  ON_SITE_ASSESSMENT: '现场测评实施',
  TECH_REVIEW: '技术审核',
  CONTENT_REVIEW: '内容审核',
  REPORT_ASSIGN: '报告编制任务分配',
  REPORT_COMPILE: '报告编制',
  FINAL_REVIEW: '最终审核',
  MATERIAL_ARCHIVE: '材料归档',

  REVIEW: '复核',
  RESUBMIT: '重新提交',
  REJECT_TO_ASSESSMENT: '驳回至现场测评',
  REVIEW_TO_COMPILE: '复核至报告编制',
  PENDING_RECTIFICATION: '待整改',
  FINAL_REJECTED: '最终审核驳回',

  TECH: '整体技术审核',
  CONTENT_A: '内容审核（技术）',
  CONTENT_B: '内容审核（管理）',
  CONTENT_C: '内容审核（网络）',

  PM: '项目经理',
  ASSESSOR: '测评师',
  TECH_REVIEWER: '技术审核人',
  CONTENT_REVIEWER_A: '内容审核A',
  CONTENT_REVIEWER_B: '内容审核B',
  CONTENT_REVIEWER_C: '内容审核C',
  REPORT_WRITER: '报告编制人',

  ACTIVE: '在岗',
  REMOVED: '已移除',
  RECUSED: '已回避',

  super_admin: '超级管理员',
  sales: '销售',
  commercial: '商务',
  police_register: '公安登记专员',
  project_manager: '项目经理',
  assessor: '测评师',
  tech_reviewer: '技术审核人',
  content_reviewer_tech: '内容审核（技术）',
  content_reviewer_mgmt: '内容审核（管理）',
  content_reviewer_network: '内容审核（网络）',
  report_writer: '报告编制人',
  dept_manager: '部门经理',
  project_director: '项目主管',
  archiver: '归档员',
  report_assigner: '报告分配人',
  senior_assessor: '高级测评师',
  middle_assessor: '中级测评师',
  junior_assessor: '初级测评师',
  finance: '财务',
  chairman: '董事长',

  // 财务工作流节点
  FIN_INVOICE_REVIEW: '开票审核',
  FIN_EXPENSE_DEPT_REVIEW: '请款部门审核',
  FIN_EXPENSE_FIN_REVIEW: '请款财务审核',

  // 财务业务类型 (用于通知 / 待办 bizType 显示)
  INVOICE: '开票申请',
  EXPENSE: '费用请款',

  // 财务请款专用状态: DEPT_APPROVED 是费用请款的中间态
  DEPT_APPROVED: '财务审核中',

  SIMPLE: '简单节点',
  PARALLEL_REVIEW: '并行审核',
  MULTI_ASSIGNEE: '多人协作',

  REPORT_APPROVED: '报告已通过',
  REPORT_REJECTED: '报告已驳回',
  PENDING_ASSIGNMENT: '待分配',
  COMPILING: '编制中',
  REVIEWING: '审核中',

  TECH_APPROVED: '技术审核通过',
  TECH_REJECTED: '技术审核驳回',
  CONTENT_APPROVED: '内容审核通过',
  CONTENT_REJECTED: '内容审核驳回',
  FINAL_APPROVED: '最终审核通过',
}

export const statusTagType: Record<string, StatusTagType> = {
  DRAFT: 'info',
  SUBMITTED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  COMPLETED: 'success',
  RUNNING: 'info',
  CANCELLED: 'info',
  PENDING: 'warning',
  IN_PROGRESS: 'info',
  SKIPPED: 'info',
  ARCHIVED: 'success',
  PARTIAL_ARCHIVE: 'warning',
  PENDING_ARCHIVE: 'info',
  NOT_ARCHIVED: 'info',

  UNPAID: 'danger',
  PARTIAL: 'warning',
  PAID: 'success',

  LOCAL: 'info',
  DINGTALK: 'warning',

  START: 'info',
  SUBMIT: 'info',
  APPROVE: 'success',
  REJECT: 'danger',
  REASSIGN: 'warning',
  TRANSITION: 'info',
  AUTO_COMPLETE: 'info',
  AUTO: 'info',
  ALL_COMPLETE: 'success',
  ALL_APPROVED: 'success',
  ANY_REJECTED: 'danger',

  CONTRACT: 'info',
  PROJECT_REGISTER: 'success',

  ACTIVE: 'success',
  REMOVED: 'danger',
  RECUSED: 'warning',

  REVIEW: 'warning',
  RESUBMIT: 'info',
  REJECT_TO_ASSESSMENT: 'danger',
  REVIEW_TO_COMPILE: 'warning',
  PENDING_RECTIFICATION: 'warning',
  FINAL_REJECTED: 'danger',

  REPORT_APPROVED: 'success',
  REPORT_REJECTED: 'danger',
  PENDING_ASSIGNMENT: 'warning',
  COMPILING: 'info',
  REVIEWING: 'warning',

  TECH_APPROVED: 'success',
  TECH_REJECTED: 'danger',
  CONTENT_APPROVED: 'success',
  CONTENT_REJECTED: 'danger',
  FINAL_APPROVED: 'success',

  // 财务请款专用: 部门通过 → 进入财务审核（用 primary 区分两阶段）
  DEPT_APPROVED: 'primary',
}

export const categoryLabel: Record<string, string> = {
  CUSTOMER: '客户管理',
  CONTRACT: '合同管理',
  PROJECT: '项目管理',
  PARTNER: '合作方管理',
  POLICE: '公安登记',
  ASSESSMENT: '现场测评',
  QUALITY_REVIEW: '质量审核',
  REPORT: '报告管理',
  ARCHIVE: '材料归档',
  WORKFLOW: '工作流',
  IAM: '系统管理',
  AUDIT: '审计日志',
  // 财务相关
  FINANCE: '财务管理',
  INVOICE: '开票申请',
  EXPENSE: '费用请款',
}

// ─── 财务专用状态映射（INVOICE / EXPENSE 同样的字符串 SUBMITTED/APPROVED/REJECTED
//     在不同业务里中文不同，用专用映射避免冲突）─────────────────────────
// INVOICE: DRAFT → 草稿 / SUBMITTED → 审核中 / APPROVED → 已开票 / REJECTED → 需修改
// EXPENSE: DRAFT → 草稿 / SUBMITTED → 部门审核中 / DEPT_APPROVED → 财务审核中 / APPROVED → 已通过 / REJECTED → 需修改
export const invoiceStatusLabel: Record<string, string> = {
  DRAFT: '草稿',
  SUBMITTED: '审核中',
  APPROVED: '已开票',
  REJECTED: '需修改',
}
export const invoiceStatusTagType: Record<string, StatusTagType> = {
  DRAFT: 'info',
  SUBMITTED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
}

export const expenseStatusLabel: Record<string, string> = {
  DRAFT: '草稿',
  SUBMITTED: '部门审核中',
  DEPT_APPROVED: '财务审核中',
  APPROVED: '已通过',
  REJECTED: '需修改',
}
export const expenseStatusTagType: Record<string, StatusTagType> = {
  DRAFT: 'info',
  SUBMITTED: 'warning',
  DEPT_APPROVED: 'primary',
  APPROVED: 'success',
  REJECTED: 'danger',
}

export function getInvoiceStatusLabel(s: string | null | undefined): string {
  if (!s) return '--'
  return invoiceStatusLabel[s] ?? s
}
export function getInvoiceStatusTagType(s: string | null | undefined): StatusTagType {
  if (!s) return 'info'
  return invoiceStatusTagType[s] ?? 'info'
}
export function getExpenseStatusLabel(s: string | null | undefined): string {
  if (!s) return '--'
  return expenseStatusLabel[s] ?? s
}
export function getExpenseStatusTagType(s: string | null | undefined): StatusTagType {
  if (!s) return 'info'
  return expenseStatusTagType[s] ?? 'info'
}

export function getCategoryLabel(category: string): string {
  return categoryLabel[category] || category
}

export function getStatusLabel(val: string | null | undefined): string {
  if (!val) return '--'
  return statusLabel[val] ?? val
}

export function getStatusTagType(val: string | null | undefined): StatusTagType {
  if (!val) return 'info'
  return statusTagType[val] ?? 'info'
}
