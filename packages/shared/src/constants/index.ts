// ============================================================================
// Shared constants and enums
// ============================================================================

/** Contract review status */
export const ContractStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const
export type ContractStatus = (typeof ContractStatus)[keyof typeof ContractStatus]

/** Contract archive status */
export const ArchiveStatus = {
  PENDING_ARCHIVE: 'PENDING_ARCHIVE',
  ARCHIVED: 'ARCHIVED',
} as const
export type ArchiveStatus = (typeof ArchiveStatus)[keyof typeof ArchiveStatus]

/** Payment status */
export const PaymentStatus = {
  UNPAID: 'UNPAID',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID',
} as const
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus]

/** Workflow node type */
export const NodeType = {
  SIMPLE: 'SIMPLE',
  REVIEW: 'REVIEW',
  PARALLEL_REVIEW: 'PARALLEL_REVIEW',
  MULTI_ASSIGNEE: 'MULTI_ASSIGNEE',
  AUTO: 'AUTO',
} as const
export type NodeType = (typeof NodeType)[keyof typeof NodeType]

/** Workflow instance status */
export const WfInstanceStatus = {
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const
export type WfInstanceStatus = (typeof WfInstanceStatus)[keyof typeof WfInstanceStatus]

/** Workflow task status */
export const WfTaskStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  SKIPPED: 'SKIPPED',
} as const
export type WfTaskStatus = (typeof WfTaskStatus)[keyof typeof WfTaskStatus]

/** Workflow task result */
export const WfTaskResult = {
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SUBMITTED: 'SUBMITTED',
} as const
export type WfTaskResult = (typeof WfTaskResult)[keyof typeof WfTaskResult]

/** Project member role type */
export const ProjectRoleType = {
  PM: 'PM',
  ASSESSOR: 'ASSESSOR',
  TECH_REVIEWER: 'TECH_REVIEWER',
  CONTENT_REVIEWER_A: 'CONTENT_REVIEWER_A',
  CONTENT_REVIEWER_B: 'CONTENT_REVIEWER_B',
  CONTENT_REVIEWER_C: 'CONTENT_REVIEWER_C',
  REPORT_WRITER: 'REPORT_WRITER',
} as const
export type ProjectRoleType = (typeof ProjectRoleType)[keyof typeof ProjectRoleType]

/** System roles */
export const SystemRole = {
  SUPER_ADMIN: 'super_admin',
  SALES: 'sales',
  COMMERCIAL: 'commercial',
  POLICE_REGISTER: 'police_register',
  PROJECT_MANAGER: 'project_manager',
  ASSESSOR: 'assessor',
  TECH_REVIEWER: 'tech_reviewer',
  CONTENT_REVIEWER_TECH: 'content_reviewer_tech',
  CONTENT_REVIEWER_MGMT: 'content_reviewer_mgmt',
  CONTENT_REVIEWER_NETWORK: 'content_reviewer_network',
  REPORT_WRITER: 'report_writer',
  DEPT_MANAGER: 'dept_manager',
} as const
export type SystemRole = (typeof SystemRole)[keyof typeof SystemRole]

/** User account source type */
export const SourceType = {
  LOCAL: 'LOCAL',
  DINGTALK: 'DINGTALK',
} as const
export type SourceType = (typeof SourceType)[keyof typeof SourceType]

// ============================================================================
// 行业枚举（等保监管分类）
//
// 用途：
//   - customer.industry（客户行业）
//   - project_system_item.assessed_unit_industry（被测单位行业）
//
// 这两处共用同一份枚举，保证：
//   1. "继承客户行业"逻辑能直接 set 同一字符串值
//   2. 等保报告聚合统计时不会出现"政府"和"政务"等同义异写
// ============================================================================

export interface IndustryGroup {
  label: string
  options: readonly string[]
}

export const INDUSTRY_GROUPS: readonly IndustryGroup[] = [
  { label: '信息通信', options: ['电信', '广电', '经营性公众互联网'] },
  {
    label: '金融交通能源',
    options: ['铁路', '银行', '海关', '税务', '民航', '电力', '证券', '保险'],
  },
  {
    label: '政务部门',
    options: [
      '国防科技工业', '公安', '人力资源和社会保障', '财政', '审计', '商务',
      '国土资源', '能源', '交通', '统计', '市场监督管理', '邮政',
      '教育', '文旅', '卫生', '农业农村', '水利', '外交',
      '发展改革', '科技', '宣传', '网信', '法院', '检察院',
      '国防', '工信', '民族事务', '民政', '司法', '自然资源',
      '生态环境', '住建', '退役军人事务', '应急', '国资监管', '体育',
      '信访', '国际发展合作', '医疗保障', '气象', '数据管理', '药监',
      '电子政务',
    ],
  },
  { label: '其他', options: ['其他'] },
] as const

/** 所有行业值的扁平列表（校验用） */
export const ALL_INDUSTRY_VALUES: readonly string[] = INDUSTRY_GROUPS.flatMap(
  (g) => g.options,
)

/** 类型守卫：判断字符串是否为合法行业值 */
export function isValidIndustry(value: string | null | undefined): boolean {
  if (!value) return false
  return ALL_INDUSTRY_VALUES.includes(value)
}

/** Error codes per API_CONVENTIONS.md */
export const ErrorCode = {
  SUCCESS: 0,
  UNAUTHORIZED: 40001,
  FORBIDDEN: 40003,
  BIZ_ERROR: 40101,
  NOT_FOUND: 40401,
  CONFLICT: 40901,
  VALIDATION: 42200,
  INTERNAL: 50000,
} as const
