import request from './request'
import type { PageQuery, PageResult } from '@nature/shared'

export interface ProjectSystemItem {
  id?: number
  clientKey?: string
  systemName: string
  filingAgency: string
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

// System item CRUD
export function getSystemItems(projectId: number) {
  return request.get<ProjectSystemItem[]>(`/project/${projectId}/system-items`)
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
