import request from './request'

export type RecycleBizType = 'CONTRACT' | 'CONTRACT_GROUP' | 'PROJECT_REGISTER' | 'PLATFORM'

export interface RecycleItem {
  id: number
  bizType: RecycleBizType
  bizId: number
  displayName: string | null
  snapshotJson: any
  deletedBy: number
  /** 删除人姓名（后端 enrich，2026-05-07 新增）*/
  deletedByName?: string | null
  deletedAt: string
  remark: string | null
}

export const getRecyclePage = (params: Record<string, any>) =>
  request.get('/recycle/page', { params })

export const restoreRecord = (id: number) =>
  request.post(`/recycle/restore/${id}`)

export const permanentDeleteRecord = (id: number) =>
  request.delete(`/recycle/${id}`)
