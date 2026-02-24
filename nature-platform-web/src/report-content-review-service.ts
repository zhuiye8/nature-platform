/**
 * @input apiClient and ApiResponse from shared HTTP infra
 * @output Node-12 report-content-review API wrappers and types
 * @position Frontend service layer for report content-review A/B/C stage
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { apiClient, type ApiResponse } from "./api";

export interface ReportContentReviewTaskRecord {
  id: number;
  reviewRole: string;
  assignee: string;
  status: string;
  remark?: string;
  processedBy?: string;
  processedAt?: string;
}

export interface ReportContentReviewRecord {
  projectRegisterId: number;
  applicationName: string;
  techReviewStatus: string;
  onSitePackageObjectKey?: string;
  reviewerA?: string;
  reviewerB?: string;
  reviewerC?: string;
  status: string;
  appliedBy?: string;
  submittedAt?: string;
  finishedAt?: string;
  workflowNode?: string;
  workflowStatus?: string;
  tasks: ReportContentReviewTaskRecord[];
}

export async function fetchReportContentReviews(): Promise<ReportContentReviewRecord[]> {
  const response = await apiClient.get<ApiResponse<ReportContentReviewRecord[]>>(
    "/report-content-reviews"
  );
  return response.data.data;
}

export async function fetchReportContentReviewDetail(
  projectId: number
): Promise<ReportContentReviewRecord> {
  const response = await apiClient.get<ApiResponse<ReportContentReviewRecord>>(
    `/report-content-reviews/${projectId}`
  );
  return response.data.data;
}

export async function submitReportContentReview(
  projectId: number
): Promise<ReportContentReviewRecord> {
  const response = await apiClient.post<ApiResponse<ReportContentReviewRecord>>(
    `/report-content-reviews/${projectId}/submit`
  );
  return response.data.data;
}
