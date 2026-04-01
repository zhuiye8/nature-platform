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
