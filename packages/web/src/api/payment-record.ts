import request from './request'

export interface PaymentRecord {
  id: number
  contractId: number
  amount: string
  paidAt: string
  payer: string | null
  remark: string | null
  createdBy: number
  creatorName: string | null
  createdAt: string
}

export interface PaymentRecordList {
  list: PaymentRecord[]
  summary: {
    contractAmount: number
    totalPaid: number
    remaining: number
  }
}

export const getPaymentRecords = (contractId: number) =>
  request.get<PaymentRecordList>(`/contract/${contractId}/payment-record`) as unknown as Promise<PaymentRecordList>

export const createPaymentRecord = (
  contractId: number,
  data: { amount: number; paidAt: string; payer?: string; remark?: string },
) => request.post(`/contract/${contractId}/payment-record`, data)

export const deletePaymentRecord = (contractId: number, recordId: number) =>
  request.delete(`/contract/${contractId}/payment-record/${recordId}`)
