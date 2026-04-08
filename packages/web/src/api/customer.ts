import request from './request'
import type { PageQuery, PageResult } from '@nature/shared'

export interface CustomerContact {
  id: number
  customerId: number
  contactName: string
  contactPhone: string | null
  position: string | null
  remark: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface CustomerItem {
  id: number
  fullName: string
  industry: string | null
  region: string | null
  addressDetail: string | null
  uscc: string | null
  isGovernment: boolean
  remark: string | null
  contacts: CustomerContact[]
  createdBy: number
  createdAt: string
  updatedAt: string
}

export interface ContactFormItem {
  contactName: string
  contactPhone?: string
  position?: string
  remark?: string
}

export interface CustomerForm {
  fullName: string
  industry?: string
  region?: string
  addressDetail?: string
  uscc?: string
  isGovernment?: boolean
  remark?: string
  contacts?: ContactFormItem[]
}

export function getCustomerPage(params: PageQuery & { keyword?: string }) {
  return request.get<PageResult<CustomerItem>>('/customer/page', { params })
}

export function getCustomerDetail(id: number) {
  return request.get<CustomerItem>(`/customer/${id}`)
}

export function getCustomerContacts(customerId: number) {
  return request.get<CustomerContact[]>(`/customer/${customerId}/contacts`)
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
