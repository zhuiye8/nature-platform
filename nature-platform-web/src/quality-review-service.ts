/**
 * @input apiClient and ApiResponse from shared HTTP infrastructure
 * @output Node-9/10 quality-review list/detail/assignment/submit API wrappers and types
 * @position Frontend service layer for quality-review assignment and apply submission workflows
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { apiClient, type ApiResponse } from "./api";

export interface QualityReviewTaskRecord {
  id: number;
  reviewRole: string;
  assignee: string;
  status: string;
  remark?: string;
  processedBy?: string;
  processedAt?: string;
}

export interface QualityReviewRecord {
  projectRegisterId: number;
  applicationName: string;
  projectStatus: string;
  onSiteAssessmentStatus: string;
  onSitePackageObjectKey?: string;
  status: string;
  techReviewer?: string;
  contentReviewerTech?: string;
  contentReviewerManagement?: string;
  contentReviewerNetwork?: string;
  contentReviewerA?: string;
  contentReviewerB?: string;
  contentReviewerC?: string;
  assignmentVersionNo: number;
  appliedBy?: string;
  submittedAt?: string;
  finishedAt?: string;
  workflowNode?: string;
  workflowStatus?: string;
  tasks: QualityReviewTaskRecord[];
}

export interface QualityReviewAssignmentPayload {
  techReviewer: string;
  contentReviewerTech: string;
  contentReviewerManagement: string;
  contentReviewerNetwork: string;
  versionNo: number;
}

function normalizeRecord(record: QualityReviewRecord): QualityReviewRecord {
  const contentReviewerTech = record.contentReviewerTech ?? record.contentReviewerA;
  const contentReviewerManagement =
    record.contentReviewerManagement ?? record.contentReviewerB;
  const contentReviewerNetwork = record.contentReviewerNetwork ?? record.contentReviewerC;

  return {
    ...record,
    contentReviewerTech,
    contentReviewerManagement,
    contentReviewerNetwork,
    contentReviewerA: contentReviewerTech,
    contentReviewerB: contentReviewerManagement,
    contentReviewerC: contentReviewerNetwork
  };
}

export async function fetchQualityReviews(): Promise<QualityReviewRecord[]> {
  const response = await apiClient.get<ApiResponse<QualityReviewRecord[]>>("/quality-reviews");
  return response.data.data.map(normalizeRecord);
}

export async function fetchQualityReviewDetail(projectId: number): Promise<QualityReviewRecord> {
  const response = await apiClient.get<ApiResponse<QualityReviewRecord>>(
    `/quality-reviews/${projectId}`
  );
  return normalizeRecord(response.data.data);
}

export async function fetchQualityReviewCandidates(): Promise<string[]> {
  const response = await apiClient.get<ApiResponse<string[]>>("/quality-reviews/candidates");
  return response.data.data;
}

export async function saveQualityReviewAssignment(
  projectId: number,
  payload: QualityReviewAssignmentPayload
): Promise<QualityReviewRecord> {
  const response = await apiClient.put<ApiResponse<QualityReviewRecord>>(
    `/quality-reviews/${projectId}/assignment`,
    payload
  );
  return normalizeRecord(response.data.data);
}

export async function submitQualityReview(projectId: number): Promise<QualityReviewRecord> {
  const response = await apiClient.post<ApiResponse<QualityReviewRecord>>(
    `/quality-reviews/${projectId}/submit`
  );
  return normalizeRecord(response.data.data);
}
