/**
 * @input apiClient and ApiResponse from local HTTP infrastructure
 * @output Contract submission/archive split API wrappers and contract domain types (including canViewDetail visibility flag)
 * @position Frontend contract service layer encapsulating contract lifecycle REST contracts
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { apiClient, type ApiResponse } from "./api";

export interface ContractSystemItemPayload {
  systemLevel: number;
  systemName: string;
}

export interface ContractRecord {
  id: number;
  customerId: number;
  customerName: string;
  projectName: string;
  contractName?: string;
  contractNo?: string;
  reviewStatus: string;
  archiveStatus: string;
  canViewDetail?: boolean;
  createdBy: string;
  createdAt: string;
  serviceYears: number[];
  systemItems: ContractSystemItemPayload[];
  contactName?: string;
  mobilePhone?: string;
  paymentCompany?: string;
  paymentAmount?: number;
  paymentMethod?: string;
  partnerName?: string;
  salesPerson?: string;
  performanceCity?: string;
  dealStatus?: string;
  remark?: string;
  contractType?: string;
  contractFileObjectKey?: string;
  serviceYearDetail?: string;
  paymentStatus?: string;
}

export interface ContractPayload {
  customerId: number;
  projectName: string;
  contactName?: string;
  mobilePhone?: string;
  paymentCompany?: string;
  paymentAmount?: number;
  paymentMethod?: string;
  partnerName?: string;
  salesPerson?: string;
  performanceCity?: string;
  dealStatus?: string;
  remark?: string;
  contractType?: string;
  contractFileObjectKey?: string;
  serviceYearDetail?: string;
  paymentStatus?: string;
  serviceYears: number[];
  systemItems: ContractSystemItemPayload[];
}

export interface ContractArchivePayload {
  signedAt?: string;
  fileCount?: number;
  storageLocation?: string;
  remark?: string;
  archiveScanObjectKey?: string;
}

export interface ContractProjectNameSuggestionResponse {
  items: string[];
  exactExists: boolean;
}

export async function fetchContracts(): Promise<ContractRecord[]> {
  const response = await apiClient.get<ApiResponse<ContractRecord[]>>("/contracts");
  return response.data.data;
}

export async function fetchContractSubmissionList(): Promise<ContractRecord[]> {
  const response = await apiClient.get<ApiResponse<ContractRecord[]>>("/contracts");
  return response.data.data;
}

export async function fetchContractArchiveList(): Promise<ContractRecord[]> {
  const response = await apiClient.get<ApiResponse<ContractRecord[]>>("/contracts/archive-list");
  return response.data.data;
}

export async function fetchContractDetail(id: number): Promise<ContractRecord> {
  const response = await apiClient.get<ApiResponse<ContractRecord>>(`/contracts/${id}`);
  return response.data.data;
}

export async function fetchContractProjectNameSuggestions(
  keyword: string,
  limit = 5
): Promise<ContractProjectNameSuggestionResponse> {
  const response = await apiClient.get<ApiResponse<ContractProjectNameSuggestionResponse>>(
    "/contracts/project-name-suggestions",
    {
      params: { keyword, limit }
    }
  );
  return response.data.data;
}

export async function createContract(payload: ContractPayload): Promise<number> {
  const response = await apiClient.post<ApiResponse<{ id: number }>>("/contracts", payload);
  return response.data.data.id;
}

export async function updateContract(id: number, payload: ContractPayload): Promise<ContractRecord> {
  const response = await apiClient.put<ApiResponse<ContractRecord>>(`/contracts/${id}`, payload);
  return response.data.data;
}

export async function deleteContract(id: number): Promise<void> {
  await apiClient.delete(`/contracts/${id}`);
}

export async function submitContractReview(id: number): Promise<void> {
  await apiClient.post(`/contracts/${id}/submit-review`);
}

export async function archiveContract(id: number, payload: ContractArchivePayload): Promise<void> {
  await apiClient.post(`/contracts/${id}/archive`, payload);
}
