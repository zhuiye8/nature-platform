/**
 * @input apiClient and ApiResponse from shared HTTP infra
 * @output Node-11 report-tech-review list/detail/candidate/save API wrappers and types with displayStatus
 * @position Frontend service layer for report overall technical-review assignment and task visibility stage
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { apiClient, type ApiResponse } from "./api";

export interface ReportTechReviewRecord {
  projectRegisterId: number;
  applicationName: string;
  qualityStatus: string;
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
  displayStatus?: string;
  workflowNode?: string;
  workflowStatus?: string;
}

export interface ReportTechReviewPayload {
  remark?: string;
  versionNo: number;
}

export async function fetchReportTechReviews(): Promise<ReportTechReviewRecord[]> {
  const response = await apiClient.get<ApiResponse<ReportTechReviewRecord[]>>("/report-tech-reviews");
  return response.data.data;
}

export async function fetchReportTechReviewDetail(
  projectId: number
): Promise<ReportTechReviewRecord> {
  const response = await apiClient.get<ApiResponse<ReportTechReviewRecord>>(
    `/report-tech-reviews/${projectId}`
  );
  return response.data.data;
}

export async function fetchReportTechReviewCandidates(): Promise<string[]> {
  const response = await apiClient.get<ApiResponse<string[]>>("/report-tech-reviews/candidates");
  return response.data.data;
}

export async function saveReportTechReview(
  projectId: number,
  payload: ReportTechReviewPayload
): Promise<ReportTechReviewRecord> {
  const response = await apiClient.put<ApiResponse<ReportTechReviewRecord>>(
    `/report-tech-reviews/${projectId}`,
    payload
  );
  return response.data.data;
}
