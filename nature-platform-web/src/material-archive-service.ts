/**
 * @input apiClient and ApiResponse from shared HTTP infra
 * @output Node-16 material-archive API wrappers and types
 * @position Frontend service layer for final material archive stage operations
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { apiClient, type ApiResponse } from "./api";

export interface MaterialArchiveRecord {
  projectRegisterId: number;
  applicationName: string;
  finalReviewStatus: string;
  onSitePackageObjectKey?: string;
  materialStatusCodes: string[];
  reportFiles: string[];
  formFiles: string[];
  remark?: string;
  status: string;
  submittedBy?: string;
  submittedAt?: string;
  workflowNode?: string;
  workflowStatus?: string;
}

export interface MaterialArchivePayload {
  materialStatusCodes: string[];
  reportFiles: string[];
  formFiles: string[];
  remark?: string;
}

export async function fetchMaterialArchives(): Promise<MaterialArchiveRecord[]> {
  const response = await apiClient.get<ApiResponse<MaterialArchiveRecord[]>>("/material-archives");
  return response.data.data;
}

export async function fetchMaterialArchiveDetail(projectId: number): Promise<MaterialArchiveRecord> {
  const response = await apiClient.get<ApiResponse<MaterialArchiveRecord>>(
    `/material-archives/${projectId}`
  );
  return response.data.data;
}

export async function saveMaterialArchive(
  projectId: number,
  payload: MaterialArchivePayload
): Promise<MaterialArchiveRecord> {
  const response = await apiClient.put<ApiResponse<MaterialArchiveRecord>>(
    `/material-archives/${projectId}`,
    payload
  );
  return response.data.data;
}

export async function submitMaterialArchive(projectId: number): Promise<MaterialArchiveRecord> {
  const response = await apiClient.post<ApiResponse<MaterialArchiveRecord>>(
    `/material-archives/${projectId}/submit`
  );
  return response.data.data;
}
