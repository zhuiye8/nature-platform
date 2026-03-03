/**
 * @input apiClient and ApiResponse from shared HTTP infrastructure
 * @output Node-7 police-register list/detail/save/submit API wrappers and types
 * @position Frontend service layer for police registration stage workflows
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { apiClient, type ApiResponse } from "./api";

export interface PoliceRegisterRecord {
  id?: number;
  projectRegisterId: number;
  applicationName: string;
  projectStatus: string;
  status: string;
  registerNo?: string;
  filingAgency?: string;
  contactName?: string;
  contactPhone?: string;
  projectManagerUsername?: string;
  projectManagerDisplayName?: string;
  remark?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  workflowNode?: string;
  workflowStatus?: string;
}

export interface PoliceRegisterPayload {
  registerNo?: string;
  filingAgency?: string;
  contactName?: string;
  contactPhone?: string;
  projectManagerUsername?: string;
  remark?: string;
}

export async function fetchPoliceRegisterProjectManagers(): Promise<string[]> {
  const response = await apiClient.get<ApiResponse<string[]>>("/police-registers/project-managers");
  return response.data.data;
}

export async function fetchPoliceRegisters(): Promise<PoliceRegisterRecord[]> {
  const response = await apiClient.get<ApiResponse<PoliceRegisterRecord[]>>("/police-registers");
  return response.data.data;
}

export async function fetchPoliceRegisterDetail(projectId: number): Promise<PoliceRegisterRecord> {
  const response = await apiClient.get<ApiResponse<PoliceRegisterRecord>>(
    `/police-registers/${projectId}`
  );
  return response.data.data;
}

export async function savePoliceRegister(
  projectId: number,
  payload: PoliceRegisterPayload
): Promise<PoliceRegisterRecord> {
  const response = await apiClient.put<ApiResponse<PoliceRegisterRecord>>(
    `/police-registers/${projectId}`,
    payload
  );
  return response.data.data;
}

export async function submitPoliceRegister(projectId: number): Promise<PoliceRegisterRecord> {
  const response = await apiClient.post<ApiResponse<PoliceRegisterRecord>>(
    `/police-registers/${projectId}/submit`
  );
  return response.data.data;
}
