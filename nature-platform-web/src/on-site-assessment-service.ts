/**
 * @input apiClient and ApiResponse from shared HTTP infrastructure
 * @output Node-8 on-site assessment list/detail/save/submit and reviewer-candidate API wrappers with rectification metadata
 * @position Frontend service layer for on-site assessment stage with ZIP package contract and review-rectification context
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { apiClient, type ApiResponse } from "./api";

export interface OnSiteAssessmentRecord {
  id?: number;
  projectRegisterId: number;
  applicationName: string;
  projectStatus: string;
  status: string;
  packageObjectKey?: string;
  techReviewer?: string;
  contentReviewerTech?: string;
  contentReviewerManagement?: string;
  contentReviewerNetwork?: string;
  contentReviewerA?: string;
  contentReviewerB?: string;
  contentReviewerC?: string;
  assignmentVersionNo: number;
  assessmentDetail?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
  workflowNode?: string;
  workflowStatus?: string;
  rectificationNode?: string;
  rectificationRemark?: string;
  rectificationAt?: string;
}

export interface OnSiteAssessmentPayload {
  packageObjectKey?: string;
  assessmentDetail?: string;
}

export interface ReviewAssignmentPayload {
  techReviewer: string;
  contentReviewerTech: string;
  contentReviewerManagement: string;
  contentReviewerNetwork: string;
  versionNo: number;
}

export interface ReviewerCandidates {
  techReviewers: string[];
  contentReviewersTech: string[];
  contentReviewersManagement: string[];
  contentReviewersNetwork: string[];
  contentReviewersA?: string[];
  contentReviewersB?: string[];
  contentReviewersC?: string[];
}

function normalizeAssessmentRecord(record: OnSiteAssessmentRecord): OnSiteAssessmentRecord {
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

function normalizeCandidates(candidates: ReviewerCandidates): ReviewerCandidates {
  const contentReviewersTech =
    candidates.contentReviewersTech ?? candidates.contentReviewersA ?? [];
  const contentReviewersManagement =
    candidates.contentReviewersManagement ?? candidates.contentReviewersB ?? [];
  const contentReviewersNetwork =
    candidates.contentReviewersNetwork ?? candidates.contentReviewersC ?? [];

  return {
    ...candidates,
    contentReviewersTech,
    contentReviewersManagement,
    contentReviewersNetwork,
    contentReviewersA: contentReviewersTech,
    contentReviewersB: contentReviewersManagement,
    contentReviewersC: contentReviewersNetwork
  };
}

export async function fetchOnSiteAssessments(): Promise<OnSiteAssessmentRecord[]> {
  const response = await apiClient.get<ApiResponse<OnSiteAssessmentRecord[]>>("/on-site-assessments");
  return response.data.data.map(normalizeAssessmentRecord);
}

export async function fetchOnSiteAssessmentDetail(
  projectId: number
): Promise<OnSiteAssessmentRecord> {
  const response = await apiClient.get<ApiResponse<OnSiteAssessmentRecord>>(
    `/on-site-assessments/${projectId}`
  );
  return normalizeAssessmentRecord(response.data.data);
}

export async function fetchOnSiteAssessmentCandidates(): Promise<string[]> {
  const response = await apiClient.get<ApiResponse<string[]>>("/on-site-assessments/candidates");
  return response.data.data;
}

export async function fetchOnSiteAssessmentReviewerCandidates(): Promise<ReviewerCandidates> {
  const response = await apiClient.get<ApiResponse<ReviewerCandidates>>(
    "/on-site-assessments/reviewer-candidates"
  );
  return normalizeCandidates(response.data.data);
}

export async function saveOnSiteAssessment(
  projectId: number,
  payload: OnSiteAssessmentPayload
): Promise<OnSiteAssessmentRecord> {
  const response = await apiClient.put<ApiResponse<OnSiteAssessmentRecord>>(
    `/on-site-assessments/${projectId}`,
    payload
  );
  return normalizeAssessmentRecord(response.data.data);
}

export async function saveOnSiteReviewAssignment(
  projectId: number,
  payload: ReviewAssignmentPayload
): Promise<OnSiteAssessmentRecord> {
  const response = await apiClient.put<ApiResponse<OnSiteAssessmentRecord>>(
    `/on-site-assessments/${projectId}/review-assignment`,
    payload
  );
  return normalizeAssessmentRecord(response.data.data);
}

export async function submitOnSiteAssessment(projectId: number): Promise<OnSiteAssessmentRecord> {
  const response = await apiClient.post<ApiResponse<OnSiteAssessmentRecord>>(
    `/on-site-assessments/${projectId}/submit`
  );
  return normalizeAssessmentRecord(response.data.data);
}
