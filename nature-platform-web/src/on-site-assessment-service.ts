/**
 * @input apiClient and ApiResponse from shared HTTP infrastructure
 * @output Node-8 on-site assessment list/detail/save/submit API wrappers with rectification metadata
 * @position Frontend service layer for on-site assessment stage with ZIP package contract and rectification context
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { apiClient, type ApiResponse } from "./api";

export interface OnSiteAssessmentRecord {
  id?: number;
  projectRegisterId: number;
  applicationName: string;
  projectStatus: string;
  status: string;
  evidenceFiles: string[];
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
  assessmentRemark?: string;
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
  evidenceFiles?: string[];
  packageObjectKey?: string;
  assessmentDetail?: string;
  assessmentRemark?: string;
}

export type OnSiteAssessmentMode = "execution" | "result";

function normalizeAssessmentRecord(record: OnSiteAssessmentRecord): OnSiteAssessmentRecord {
  const contentReviewerTech = record.contentReviewerTech ?? record.contentReviewerA;
  const contentReviewerManagement =
    record.contentReviewerManagement ?? record.contentReviewerB;
  const contentReviewerNetwork = record.contentReviewerNetwork ?? record.contentReviewerC;

  return {
    ...record,
    evidenceFiles: Array.isArray(record.evidenceFiles) ? record.evidenceFiles : [],
    contentReviewerTech,
    contentReviewerManagement,
    contentReviewerNetwork,
    contentReviewerA: contentReviewerTech,
    contentReviewerB: contentReviewerManagement,
    contentReviewerC: contentReviewerNetwork
  };
}

export async function fetchOnSiteAssessments(
  mode: OnSiteAssessmentMode = "result"
): Promise<OnSiteAssessmentRecord[]> {
  const path =
    mode === "execution"
      ? "/on-site-assessments/executions"
      : "/on-site-assessments/results";
  const response = await apiClient.get<ApiResponse<OnSiteAssessmentRecord[]>>(path);
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

export async function submitOnSiteAssessment(projectId: number): Promise<OnSiteAssessmentRecord> {
  const response = await apiClient.post<ApiResponse<OnSiteAssessmentRecord>>(
    `/on-site-assessments/${projectId}/submit`
  );
  return normalizeAssessmentRecord(response.data.data);
}
