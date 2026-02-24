/**
 * @input apiClient and ApiResponse from shared HTTP infrastructure
 * @output Recycle-bin list and restore API wrappers for contract/project recovery workflows
 * @position Frontend service layer for recycle-bin operations in contract and project domains
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { apiClient, type ApiResponse } from "./api";

export type RecycleType = "CONTRACT" | "PROJECT_REGISTER";

export interface RecycleItemRecord {
  bizId: number;
  bizName: string;
  deletedBy: string;
  deletedAt: string;
  extra?: string;
}

export async function fetchContractRecycleItems(): Promise<RecycleItemRecord[]> {
  const response = await apiClient.get<ApiResponse<RecycleItemRecord[]>>("/recycle-bin/contracts");
  return response.data.data;
}

export async function fetchProjectRecycleItems(): Promise<RecycleItemRecord[]> {
  const response = await apiClient.get<ApiResponse<RecycleItemRecord[]>>(
    "/recycle-bin/project-registers"
  );
  return response.data.data;
}

export async function restoreRecycleItem(type: RecycleType, bizId: number): Promise<void> {
  await apiClient.post(`/recycle-bin/${type}/${bizId}/restore`);
}

