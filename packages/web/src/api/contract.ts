import request from './request'
import type { PageQuery, PageResult } from '@nature/shared'

export interface ContractSystemItem {
  id?: number
  systemName: string
  systemLevel: number
  sortOrder: number
}

export interface ContractGroupItem {
  id: number
  groupName: string
  remark: string | null
  contracts: ContractItem[]
  createdBy: number
  createdAt: string
}

export interface ContractItem {
  id: number
  groupId: number
  contractCategory: string | null
  groupName?: string | null
  groupContracts?: { id: number; contractNo: string | null; contractName: string | null; contractCategory: string | null; reviewStatus: string }[]
  customerId: number
  customerName?: string
  customerUscc?: string | null
  /** Customer region (format: "省/市/区") — only returned by findById, used to auto-fill project system items */
  customerRegion?: string | null
  /** Customer address detail — only returned by findById, used to auto-fill project system items */
  customerAddressDetail?: string | null
  contractNo: string | null
  contractName: string | null
  contactName: string | null
  contactPhone: string | null
  paymentCompany: string | null
  paymentAmount: number | null
  paymentMethod: string | null
  paymentInfo: string | null
  invoiceType: string | null
  taxRate: string | null
  partnerName: string | null
  partnerId: number | null
  salesPersonId: number | null
  salesPersonName?: string | null
  performanceCity: string | null
  dealStatus: string | null
  serviceContent: string | null
  contractType: string | null
  serviceYears: number[]
  serviceYearDetail: string | null
  signedAt: string | null
  paymentStatus: string
  paymentRemark: string | null
  financialHandlerId: number | null
  financialHandlerName?: string | null
  archiveStatus: string
  reviewStatus: string
  remark: string | null
  createdBy: number
  createdAt: string
  updatedAt: string
  systemItems?: ContractSystemItem[]
  systemItemsSummary?: { systemName: string; systemLevel: number }[]
  /**
   * 已通过项目登记的实际系统明细 (扁平化，按项目+年度分组排序)
   * 合同详情页替代 systemItems 展示 — systemItems 是合同签约时的粗粒度
   * 约定清单，projectSystemItems 才是"实际执行的系统清单"含项目编号。
   * 仅在 findById 返回。
   */
  projectSystemItems?: Array<{
    projectId: number
    applicationName: string
    contractYear: number
    projectStatus: string
    systemItemId: number
    systemNo: string | null
    systemName: string
    securityLevel: string | null
    filingAgency: string | null
    assessedUnitName: string | null
    filingCertificateNo: string | null
  }>
  /**
   * Current reviewer label for the CONTRACT_REVIEW stage (only populated when
   * reviewStatus === 'SUBMITTED' and the workflow is at CONTRACT_REVIEW):
   *   - '部门经理' when pool review is active
   *   - an actual user display name when a single-assign fallback is in effect
   *   - null otherwise (draft / approved / archived)
   */
  currentReviewerLabel?: string | null
}

export interface ContractForm {
  groupId: number | undefined
  contractCategory?: string
  customerId: number | undefined
  contactName?: string
  contactPhone?: string
  paymentCompany?: string
  paymentAmount?: number
  paymentMethod?: string
  paymentInfo?: string
  invoiceType?: string
  taxRate?: string
  partnerId?: number
  partnerName?: string
  salesPersonId?: number
  performanceCity?: string
  dealStatus?: string
  serviceContent?: string
  contractType?: string
  serviceYears: number[]
  serviceYearDetail?: string
  remark?: string
  systemItems: ContractSystemItem[]
}

export function getContractPage(params: PageQuery & { keyword?: string; reviewStatus?: string }) {
  return request.get<PageResult<ContractItem>>('/contract/page', { params })
}

export function getContractDetail(id: number) {
  return request.get<ContractItem>(`/contract/${id}`)
}

export function createContract(data: ContractForm) {
  return request.post<ContractItem>('/contract', data)
}

export function updateContract(id: number, data: Partial<ContractForm>) {
  return request.put<ContractItem>(`/contract/${id}`, data)
}

export function deleteContract(id: number) {
  return request.delete(`/contract/${id}`)
}

export function submitContract(id: number) {
  return request.post(`/contract/${id}/submit`)
}

export interface ArchiveContractData {
  storageLocation?: string
  fileCount?: number
  archiveRemark?: string
  scanFileUrl?: string
  isComplete?: boolean
}

export interface UpdateFinancialData {
  paymentAmount?: number
  paymentMethod?: string
  paymentCompany?: string
  paymentInfo?: string
  invoiceType?: string
  taxRate?: string
  performanceCity?: string
  paymentStatus?: string
  paymentRemark?: string
}

export function updateContractFinancial(id: number, data: UpdateFinancialData) {
  return request.patch(`/contract/${id}/financial`, data)
}

export function archiveContract(id: number, data: ArchiveContractData) {
  return request.post(`/contract/${id}/archive`, data)
}

export interface PayerOption {
  id: number
  name: string
  type: 'CUSTOMER' | 'PARTNER'
}

// ── Contract Group API ──

export function createContractGroup(data: { groupName: string; remark?: string }) {
  return request.post<ContractGroupItem>('/contract/group', data)
}

export function getContractGroupPage(params: PageQuery & { keyword?: string }) {
  return request.get<PageResult<ContractGroupItem>>('/contract/group/page', { params })
}

export function updateContractGroup(id: number, data: { groupName?: string; remark?: string }) {
  return request.put<ContractGroupItem>(`/contract/group/${id}`, data)
}

export function deleteContractGroup(id: number) {
  return request.delete(`/contract/group/${id}`)
}
