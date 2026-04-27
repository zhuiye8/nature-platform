import request from './request'
import type { PageQuery, PageResult } from '@nature/shared'

export interface InvoiceSystemEntry {
  systemId: number
  amount: number
}

export interface InvoiceListItem {
  id: number
  contractId: number
  contractNo: string | null
  contractName: string | null
  serviceContent: string | null
  applyAmount: string
  invoiceType: string
  taxRate: string
  status: string
  createdBy: number
  creatorName: string | null
  createdAt: string
  updatedAt: string
}

export interface InvoiceSystemDetail {
  id: number
  systemNo: string | null
  systemName: string
  securityLevel: string | null
  amount: string | null
  applicationName: string | null
}

export interface InvoiceCumulative {
  contractAmount: number
  invoicedTotal: number
  paidTotal: number
  remainingInvoice: number
}

export interface InvoiceDetail {
  id: number
  contractId: number
  invoiceContent: string
  applyAmount: string
  invoiceType: string
  taxRate: string
  description: string | null
  remark: string | null
  status: string
  createdBy: number
  creatorName: string | null
  createdAt: string
  updatedAt: string
  contractNo: string | null
  contractName: string | null
  contractAmount: string | null
  contractInvoiceType: string | null
  contractTaxRate: string | null
  serviceContent: string | null
  customerId: number | null
  customerName: string | null
  systems: InvoiceSystemDetail[]
  cumulative: InvoiceCumulative
}

export interface InvoiceCreateData {
  contractId: number
  systems: InvoiceSystemEntry[]
  invoiceContent: string
  applyAmount: number
  invoiceType: string
  taxRate: string
  description?: string
  remark?: string
}

// ── 合同选项 (按服务内容+名称) ──
export interface ContractOption {
  id: number
  contractNo: string | null
  contractName: string | null
  paymentAmount: string | null
  invoiceType: string | null
  taxRate: string | null
  serviceContent: string | null
  partnerId: number | null
  partnerName: string | null
  customerId: number
  customerName: string | null
}

export const getContractOptions = (params: { serviceContent?: string; keyword?: string }) =>
  request.get<ContractOption[]>('/contract/options', { params }) as unknown as Promise<ContractOption[]>

// ── 系统选项 ──
export interface SystemOption {
  id: number
  systemNo: string | null
  systemName: string
  securityLevel: string | null
  amount: string | null
  projectRegisterId: number
  applicationName: string | null
}

export const getSystemOptions = (contractId: number) =>
  request.get<SystemOption[]>(`/project/system-options/${contractId}`) as unknown as Promise<SystemOption[]>

// ── 开票申请 CRUD ──
export const getInvoicePage = (params: PageQuery & { keyword?: string; status?: string; serviceContent?: string }) =>
  request.get<PageResult<InvoiceListItem>>('/invoice/page', { params })

export const getInvoiceDetail = (id: number) =>
  request.get<InvoiceDetail>(`/invoice/${id}`) as unknown as Promise<InvoiceDetail>

export const createInvoice = (data: InvoiceCreateData) =>
  request.post('/invoice', data)

export const updateInvoice = (id: number, data: InvoiceCreateData) =>
  request.put(`/invoice/${id}`, data)

export const submitInvoice = (id: number) =>
  request.post(`/invoice/${id}/submit`)

export const reviewInvoice = (id: number, action: 'APPROVE' | 'REJECT', remark?: string) =>
  request.post(`/invoice/${id}/review`, { action, remark })

export const deleteInvoice = (id: number) =>
  request.delete(`/invoice/${id}`)
