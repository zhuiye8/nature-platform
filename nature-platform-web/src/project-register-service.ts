/**
 * @input apiClient and ApiResponse from local HTTP infrastructure
 * @output Project-register CRUD/review/trace API wrappers and typed domain models for registration pages
 * @position Frontend project-register service layer encapsulating project registration REST contracts
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { apiClient, type ApiResponse } from "./api";

export interface ProjectSystemItemPayload {
  systemName: string;
  filingAgency: string;
  securityLevel: string;
  reassessment: boolean;
  requiredEntryDate: string;
  requiredReportDeliveryDate: string;
  assessedUnitName: string;
  assessedUnitIndustry: string;
  assessedUnitContact: string;
  assessedUnitMobile: string;
  assessedUnitAddress: string;
  hasFilingCertificate: boolean;
  filingCertificateFiles: string[];
  filingCertificateNo?: string;
  filingCertificateIssuedAt?: string;
  hasFilingForm: boolean;
  filingFormFiles: string[];
  hasClassificationReport: boolean;
  classificationReportFiles: string[];
}

export interface ProjectRegisterRecord {
  id: number;
  contractId: number;
  contractYear: number;
  contractName: string;
  applicationName: string;
  status: string;
  workflowInstanceId?: number;
  workflowStatus?: string;
  workflowNode?: string;
  createdBy: string;
  createdAt: string;
  systemItems: ProjectSystemItemPayload[];
}

export interface ProjectRegisterPayload {
  contractId: number;
  contractYear: number;
  systemItems: ProjectSystemItemPayload[];
}

export interface WorkflowTraceRecord {
  id: number;
  instanceId: number;
  action: string;
  fromStatus?: string;
  toStatus?: string;
  workflowStatus?: string;
  workflowNode?: string;
  operator: string;
  remark?: string;
  createdAt: string;
}

export async function fetchProjectRegisters(): Promise<ProjectRegisterRecord[]> {
  const response = await apiClient.get<ApiResponse<ProjectRegisterRecord[]>>("/project-registers");
  return response.data.data;
}

export async function fetchProjectRegisterDetail(id: number): Promise<ProjectRegisterRecord> {
  const response = await apiClient.get<ApiResponse<ProjectRegisterRecord>>(`/project-registers/${id}`);
  return response.data.data;
}

export async function createProjectRegister(payload: ProjectRegisterPayload): Promise<number> {
  const response = await apiClient.post<ApiResponse<{ id: number }>>("/project-registers", payload);
  return response.data.data.id;
}

export async function updateProjectRegister(
  id: number,
  payload: ProjectRegisterPayload
): Promise<ProjectRegisterRecord> {
  const response = await apiClient.put<ApiResponse<ProjectRegisterRecord>>(
    `/project-registers/${id}`,
    payload
  );
  return response.data.data;
}

export async function deleteProjectRegister(id: number): Promise<void> {
  await apiClient.delete(`/project-registers/${id}`);
}

export async function submitProjectRegisterReview(id: number): Promise<void> {
  await apiClient.post(`/project-registers/${id}/submit-review`);
}

export async function fetchProjectRegisterTrace(id: number): Promise<WorkflowTraceRecord[]> {
  const response = await apiClient.get<ApiResponse<WorkflowTraceRecord[]>>(
    `/project-registers/${id}/workflow-trace`
  );
  return response.data.data;
}
