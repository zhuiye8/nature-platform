/**
 * @input apiClient and ApiResponse from shared HTTP infra
 * @output Node-12 report-content-review list/detail API wrappers and types with displayStatus
 * @position Frontend service layer for report content-review technical/management/network task stage
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
  reviewerTech?: string;
  reviewerManagement?: string;
  reviewerNetwork?: string;
  reviewerA?: string;
  reviewerB?: string;
  reviewerC?: string;
  status: string;
  displayStatus?: string;
  appliedBy?: string;
  submittedAt?: string;
  finishedAt?: string;
  workflowNode?: string;
  workflowStatus?: string;
  tasks: ReportContentReviewTaskRecord[];
}

function normalizeRecord(record: ReportContentReviewRecord): ReportContentReviewRecord {
  const reviewerTech = record.reviewerTech ?? record.reviewerA;
  const reviewerManagement = record.reviewerManagement ?? record.reviewerB;
  const reviewerNetwork = record.reviewerNetwork ?? record.reviewerC;

  return {
    ...record,
    reviewerTech,
    reviewerManagement,
    reviewerNetwork,
    reviewerA: reviewerTech,
    reviewerB: reviewerManagement,
    reviewerC: reviewerNetwork
  };
}

export async function fetchReportContentReviews(): Promise<ReportContentReviewRecord[]> {
  const response = await apiClient.get<ApiResponse<ReportContentReviewRecord[]>>(
    "/report-content-reviews"
  );
  return response.data.data.map(normalizeRecord);
}

export async function fetchReportContentReviewDetail(
  projectId: number
): Promise<ReportContentReviewRecord> {
  const response = await apiClient.get<ApiResponse<ReportContentReviewRecord>>(
    `/report-content-reviews/${projectId}`
  );
  return normalizeRecord(response.data.data);
}
