/**
 * @input apiClient and ApiResponse from shared HTTP infra
 * @output Node-15 report-final-review list/detail API wrappers and types with displayStatus
 * @position Frontend service layer for report final-review task visibility stage
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
  displayStatus?: string;
  workflowNode?: string;
  workflowStatus?: string;
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
