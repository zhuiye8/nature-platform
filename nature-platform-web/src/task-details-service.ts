/**
 * @input apiClient and node-stage record contracts from existing frontend service modules
 * @output Task-detail aggregate API wrapper and typed snapshot model for unified review detail page
 * @position Frontend read service for loading project workflow context via /task-details endpoint
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { apiClient, type ApiResponse } from "./api";
import type { MaterialArchiveRecord } from "./material-archive-service";
import type { OnSiteAssessmentRecord } from "./on-site-assessment-service";
import type { PoliceRegisterRecord } from "./police-register-service";
import type { ProjectRegisterRecord } from "./project-register-service";
import type {
  ReportCompileAssignmentRecord,
  ReportCompileSubmissionRecord
} from "./report-compile-service";
import type { ReportContentReviewRecord } from "./report-content-review-service";
import type { ReportFinalReviewRecord } from "./report-final-review-service";
import type { ReportTechReviewRecord } from "./report-tech-review-service";

export interface TaskDetailAttachmentItem {
  stage: string;
  field: string;
  objectKey: string;
  fileName: string;
}

export interface TaskDetailRecord {
  projectRegisterId: number;
  applicationName: string;
  projectStatus: string;
  workflowNode?: string;
  workflowStatus?: string;
  projectRegister: ProjectRegisterRecord;
  policeRegister?: PoliceRegisterRecord;
  onSiteAssessment?: OnSiteAssessmentRecord;
  reportTechReview?: ReportTechReviewRecord;
  reportContentReview?: ReportContentReviewRecord;
  reportCompileAssignment?: ReportCompileAssignmentRecord;
  reportCompileSubmission?: ReportCompileSubmissionRecord;
  reportFinalReview?: ReportFinalReviewRecord;
  materialArchive?: MaterialArchiveRecord;
  attachments: TaskDetailAttachmentItem[];
}

export async function fetchTaskDetail(taskType: string, bizId: number): Promise<TaskDetailRecord> {
  const response = await apiClient.get<ApiResponse<TaskDetailRecord>>(
    `/task-details/${encodeURIComponent(taskType)}/${bizId}`
  );
  return response.data.data;
}
