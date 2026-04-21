import request from './request'

export interface AssessmentProject {
  id: number
  applicationName: string
  contractYear: number
  status: string
  createdAt: string
}

export interface AssessmentSystemItem {
  id: number
  projectRegisterId: number
  systemName: string
  assessedUnitName: string
  securityLevel: string
  filingAgency: string
  filingCertificateNo: string
  contractYear: number
  applicationName: string
  projectManagerName: string | null
  createdAt: string
}

export interface MemberProgress {
  userId: number
  displayName: string
  roleType: string
  submitted: boolean
}

export interface ProgressInfo {
  total: number
  completed: number
  members: MemberProgress[]
}

export interface ReviewSlot {
  id: number
  slotKey: string
  assigneeId: number | null
  assigneeName: string | null
  status: string
  result: string | null
  remark: string | null
  completedAt: string | null
}

export interface ReviewStatus {
  instanceId: number
  currentNode: string
  slots: ReviewSlot[]
}

export interface ProjectDetailForAssessment {
  id: number
  applicationName: string
  contractYear: number
  customerName: string
  status: string
  // ── 关联合同信息（后端 leftJoin contract/customer）──
  contractId: number | null
  contractNo: string | null
  contractName: string | null
  serviceContent: string | null
  contractType: string | null
  serviceYears: number[] | null
  paymentAmount: string | number | null
  contactName: string | null
  contactPhone: string | null
  partnerName: string | null
  salesPersonName: string | null
  customerUscc: string | null
  contractArchiveStatus: string | null
  contractArchivedAt: string | null
  contractArchivedByName: string | null
  // ── 成员 / 系统明细 ──
  members: { userId: number; roleType: string; displayName: string }[]
  systemItems: any[]
}

export const getAssessmentPage = (params: Record<string, any>) =>
  request.get('/assessment/page', { params })

export const getAssessmentProjectDetail = (projectRegisterId: number): Promise<ProjectDetailForAssessment> =>
  request.get(`/assessment/project-detail/${projectRegisterId}`) as any

export const getAssessmentProgress = (projectRegisterId: number): Promise<ProgressInfo> =>
  request.get(`/assessment/progress/${projectRegisterId}`) as any

export const getReviewStatus = (projectRegisterId: number): Promise<ReviewStatus | null> =>
  request.get(`/assessment/review-status/${projectRegisterId}`) as any

export const submitAssessment = (data: { projectRegisterId: number; assessmentDetail?: string; assessmentRemark?: string }) =>
  request.post('/assessment/submit', data)

export const initiateQualityReview = (projectRegisterId: number) =>
  request.post(`/assessment/initiate-review/${projectRegisterId}`)

export const resubmitAssessmentResult = (projectRegisterId: number) =>
  request.post(`/assessment/resubmit/${projectRegisterId}`)
