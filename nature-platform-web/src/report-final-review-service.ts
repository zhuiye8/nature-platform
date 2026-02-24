/**
 * @input apiClient and ApiResponse from shared HTTP infra
 * @output Node-15 report-final-review API wrappers and types
 * @position Frontend service layer for report final-review assignment and submit stages
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { apiClient, type ApiResponse } from "./api";

export interface ReportFinalReviewRecord {
  projectRegisterId: number;
  applicationName: string;
  compileStatus: string;
  onSitePackageObjectKey?: string;
  reviewer: string;
  status: string;
  remark?: string;
  versionNo: number;
  appliedBy?: string;
  submittedAt?: string;
  finishedAt?: string;
  taskId?: number;
  taskStatus?: string;
  workflowNode?: string;
  workflowStatus?: string;
}

export interface ReportFinalReviewPayload {
  reviewer: string;
  remark?: string;
  versionNo: number;
}

export async function fetchReportFinalReviews(): Promise<ReportFinalReviewRecord[]> {
  const response = await apiClient.get<ApiResponse<ReportFinalReviewRecord[]>>(
    "/report-final-reviews"
  );
  return response.data.data;
}

export async function fetchReportFinalReviewDetail(
  projectId: number
): Promise<ReportFinalReviewRecord> {
  const response = await apiClient.get<ApiResponse<ReportFinalReviewRecord>>(
    `/report-final-reviews/${projectId}`
  );
  return response.data.data;
}

export async function fetchReportFinalReviewCandidates(): Promise<string[]> {
  const response = await apiClient.get<ApiResponse<string[]>>(
    "/report-final-reviews/candidates"
  );
  return response.data.data;
}

export async function saveReportFinalReview(
  projectId: number,
  payload: ReportFinalReviewPayload
): Promise<ReportFinalReviewRecord> {
  const response = await apiClient.put<ApiResponse<ReportFinalReviewRecord>>(
    `/report-final-reviews/${projectId}`,
    payload
  );
  return response.data.data;
}

export async function submitReportFinalReview(
  projectId: number
): Promise<ReportFinalReviewRecord> {
  const response = await apiClient.post<ApiResponse<ReportFinalReviewRecord>>(
    `/report-final-reviews/${projectId}/submit`
  );
  return response.data.data;
}
