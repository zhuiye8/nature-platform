import request from './request'
import type { PageQuery, PageResult } from '@nature/shared'

export interface ContractSystemItem {
  id?: number
  systemName: string
  systemLevel: number
  sortOrder: number
}

export interface ContractItem {
  id: number
  customerId: number
  customerName?: string
  contractNo: string | null
  contractName: string | null
  paymentCompany: string | null
  paymentAmount: number | null
  paymentMethod: string | null
  partnerName: string | null
  partnerId: number | null
  salesPersonId: number | null
  salesPersonName?: string | null
  performanceCity: string | null
  dealStatus: string | null
  contractType: string | null
  serviceYears: number[]
  serviceYearDetail: string | null
  signedAt: string | null
  paymentStatus: string
  archiveStatus: string
  reviewStatus: string
  remark: string | null
  createdBy: number
  createdAt: string
  updatedAt: string
  systemItems?: ContractSystemItem[]
  systemItemsSummary?: { systemName: string; systemLevel: number }[]
}

export interface ContractForm {
  customerId: number | undefined
  paymentCompany?: string
  paymentAmount?: number
  paymentMethod?: string
  partnerId?: number
  partnerName?: string
  salesPersonId?: number
  performanceCity?: string
  dealStatus?: string
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
  payerType?: string
  payerId?: number
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

export function getPayerOptions(keyword?: string) {
  return request.get<any, PayerOption[]>('/contract/payer-options', { params: { keyword } })
}
