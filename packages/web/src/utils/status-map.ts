/**
 * 统一状态枚举 → 中文标签 + Tag 颜色映射
 * 所有页面引用此文件，避免各页面重复定义
 */

// ── 中文标签 ──────────────────────────────────────────────────────────
export const statusLabel: Record<string, string> = {
  // ── 通用状态 ──
  DRAFT: '草稿',
  SUBMITTED: '已提交',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  COMPLETED: '已完成',
  RUNNING: '进行中',
  CANCELLED: '已取消',
  PENDING: '待处理',
  IN_PROGRESS: '进行中',
  SKIPPED: '已跳过',
  ARCHIVED: '已完成归档',
  PARTIAL_ARCHIVE: '未完成归档',
  PENDING_ARCHIVE: '待归档',
  NOT_ARCHIVED: '未归档',

  // ── 回款状态 ──
  UNPAID: '未回款',
  PARTIAL: '部分回款',
  PAID: '已回款',

  // ── 用户来源 ──
  LOCAL: '本地',
  DINGTALK: '钉钉',

  // ── 工作流动作 ──
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

  // ── 业务类型 ──
  CONTRACT: '合同',
  PROJECT_REGISTER: '项目登记',

  // ── 工作流节点 node_key ──
  CONTRACT_CREATE: '合同创建',
  CONTRACT_REVIEW: '合同审核',
  CONTRACT_AUTO_NUMBER: '自动编号',
  CONTRACT_ARCHIVE: '合同归档',
  PROJECT_REGISTER_NODE: '项目登记申请',
  PROJECT_REVIEW: '审核项目登记',
  POLICE_REGISTER: '公安登记',
  ON_SITE_ASSESSMENT: '现场测评实施',
  TECH_REVIEW: '技术审核',
  CONTENT_REVIEW: '内容审核',
  REPORT_ASSIGN: '报告编制任务分配',
  REPORT_COMPILE: '报告编制',
  FINAL_REVIEW: '最终审核',
  MATERIAL_ARCHIVE: '材料归档',

  // ── 审核操作 ──
  ADJUST: '调整',
  ADJUSTED: '已调整',
  REVIEW: '复核',
  RESUBMIT: '重新提交',
  REJECT_TO_TECH: '驳回至技术审核',
  REJECT_TO_ASSESSMENT: '驳回至现场测评',
  REVIEW_TO_COMPILE: '复核至报告编制',
  PENDING_RECTIFICATION: '待整改',
  FINAL_REJECTED: '最终审核驳回',

  // ── 审核槽位 slot_key ──
  TECH: '整体技术审核',
  CONTENT_A: '内容审核（技术）',
  CONTENT_B: '内容审核（管理）',
  CONTENT_C: '内容审核（网络）',

  // ── 项目成员角色 role_type ──
  PM: '项目经理',
  ASSESSOR: '测评师',
  TECH_REVIEWER: '技术审核',
  CONTENT_REVIEWER_A: '内容审核A',
  CONTENT_REVIEWER_B: '内容审核B',
  CONTENT_REVIEWER_C: '内容审核C',
  REPORT_WRITER: '报告编制人',

  // ── 项目成员状态 ──
  ACTIVE: '在岗',
  REMOVED: '已移除',
  RECUSED: '已回避',

  // ── 系统角色 role_code ──
  super_admin: '超级管理员',
  sales: '销售',
  commercial: '商务',
  police_register: '公安登记专员',
  project_manager: '项目经理',
  assessor: '测评师',
  tech_reviewer: '技术审核人',
  content_reviewer_tech: '内容审核(技术)',
  content_reviewer_mgmt: '内容审核(管理)',
  content_reviewer_network: '内容审核(网络)',
  report_writer: '报告编制人',
  dept_manager: '部门经理',

  // ── 节点类型 node_type ──
  SIMPLE: '简单节点',
  REVIEW: '审核节点',
  PARALLEL_REVIEW: '并行审核',
  MULTI_ASSIGNEE: '多人协作',

  // 权限分类已移至 categoryLabel（避免 key 冲突）

  // ── 报告相关 ──
  REPORT_APPROVED: '报告已通过',
  REPORT_REJECTED: '报告已驳回',
  PENDING_ASSIGNMENT: '待分配',
  COMPILING: '编制中',
  REVIEWING: '审核中',

  // ── 审核流程状态 ──
  TECH_APPROVED: '技术审核通过',
  TECH_REJECTED: '技术审核驳回',
  CONTENT_APPROVED: '内容审核通过',
  CONTENT_REJECTED: '内容审核驳回',
  FINAL_APPROVED: '最终审核通过',
  FINAL_ADJUST: '最终审核调整',
}

// ── Tag 颜色 ─────────────────────────────────────────────────────────
export const statusTagType: Record<string, '' | 'success' | 'warning' | 'danger' | 'info'> = {
  // 通用状态
  DRAFT: 'info',
  SUBMITTED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  COMPLETED: 'success',
  RUNNING: '',
  CANCELLED: 'info',
  PENDING: 'warning',
  IN_PROGRESS: '',
  SKIPPED: 'info',
  ARCHIVED: 'success',
  PARTIAL_ARCHIVE: 'warning',
  PENDING_ARCHIVE: 'info',
  NOT_ARCHIVED: 'info',

  // 回款状态
  UNPAID: 'danger',
  PARTIAL: 'warning',
  PAID: 'success',

  // 用户来源
  LOCAL: 'info',
  DINGTALK: 'warning',

  // 工作流动作
  START: 'info',
  SUBMIT: '',
  APPROVE: 'success',
  REJECT: 'danger',
  REASSIGN: 'warning',
  TRANSITION: 'info',
  AUTO_COMPLETE: 'info',
  AUTO: 'info',
  ALL_COMPLETE: 'success',
  ALL_APPROVED: 'success',
  ANY_REJECTED: 'danger',

  // 业务类型
  CONTRACT: '',
  PROJECT_REGISTER: 'success',

  // 项目成员状态
  ACTIVE: 'success',
  REMOVED: 'danger',
  RECUSED: 'warning',

  // 审核操作
  REVIEW: 'warning',
  RESUBMIT: 'info',
  REJECT_TO_TECH: 'danger',
  REJECT_TO_ASSESSMENT: 'danger',
  REVIEW_TO_COMPILE: 'warning',
  PENDING_RECTIFICATION: 'warning',
  FINAL_REJECTED: 'danger',

  // 报告
  REPORT_APPROVED: 'success',
  REPORT_REJECTED: 'danger',
  PENDING_ASSIGNMENT: 'warning',
  COMPILING: '',
  REVIEWING: 'warning',

  // 审核流程
  TECH_APPROVED: 'success',
  TECH_REJECTED: 'danger',
  CONTENT_APPROVED: 'success',
  CONTENT_REJECTED: 'danger',
  FINAL_APPROVED: 'success',
  FINAL_ADJUST: 'warning',
}

// ── 权限分类名 → 中文（独立 map，避免与 statusLabel key 冲突）──
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
}

export function getCategoryLabel(category: string): string {
  return categoryLabel[category] || category
}

// ── 辅助函数 ─────────────────────────────────────────────────────────

/** 获取枚举值的中文标签，未匹配返回原值 */
export function getStatusLabel(val: string | null | undefined): string {
  if (!val) return '--'
  return statusLabel[val] ?? val
}

/** 获取枚举值对应的 el-tag type */
export function getStatusTagType(val: string | null | undefined): '' | 'success' | 'warning' | 'danger' | 'info' {
  if (!val) return 'info'
  return statusTagType[val] ?? 'info'
}
