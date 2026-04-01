import request from './request'
import type { PageQuery, PageResult } from '@nature/shared'

export interface CustomerItem {
  id: number
  fullName: string
  industry: string | null
  region: string | null
  addressDetail: string | null
  uscc: string | null
  contactName: string | null
  mobilePhone: string | null
  isGovernment: boolean
  remark: string | null
  createdBy: number
  createdAt: string
  updatedAt: string
}

export interface CustomerForm {
  fullName: string
  industry?: string
  region?: string
  addressDetail?: string
  uscc?: string
  contactName?: string
  mobilePhone?: string
  isGovernment?: boolean
  remark?: string
}

export function getCustomerPage(params: PageQuery & { keyword?: string }) {
  return request.get<PageResult<CustomerItem>>('/customer/page', { params })
}

export function getCustomerDetail(id: number) {
  return request.get<CustomerItem>(`/customer/${id}`)
}

export function createCustomer(data: CustomerForm) {
  return request.post<CustomerItem>('/customer', data)
}

export function updateCustomer(id: number, data: Partial<CustomerForm>) {
  return request.put<CustomerItem>(`/customer/${id}`, data)
}

export function deleteCustomer(id: number) {
  return request.delete(`/customer/${id}`)
}
