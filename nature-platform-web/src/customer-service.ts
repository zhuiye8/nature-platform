/**
 * @input apiClient and ApiResponse from local HTTP infrastructure
 * @output Customer CRUD API wrappers and customer domain types with mandatory base fields for management pages
 * @position Frontend customer service layer encapsulating customer REST contracts
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { apiClient, type ApiResponse } from "./api";

export interface CustomerRecord {
  id: number;
  fullName: string;
  industry?: string;
  region?: string;
  addressDetail?: string;
  uscc?: string;
  contactName?: string;
  mobilePhone?: string;
  remark?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerPayload {
  fullName: string;
  industry: string;
  region: string;
  addressDetail: string;
  uscc: string;
  contactName: string;
  mobilePhone: string;
  remark?: string;
}

export async function fetchCustomers(): Promise<CustomerRecord[]> {
  const response = await apiClient.get<ApiResponse<CustomerRecord[]>>("/customers");
  return response.data.data;
}

export async function createCustomer(payload: CustomerPayload): Promise<number> {
  const response = await apiClient.post<ApiResponse<{ id: number }>>("/customers", payload);
  return response.data.data.id;
}

export async function updateCustomer(id: number, payload: CustomerPayload): Promise<CustomerRecord> {
  const response = await apiClient.put<ApiResponse<CustomerRecord>>(`/customers/${id}`, payload);
  return response.data.data;
}

export async function deleteCustomer(id: number): Promise<void> {
  await apiClient.delete(`/customers/${id}`);
}
