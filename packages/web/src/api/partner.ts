import request from './request'

export interface PartnerItem {
  id: number
  name: string
  contactName: string | null
  contactPhone: string | null
  remark: string | null
  createdAt: string
}

export interface PartnerForm {
  name: string
  contactName?: string
  contactPhone?: string
  remark?: string
}

export const getPartnerList = () =>
  request.get<PartnerItem[]>('/partner/list')

export const createPartner = (data: PartnerForm) =>
  request.post<PartnerItem>('/partner', data)

export const updatePartner = (id: number, data: Partial<PartnerForm>) =>
  request.put<PartnerItem>(`/partner/${id}`, data)

export const deletePartner = (id: number) =>
  request.delete(`/partner/${id}`)
