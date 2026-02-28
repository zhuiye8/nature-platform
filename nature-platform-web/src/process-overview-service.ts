/**
 * @input apiClient and node-stage record contracts from existing frontend service modules
 * @output Process-overview aggregate API wrapper and typed current-state snapshot model
 * @position Frontend read service for cross-node workflow detail page
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { apiClient, type ApiResponse } from "./api";
import type { MaterialArchiveRecord } from "./material-archive-service";
import type { OnSiteAssessmentRecord } from "./on-site-assessment-service";
import type { PoliceRegisterRecord } from "./police-register-service";
import type { ProjectRegisterRecord } from "./project-register-service";
import type { QualityReviewRecord } from "./quality-review-service";
import type {
  ReportCompileAssignmentRecord,
  ReportCompileSubmissionRecord
} from "./report-compile-service";
import type { ReportContentReviewRecord } from "./report-content-review-service";
import type { ReportFinalReviewRecord } from "./report-final-review-service";
import type { ReportTechReviewRecord } from "./report-tech-review-service";

export interface ProcessOverviewAttachmentItem {
  stage: string;
  field: string;
  objectKey: string;
  fileName: string;
}

export interface ProcessOverviewRecord {
  projectRegisterId: number;
  applicationName: string;
  projectStatus: string;
  workflowNode?: string;
  workflowStatus?: string;
  projectRegister: ProjectRegisterRecord;
  policeRegister?: PoliceRegisterRecord;
  onSiteAssessment?: OnSiteAssessmentRecord;
  qualityReview?: QualityReviewRecord;
  reportTechReview?: ReportTechReviewRecord;
  reportContentReview?: ReportContentReviewRecord;
  reportCompileAssignment?: ReportCompileAssignmentRecord;
  reportCompileSubmission?: ReportCompileSubmissionRecord;
  reportFinalReview?: ReportFinalReviewRecord;
  materialArchive?: MaterialArchiveRecord;
  attachments: ProcessOverviewAttachmentItem[];
}

export function toProcessOverviewPath(projectId: number): string {
  return `/process-overview/${projectId}`;
}

export async function fetchProcessOverview(projectId: number): Promise<ProcessOverviewRecord> {
  const response = await apiClient.get<ApiResponse<ProcessOverviewRecord>>(
    `/process-overview/${projectId}`
  );
  return response.data.data;
}
