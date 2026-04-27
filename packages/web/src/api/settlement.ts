import request from './request'
import type { PageQuery, PageResult } from '@nature/shared'

export interface SettlementContractRow {
  id: number
  groupId: number
  contractNo: string | null
  contractName: string | null
  serviceContent: string | null
  paymentAmount: string | null
  signedAt: string | null
  partnerId: number | null
  partnerName: string | null
  customerId: number
  customerName: string | null
  // 聚合
  systemAmountTotal: number
  invoicedTotal: number
  paidTotal: number
  expenseTotal: number
  partnerInvoiceTotal: number
  partnerPaidTotal: number
  grossProfit: number
}

export interface SettlementGroupItem {
  id: number
  groupName: string
  remark: string | null
  createdAt: string
  contracts: SettlementContractRow[]
}

export interface SettlementContractDetail extends SettlementContractRow {
  groupName: string | null
  systems: Array<{
    id: number
    systemNo: string | null
    systemName: string
    securityLevel: string | null
    amount: string | null
    applicationName: string | null
  }>
  invoices: Array<{
    id: number
    invoiceContent: string
    applyAmount: string
    invoiceType: string
    taxRate: string
    creatorName: string | null
    createdAt: string
  }>
  expenses: Array<{
    id: number
    expenseType: string
    requestAmount: string
    invoiceAmount: string | null
    payeeName: string
    partnerName: string | null
    creatorName: string | null
    createdAt: string
  }>
  payments: Array<{
    id: number
    amount: string
    paidAt: string
    payer: string | null
    remark: string | null
    creatorName: string | null
    createdAt: string
  }>
}

export const getSettlementGroupPage = (
  params: PageQuery & {
    keyword?: string
    serviceContent?: string
    customerId?: number
    startDate?: string
    endDate?: string
  },
) => request.get<PageResult<SettlementGroupItem>>('/settlement/group/page', { params })

export const getSettlementContractDetail = (id: number) =>
  request.get<SettlementContractDetail>(`/settlement/contract/${id}`) as unknown as Promise<SettlementContractDetail>
