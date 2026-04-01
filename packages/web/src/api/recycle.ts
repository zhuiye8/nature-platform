import request from './request'

export interface RecycleItem {
  id: number
  bizType: string
  bizId: number
  displayName: string | null
  snapshotJson: any
  deletedBy: number
  deletedAt: string
  remark: string | null
}

export const getRecyclePage = (params: Record<string, any>) =>
  request.get('/recycle/page', { params })

export const restoreRecord = (id: number) =>
  request.post(`/recycle/restore/${id}`)

export const permanentDeleteRecord = (id: number) =>
  request.delete(`/recycle/${id}`)
