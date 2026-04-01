import { ref } from 'vue'
import { ElNotification } from 'element-plus'
import { getNotifications, getUnreadCount, markRead, markAllRead } from '@/api/notification'
import type { NotificationItem } from '@/api/notification'

const unreadCount = ref(0)
const notifications = ref<NotificationItem[]>([])
let eventSource: EventSource | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

export function useNotification() {
  function connect() {
    const token = localStorage.getItem('token')
    if (!token) return

    // Close existing connection
    disconnect()

    eventSource = new EventSource(`/api/notification/stream?token=${token}`)

    eventSource.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data)
        // SSE pushes { type: 'NOTIFICATION', notification: {...} }
        const notif: NotificationItem = raw.notification ?? raw
        if (!notif.title) return // skip heartbeat or malformed

        unreadCount.value++
        notifications.value.unshift(notif)
        // Keep only latest 50 in memory
        if (notifications.value.length > 50) {
          notifications.value = notifications.value.slice(0, 50)
        }
        ElNotification({
          title: notif.title,
          message: notif.content || '',
          type: 'info',
          duration: 5000,
        })
      } catch {
        // ignore parse errors for heartbeat messages
      }
    }

    eventSource.onerror = () => {
      disconnect()
      // Reconnect after 5 seconds
      reconnectTimer = setTimeout(() => {
        connect()
      }, 5000)
    }
  }

  function disconnect() {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  async function fetchUnreadCount() {
    try {
      const res = (await getUnreadCount()) as any
      unreadCount.value = typeof res === 'number' ? res : (res?.count ?? 0)
    } catch {
      // silent
    }
  }

  async function fetchNotifications() {
    try {
      const data = (await getNotifications(1, 20)) as any
      notifications.value = data?.list ?? (Array.isArray(data) ? data : [])
    } catch {
      // silent
    }
  }

  async function handleMarkRead(id: number) {
    try {
      await markRead(id)
      const item = notifications.value.find((n) => n.id === id)
      if (item && !item.readFlag) {
        item.readFlag = true
        unreadCount.value = Math.max(0, unreadCount.value - 1)
      }
    } catch {
      // silent
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllRead()
      notifications.value.forEach((n) => (n.readFlag = true))
      unreadCount.value = 0
    } catch {
      // silent
    }
  }

  return {
    unreadCount,
    notifications,
    connect,
    disconnect,
    fetchUnreadCount,
    fetchNotifications,
    handleMarkRead,
    handleMarkAllRead,
  }
}
