import request from './request'
import type { PageQuery, PageResult } from '@nature/shared'

export interface PlatformItem {
  id: number
  /** 业务编号 P-{4位序号}（如 P-0001），由后端 platform_serial 自增分配 */
  platformNo: string | null
  platformName: string | null
  websiteUrl: string | null
  account: string | null
  password: string | null
  hasCa: boolean
  caExpireDate: string | null
  caPassword: string | null
  contactName: string | null
  contactPhone: string | null
  remark: string | null
  createdBy: number
  creatorName?: string | null
  createdAt: string
}

export interface PlatformForm {
  platformName?: string
  websiteUrl?: string
  account?: string
  password?: string
  hasCa?: boolean
  caExpireDate?: string
  caPassword?: string
  contactName?: string
  contactPhone?: string
  remark?: string
}

export interface PlatformQuery extends PageQuery {
  platformName?: string
  hasCa?: string
  caExpireDateFrom?: string
  caExpireDateTo?: string
  createdByUserId?: number
}

export function getPlatformPage(params: PlatformQuery) {
  return request.get<PageResult<PlatformItem>>('/platform/page', { params })
}

export function createPlatform(data: PlatformForm) {
  return request.post<PlatformItem>('/platform', data)
}

export function updatePlatform(id: number, data: PlatformForm) {
  return request.put<PlatformItem>(`/platform/${id}`, data)
}

export function deletePlatform(id: number) {
  return request.delete(`/platform/${id}`)
}

export function getExportUrl(params: PlatformQuery & { fields?: string }) {
  const token = localStorage.getItem('token')
  const qs = new URLSearchParams()
  if (params.platformName) qs.set('platformName', params.platformName)
  if (params.websiteUrl) qs.set('websiteUrl', params.websiteUrl)
  if (params.hasCa) qs.set('hasCa', params.hasCa)
  if (params.caExpireDateFrom) qs.set('caExpireDateFrom', params.caExpireDateFrom)
  if (params.caExpireDateTo) qs.set('caExpireDateTo', params.caExpireDateTo)
  if (params.createdByUserId) qs.set('createdByUserId', String(params.createdByUserId))
  if (params.fields) qs.set('fields', params.fields)
  if (token) qs.set('token', token)
  return `/api/platform/export?${qs.toString()}`
}

export function importPlatform(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return request.post('/platform/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
