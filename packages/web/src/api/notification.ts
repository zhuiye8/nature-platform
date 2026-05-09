import request from './request'
import type { PageResult } from '@nature/shared'

export interface NotificationItem {
  id: number
  title: string
  content: string
  eventType: string
  refType: string
  refId: number
  /** 完整跳转路径 — 优先使用，老通知 NULL 时降级到 refType + refId 映射 */
  targetUrl?: string | null
  readFlag: boolean
  createdAt: string
}

export function getNotifications(page = 1, pageSize = 20) {
  return request.get<PageResult<NotificationItem>>('/notification', {
    params: { page, pageSize },
  })
}

export function getUnreadCount() {
  return request.get<number>('/notification/unread-count')
}

export function markRead(id: number) {
  return request.put(`/notification/${id}/read`)
}

export function markAllRead() {
  return request.put('/notification/read-all')
}

