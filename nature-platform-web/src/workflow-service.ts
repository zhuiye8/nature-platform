/**
 * @input apiClient and ApiResponse from local HTTP infrastructure layer
 * @output Workflow task query/action helpers (including displayStatus) and contract/project review-detail fetch API functions
 * @position Frontend workflow service layer encapsulating task-center REST contracts
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { apiClient, type ApiResponse } from "./api";

export interface WorkflowTask {
  taskId: string;
  taskType:
    | "CONTRACT"
    | "PROJECT_REGISTER"
    | "REPORT_TECH_REVIEW"
    | "REPORT_CONTENT_REVIEW"
    | "REPORT_FINAL_REVIEW"
    | string;
  bizId: number;
  bizTitle: string;
  status: string;
  displayStatus?: string;
  submittedBy: string;
  submittedAt: string;
  processDefinitionKey?: string;
  currentNode?: string;
  processInstanceId?: string;
}

export interface ContractDetail {
  id: number;
  customerId: number;
  customerName: string;
  projectName: string;
  contractName: string;
  contractNo: string;
  reviewStatus: string;
  archiveStatus: string;
  createdBy: string;
  createdAt: string;
  remark: string;
  serviceYears: number[];
  contractFileObjectKey?: string;
}

export interface ProjectRegisterDetail {
  id: number;
  contractId: number;
  contractYear: number;
  contractName: string;
  applicationName: string;
  status: string;
  createdBy: string;
  createdAt: string;
}

export interface TodoQuery {
  type?: string;
  keyword?: string;
}

export async function fetchTodoTasks(query: TodoQuery = {}): Promise<WorkflowTask[]> {
  const response = await apiClient.get<ApiResponse<WorkflowTask[]>>("/workflow/tasks/todo", {
    params: query,
    skipGlobalError: true
  } as any);
  return response.data.data;
}

export async function approveTask(taskId: string): Promise<void> {
  await apiClient.post(`/workflow/tasks/${encodeURIComponent(taskId)}/approve`);
}

export async function rejectTask(taskId: string, remark: string): Promise<void> {
  await apiClient.post(`/workflow/tasks/${encodeURIComponent(taskId)}/reject`, { remark });
}

export async function fetchContractDetail(id: number): Promise<ContractDetail> {
  const response = await apiClient.get<ApiResponse<ContractDetail>>(`/contracts/${id}`);
  return response.data.data;
}

export async function fetchContractReviewDetail(id: number): Promise<ContractDetail> {
  const response = await apiClient.get<ApiResponse<ContractDetail>>(
    `/workflow/tasks/contracts/${id}/detail`
  );
  return response.data.data;
}

export async function fetchProjectRegisterDetail(id: number): Promise<ProjectRegisterDetail> {
  const response = await apiClient.get<ApiResponse<ProjectRegisterDetail>>(
    `/project-registers/${id}`
  );
  return response.data.data;
}
