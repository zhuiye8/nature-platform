/**
 * @input apiClient and ApiResponse from shared HTTP infrastructure
 * @output Node-8 on-site assessment list/detail/save/submit and reviewer-candidate API wrappers
 * @position Frontend service layer for on-site assessment stage with ZIP package contract
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
}

export interface OnSiteAssessmentPayload {
  packageObjectKey?: string;
  assessmentDetail?: string;
}

export interface ReviewAssignmentPayload {
  techReviewer: string;
  contentReviewerA: string;
  contentReviewerB: string;
  contentReviewerC: string;
  versionNo: number;
}

export interface ReviewerCandidates {
  techReviewers: string[];
  contentReviewersA: string[];
  contentReviewersB: string[];
  contentReviewersC: string[];
}

export async function fetchOnSiteAssessments(): Promise<OnSiteAssessmentRecord[]> {
  const response = await apiClient.get<ApiResponse<OnSiteAssessmentRecord[]>>("/on-site-assessments");
  return response.data.data;
}

export async function fetchOnSiteAssessmentDetail(
  projectId: number
): Promise<OnSiteAssessmentRecord> {
  const response = await apiClient.get<ApiResponse<OnSiteAssessmentRecord>>(
    `/on-site-assessments/${projectId}`
  );
  return response.data.data;
}

export async function fetchOnSiteAssessmentCandidates(): Promise<string[]> {
  const response = await apiClient.get<ApiResponse<string[]>>("/on-site-assessments/candidates");
  return response.data.data;
}

export async function fetchOnSiteAssessmentReviewerCandidates(): Promise<ReviewerCandidates> {
  const response = await apiClient.get<ApiResponse<ReviewerCandidates>>(
    "/on-site-assessments/reviewer-candidates"
  );
  return response.data.data;
}

export async function saveOnSiteAssessment(
  projectId: number,
  payload: OnSiteAssessmentPayload
): Promise<OnSiteAssessmentRecord> {
  const response = await apiClient.put<ApiResponse<OnSiteAssessmentRecord>>(
    `/on-site-assessments/${projectId}`,
    payload
  );
  return response.data.data;
}

export async function saveOnSiteReviewAssignment(
  projectId: number,
  payload: ReviewAssignmentPayload
): Promise<OnSiteAssessmentRecord> {
  const response = await apiClient.put<ApiResponse<OnSiteAssessmentRecord>>(
    `/on-site-assessments/${projectId}/review-assignment`,
    payload
  );
  return response.data.data;
}

export async function submitOnSiteAssessment(projectId: number): Promise<OnSiteAssessmentRecord> {
  const response = await apiClient.post<ApiResponse<OnSiteAssessmentRecord>>(
    `/on-site-assessments/${projectId}/submit`
  );
  return response.data.data;
}
