/**
 * @input apiClient and ApiResponse from shared HTTP infrastructure
 * @output File download-url API wrapper with task-type/biz ownership context for secured direct download
 * @position Frontend file-access service layer for secured attachment download in detail pages
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { apiClient, type ApiResponse } from "./api";

export interface FileDownloadUrlResponse {
  objectKey: string;
  taskType: string;
  bizId: number;
  url: string;
  expiresAt: string;
  requestedBy: string;
}

export interface FileDownloadUrlRequest {
  objectKey: string;
  taskType: string;
  bizId: number;
}

export async function fetchFileDownloadUrl(
  request: FileDownloadUrlRequest
): Promise<FileDownloadUrlResponse> {
  const response = await apiClient.get<ApiResponse<FileDownloadUrlResponse>>(
    "/files/download-url",
    {
      params: request
    }
  );
  return response.data.data;
}
