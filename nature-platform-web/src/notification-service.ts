/**
 * @input apiClient and ApiResponse from local HTTP layer
 * @output Notification query/mutation functions for dashboard notification panel
 * @position Frontend notification service layer encapsulating REST contract usage
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { apiClient, type ApiResponse } from "./api";

export interface NotificationRecord {
  id: number;
  title: string;
  content: string;
  read: boolean;
  createdAt: string;
}

export async function fetchUnreadCount(): Promise<number> {
  const response = await apiClient.get<ApiResponse<{ count: number }>>(
    "/notifications/unread-count"
  );
  return response.data.data.count;
}

export async function fetchNotifications(limit = 20): Promise<NotificationRecord[]> {
  const response = await apiClient.get<ApiResponse<NotificationRecord[]>>("/notifications", {
    params: { limit }
  });
  return response.data.data;
}

export async function markAsRead(id: number): Promise<void> {
  await apiClient.post(`/notifications/${id}/read`);
}

export async function markAllAsRead(): Promise<void> {
  await apiClient.post("/notifications/read-all");
}

export async function deleteNotification(id: number): Promise<void> {
  await apiClient.delete(`/notifications/${id}`);
}
