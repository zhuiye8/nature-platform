import request from './request'
import type { PageQuery, PageResult } from '@nature/shared'

export interface ExpenseSystemEntry {
  systemId: number
}

export interface ExpenseListItem {
  id: number
  contractId: number
  contractNo: string | null
  contractName: string | null
  serviceContent: string | null
  expenseType: string
  requestAmount: string
  invoiceAmount: string | null
  status: string
  createdBy: number
  creatorName: string | null
  createdAt: string
  updatedAt: string
}

export interface ExpenseSystemDetail {
  id: number
  systemNo: string | null
  systemName: string
  securityLevel: string | null
  amount: string | null
  applicationName: string | null
}

export interface ExpenseDetail {
  id: number
  contractId: number
  expenseType: string
  requestAmount: string
  invoiceType: string | null
  taxRate: string | null
  invoiceAmount: string | null
  payeeName: string
  payeeBank: string
  payeeAccount: string
  partnerId: number | null
  partnerName: string | null
  partnerAmount: string | null
  partnerInvoiceType: string | null
  partnerTaxRate: string | null
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
  systems: ExpenseSystemDetail[]
}

export interface ExpenseCreateData {
  contractId: number
  systems: ExpenseSystemEntry[]
  expenseType: string
  requestAmount: number
  invoiceType?: string
  taxRate?: string
  invoiceAmount?: number
  payeeName: string
  payeeBank: string
  payeeAccount: string
  partnerId?: number
  partnerName?: string
  partnerAmount?: number
  partnerInvoiceType?: string
  partnerTaxRate?: string
  remark?: string
}

export const getExpensePage = (params: PageQuery & { keyword?: string; status?: string; serviceContent?: string; expenseType?: string }) =>
  request.get<PageResult<ExpenseListItem>>('/expense/page', { params })

export const getExpenseDetail = (id: number) =>
  request.get<ExpenseDetail>(`/expense/${id}`) as unknown as Promise<ExpenseDetail>

export const createExpense = (data: ExpenseCreateData) =>
  request.post('/expense', data)

export const updateExpense = (id: number, data: ExpenseCreateData) =>
  request.put(`/expense/${id}`, data)

export const submitExpense = (id: number) =>
  request.post(`/expense/${id}/submit`)

export const reviewExpense = (id: number, action: 'APPROVE' | 'REJECT', remark?: string) =>
  request.post(`/expense/${id}/review`, { action, remark })

export const deleteExpense = (id: number) =>
  request.delete(`/expense/${id}`)
