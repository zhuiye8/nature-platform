import request from './request'

export interface ReviewOpinionItem {
  id: number
  projectRegisterId: number
  roundNo: number
  nodeKey: string
  slotKey: string | null
  actionType: string
  opinionText: string | null
  attachmentIds: number[] | null
  operatorId: number
  operatorName: string | null
  createdAt: string
}

export interface ReviewOpinionTemplateItem {
  id: number
  nodeKey: string
  slotKey: string | null
  actionType: string
  templateText: string
  sortOrder: number
}

export function getOpinionHistory(projectRegisterId: number) {
  return request.get<ReviewOpinionItem[]>(`/review-opinion/${projectRegisterId}`)
}

export function getOpinionTemplates(
  nodeKey: string,
  actionType: string,
  slotKey?: string,
) {
  return request.get<ReviewOpinionTemplateItem[]>('/review-opinion/templates', {
    params: { nodeKey, actionType, ...(slotKey ? { slotKey } : {}) },
  })
}
