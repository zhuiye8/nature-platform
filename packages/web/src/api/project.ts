import request from './request'
import type { PageQuery, PageResult } from '@nature/shared'

/**
 * 项目系统明细 —— 表单/提交用（前端填写时保证非空）。
 * 对应 CreateProjectSystemItemDto。
 */
export interface ProjectSystemItem {
  id?: number
  clientKey?: string
  systemName: string
  filingAgency: string
  /** 备案地区完整级联路径 "省/市/区"，用于编辑时 cascader 完整回显 */
  filingRegion?: string | null
  securityLevel: string
  isReassessment: boolean
  requiredEntryDate: string | null
  requiredReportDeliveryDate: string | null
  assessedUnitName: string
  assessedUnitIndustry?: string
  assessedUnitContact: string
  assessedUnitMobile: string
  assessedUnitAddress: string
  hasFilingCertificate: boolean
  filingCertificateNo: string
  filingCertificateIssuedAt: string | null
  hasFilingForm: boolean
  hasClassificationReport: boolean
  sortOrder?: number
}

/** 附件对象 —— getSystemItems enrich 出来的轻量字段集合（仅 id/name/size） */
export interface SystemItemFileAttachment {
  id: number
  fileName: string
  fileSize: number
}

/**
 * 项目系统明细 —— 读取用（DB 返回，含附件信息）。
 * 对应 getSystemItems(projectId) 的返回项：project_system_item 原始行 + 3 个文件附件字段。
 * 与 ProjectSystemItem（表单模型）不同：字段以 DB nullable 为准，不做业务必填约束。
 */
export interface EnrichedSystemItem {
  id: number
  projectRegisterId: number
  systemNo: string | null
  systemName: string
  filingAgency: string | null
  filingRegion: string | null
  securityLevel: string | null
  isReassessment: boolean
  requiredEntryDate: string | null
  requiredReportDeliveryDate: string | null
  assessedUnitName: string | null
  assessedUnitIndustry: string | null
  assessedUnitContact: string | null
  assessedUnitMobile: string | null
  assessedUnitAddress: string | null
  hasFilingCertificate: boolean
  filingCertificateNo: string | null
  filingCertificateIssuedAt: string | null
  hasFilingForm: boolean
  hasClassificationReport: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
  filingCertificateFile: SystemItemFileAttachment | null
  filingFormFile: SystemItemFileAttachment | null
  classificationReportFile: SystemItemFileAttachment | null
}

export interface ProjectMember {
  id: number
  userId: number
  displayName: string
  roleType: string
  status: string
  assignedAt?: string
}

export interface ProjectItem {
  id: number
  contractId: number
  contractYear: number
  applicationName: string
  applicationNo: string | null
  status: string
  contractName?: string
  createdAt: string
}

export interface ProjectDetail extends ProjectItem {
  applicationNo: string | null
  systemItems: ProjectSystemItem[]
  members: ProjectMember[]
  remark?: string
}

export interface ProjectForm {
  contractId: number
  contractYear: number
  applicationName?: string
  remark?: string
  systemItems: ProjectSystemItem[]
}

export function getProjectPage(params: PageQuery & { keyword?: string; status?: string }) {
  return request.get<PageResult<ProjectItem>>('/project/page', { params })
}

export function getProjectDetail(id: number) {
  return request.get<ProjectDetail>(`/project/${id}`)
}

export function createProject(data: ProjectForm) {
  return request.post<ProjectItem>('/project', data)
}

export function updateProject(id: number, data: Partial<ProjectForm>) {
  return request.put<ProjectItem>(`/project/${id}`, data)
}

export function deleteProject(id: number) {
  return request.delete(`/project/${id}`)
}

export function submitProject(id: number) {
  return request.post(`/project/${id}/submit`)
}

export function assignMembers(id: number, members: { userId: number; roleType: string }[]) {
  return request.post(`/project/${id}/members`, members)
}

export function getAvailableYears(contractId: number) {
  return request.get<number[]>(`/project/available-years/${contractId}`)
}

export interface ContractSystemQuota {
  total: number
  used: number
  remaining: number
  systemNames: string[]
}

export function getContractSystemQuota(contractId: number, excludeProjectId?: number) {
  return request.get<ContractSystemQuota>(`/project/contract-system-quota/${contractId}`, {
    params: excludeProjectId ? { excludeProjectId } : undefined,
  })
}

// System item CRUD
export function getSystemItems(projectId: number) {
  return request.get<EnrichedSystemItem[]>(`/project/${projectId}/system-items`)
}

export function createSystemItem(projectId: number, data: Omit<ProjectSystemItem, 'id'>) {
  return request.post<ProjectSystemItem>(`/project/${projectId}/system-items`, data)
}

export function updateSystemItem(projectId: number, itemId: number, data: Partial<ProjectSystemItem>) {
  return request.put<ProjectSystemItem>(`/project/${projectId}/system-items/${itemId}`, data)
}

export function deleteSystemItem(projectId: number, itemId: number) {
  return request.delete(`/project/${projectId}/system-items/${itemId}`)
}
