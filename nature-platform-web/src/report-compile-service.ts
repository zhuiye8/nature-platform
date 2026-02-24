/**
 * @input apiClient and ApiResponse from shared HTTP infra
 * @output Node-13/14 report-compile assignment/submission API wrappers and types
 * @position Frontend service layer for report compile assignment and upload stages
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { apiClient, type ApiResponse } from "./api";

export interface ReportCompileAssignmentRecord {
  projectRegisterId: number;
  applicationName: string;
  contentReviewStatus: string;
  onSitePackageObjectKey?: string;
  assignee?: string;
  status: string;
  versionNo: number;
  submittedAt?: string;
  workflowNode?: string;
  workflowStatus?: string;
}

export interface ReportCompileSubmissionRecord {
  projectRegisterId: number;
  applicationName: string;
  assignmentStatus: string;
  onSitePackageObjectKey?: string;
  assignee?: string;
  reportObjectKey?: string;
  reportRemark?: string;
  status: string;
  submittedBy?: string;
  submittedAt?: string;
  workflowNode?: string;
  workflowStatus?: string;
}

export interface ReportCompileAssignmentPayload {
  assignee: string;
  versionNo: number;
}

export interface ReportCompileSubmissionPayload {
  reportObjectKey?: string;
  reportRemark?: string;
}

export async function fetchReportCompileAssignments(): Promise<ReportCompileAssignmentRecord[]> {
  const response = await apiClient.get<ApiResponse<ReportCompileAssignmentRecord[]>>(
    "/report-compile-assignments"
  );
  return response.data.data;
}

export async function fetchReportCompileAssignmentDetail(
  projectId: number
): Promise<ReportCompileAssignmentRecord> {
  const response = await apiClient.get<ApiResponse<ReportCompileAssignmentRecord>>(
    `/report-compile-assignments/${projectId}`
  );
  return response.data.data;
}

export async function fetchReportCompileCandidates(): Promise<string[]> {
  const response = await apiClient.get<ApiResponse<string[]>>(
    "/report-compile-assignments/candidates"
  );
  return response.data.data;
}

export async function saveReportCompileAssignment(
  projectId: number,
  payload: ReportCompileAssignmentPayload
): Promise<ReportCompileAssignmentRecord> {
  const response = await apiClient.put<ApiResponse<ReportCompileAssignmentRecord>>(
    `/report-compile-assignments/${projectId}`,
    payload
  );
  return response.data.data;
}

export async function submitReportCompileAssignment(
  projectId: number
): Promise<ReportCompileAssignmentRecord> {
  const response = await apiClient.post<ApiResponse<ReportCompileAssignmentRecord>>(
    `/report-compile-assignments/${projectId}/submit`
  );
  return response.data.data;
}

export async function fetchReportCompileSubmissions(): Promise<ReportCompileSubmissionRecord[]> {
  const response = await apiClient.get<ApiResponse<ReportCompileSubmissionRecord[]>>(
    "/report-compile-submissions"
  );
  return response.data.data;
}

export async function fetchReportCompileSubmissionDetail(
  projectId: number
): Promise<ReportCompileSubmissionRecord> {
  const response = await apiClient.get<ApiResponse<ReportCompileSubmissionRecord>>(
    `/report-compile-submissions/${projectId}`
  );
  return response.data.data;
}

export async function saveReportCompileSubmission(
  projectId: number,
  payload: ReportCompileSubmissionPayload
): Promise<ReportCompileSubmissionRecord> {
  const response = await apiClient.put<ApiResponse<ReportCompileSubmissionRecord>>(
    `/report-compile-submissions/${projectId}`,
    payload
  );
  return response.data.data;
}

export async function submitReportCompileSubmission(
  projectId: number
): Promise<ReportCompileSubmissionRecord> {
  const response = await apiClient.post<ApiResponse<ReportCompileSubmissionRecord>>(
    `/report-compile-submissions/${projectId}/submit`
  );
  return response.data.data;
}
