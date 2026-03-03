/**
 * @input apiClient and ApiResponse contracts from local HTTP infrastructure
 * @output Admin IAM/workflow/audit API wrappers and typed DTOs including role-resource/resource-catalog contracts
 * @position Frontend admin service layer encapsulating management-domain REST operations
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { apiClient, type ApiResponse } from "./api";

export interface AdminUserRecord {
  username: string;
  displayName: string;
  enabled: boolean;
  sourceType: string;
  deptId?: number;
  deptName?: string;
  dingUserId?: string;
  roles: string[];
}

export interface AdminUserCreatePayload {
  username: string;
  displayName: string;
  password: string;
  enabled: boolean;
  deptId?: number;
  roles: string[];
}

export interface AdminUserUpdatePayload {
  displayName: string;
  password?: string;
  enabled: boolean;
  deptId?: number;
  roles: string[];
}

export interface AdminRoleRecord {
  roleCode: string;
  roleName: string;
  description?: string;
  systemFlag: boolean;
  enabled: boolean;
  dataScope: "SELF" | "DEPT" | "DEPT_AND_SUB" | "CUSTOM" | "ALL";
  projectViewAll: boolean;
  peerSalesLimited: boolean;
  dataScopeDeptIds: number[];
  resourceKeys: string[];
  permissionCodes?: string[];
}

export interface AdminRoleUserOptionRecord {
  username: string;
  displayName: string;
  enabled: boolean;
  deptId?: number;
  deptName?: string;
}

export interface AdminRoleUpsertPayload {
  roleCode?: string;
  roleName: string;
  description?: string;
  enabled: boolean;
  dataScope: "SELF" | "DEPT" | "DEPT_AND_SUB" | "CUSTOM" | "ALL";
  projectViewAll: boolean;
  peerSalesLimited: boolean;
  dataScopeDeptIds: number[];
  resourceKeys: string[];
}

export interface AdminDepartmentRecord {
  id: number;
  deptCode: string;
  deptName: string;
  parentId?: number;
  parentName?: string;
  sourceType: "LOCAL" | "DINGTALK";
  dingDeptId?: string;
  defaultRoleCode?: string;
  defaultRoleName?: string;
  enabled: boolean;
  sortOrder: number;
  children: AdminDepartmentRecord[];
}

export interface AdminDepartmentUpsertPayload {
  deptCode: string;
  deptName: string;
  parentId?: number;
  enabled: boolean;
  sortOrder: number;
  defaultRoleCode?: string;
}

export interface AdminDingTalkSyncResult {
  departmentTotal: number;
  departmentInserted: number;
  departmentUpdated: number;
  userTotal: number;
  userInserted: number;
  userUpdated: number;
  userDisabled: number;
}

export interface AdminResourceRecord {
  resourceKey: string;
  resourceName: string;
  resourceType: "GROUP" | "PAGE";
  parentKey?: string;
  routePath?: string;
  icon?: string;
  sortOrder: number;
  enabled: boolean;
  builtIn: boolean;
  description?: string;
  children: AdminResourceRecord[];
}

export interface AdminResourceCreatePayload {
  resourceKey: string;
  resourceName: string;
  resourceType: "GROUP" | "PAGE";
  parentKey?: string;
  routePath?: string;
  icon?: string;
  sortOrder?: number;
  enabled?: boolean;
  description?: string;
}

export interface AdminResourceUpdatePayload {
  resourceName: string;
  resourceType: "GROUP" | "PAGE";
  parentKey?: string;
  routePath?: string;
  icon?: string;
  sortOrder?: number;
  enabled?: boolean;
  description?: string;
}

export interface AdminPermissionRecord {
  permissionCode: string;
  permissionName: string;
  category: string;
  description?: string;
  enabled: boolean;
  builtIn: boolean;
}

export interface AdminPermissionCreatePayload {
  permissionCode: string;
  permissionName: string;
  category: string;
  description?: string;
  enabled: boolean;
}

export interface AdminPermissionUpdatePayload {
  permissionName: string;
  category: string;
  description?: string;
  enabled: boolean;
}

export interface AdminPermissionSyncResult {
  inserted: number;
  updated: number;
  superAdminGrantCount: number;
  reviewerGrantCount: number;
}

export interface WorkflowDefinitionRecord {
  nodeKey: string;
  nodeName: string;
  nodeOrder: number;
  stage: string;
  enabled: boolean;
  description?: string;
}

export interface WorkflowDefinitionUpsertPayload {
  nodeName: string;
  nodeOrder: number;
  stage: string;
  enabled: boolean;
  description?: string;
}

export interface WorkflowNodeRuleItemRecord {
  slotKey: string;
  slotLabel: string;
  roleCode: string;
  requiredFlag: boolean;
  minCount: number;
  maxCount: number;
  sortOrder: number;
}

export interface WorkflowNodeRuleRecord {
  nodeKey: string;
  ruleName: string;
  enabled: boolean;
  updatedBy?: string;
  updatedAt?: string;
  items: WorkflowNodeRuleItemRecord[];
}

export interface WorkflowNodeRuleUpsertPayload {
  ruleName: string;
  enabled: boolean;
  items: WorkflowNodeRuleItemRecord[];
}

export interface AdminAuditLogRecord {
  id: number;
  operator: string;
  actionType: string;
  targetType: string;
  targetId: string;
  detailJson?: string;
  createdAt: string;
}

function normalizeRoleRecord(row: AdminRoleRecord): AdminRoleRecord {
  const resourceKeys = Array.isArray(row.resourceKeys)
    ? row.resourceKeys
    : Array.isArray(row.permissionCodes)
      ? row.permissionCodes
      : [];
  const dataScope = row.dataScope || "SELF";
  const projectViewAll = Boolean(row.projectViewAll);
  const peerSalesLimited = Boolean((row as { peerSalesLimited?: boolean }).peerSalesLimited);
  const dataScopeDeptIds = Array.isArray(row.dataScopeDeptIds) ? row.dataScopeDeptIds : [];
  return {
    ...row,
    dataScope,
    projectViewAll,
    peerSalesLimited,
    dataScopeDeptIds,
    resourceKeys,
    permissionCodes: resourceKeys
  };
}

export async function fetchAdminUsers(): Promise<AdminUserRecord[]> {
  const response = await apiClient.get<ApiResponse<AdminUserRecord[]>>("/admin/users");
  return response.data.data;
}

export async function createAdminUser(payload: AdminUserCreatePayload): Promise<AdminUserRecord> {
  const response = await apiClient.post<ApiResponse<AdminUserRecord>>("/admin/users", payload);
  return response.data.data;
}

export async function updateAdminUser(
  username: string,
  payload: AdminUserUpdatePayload
): Promise<AdminUserRecord> {
  const response = await apiClient.put<ApiResponse<AdminUserRecord>>(`/admin/users/${username}`, payload);
  return response.data.data;
}

export async function fetchAdminUserRoleCodes(): Promise<string[]> {
  const response = await apiClient.get<ApiResponse<string[]>>("/admin/users/role-codes");
  return response.data.data;
}

export async function fetchAdminRoles(): Promise<AdminRoleRecord[]> {
  const response = await apiClient.get<ApiResponse<AdminRoleRecord[]>>("/admin/roles");
  return response.data.data.map(normalizeRoleRecord);
}

export async function fetchAdminRoleUsers(roleCode: string): Promise<string[]> {
  const response = await apiClient.get<ApiResponse<string[]>>(`/admin/roles/${roleCode}/users`);
  return response.data.data;
}

export async function fetchAdminRoleUserOptions(): Promise<AdminRoleUserOptionRecord[]> {
  const response = await apiClient.get<ApiResponse<AdminRoleUserOptionRecord[]>>("/admin/roles/user-options");
  return response.data.data;
}

export async function updateAdminRoleUsers(roleCode: string, usernames: string[]): Promise<string[]> {
  const response = await apiClient.put<ApiResponse<string[]>>(`/admin/roles/${roleCode}/users`, { usernames });
  return response.data.data;
}

export async function fetchAdminDepartments(): Promise<AdminDepartmentRecord[]> {
  const response = await apiClient.get<ApiResponse<AdminDepartmentRecord[]>>("/admin/departments");
  return response.data.data;
}

export async function fetchAdminDepartmentTree(): Promise<AdminDepartmentRecord[]> {
  const response = await apiClient.get<ApiResponse<AdminDepartmentRecord[]>>("/admin/departments/tree");
  return response.data.data;
}

export async function createAdminDepartment(
  payload: AdminDepartmentUpsertPayload
): Promise<AdminDepartmentRecord> {
  const response = await apiClient.post<ApiResponse<AdminDepartmentRecord>>("/admin/departments", payload);
  return response.data.data;
}

export async function updateAdminDepartment(
  id: number,
  payload: AdminDepartmentUpsertPayload
): Promise<AdminDepartmentRecord> {
  const response = await apiClient.put<ApiResponse<AdminDepartmentRecord>>(`/admin/departments/${id}`, payload);
  return response.data.data;
}

export async function syncAdminDingTalkOrg(): Promise<AdminDingTalkSyncResult> {
  const response = await apiClient.post<ApiResponse<AdminDingTalkSyncResult>>("/admin/dingtalk/sync");
  return response.data.data;
}

export async function createAdminRole(payload: AdminRoleUpsertPayload): Promise<AdminRoleRecord> {
  const response = await apiClient.post<ApiResponse<AdminRoleRecord>>("/admin/roles", {
    ...payload,
    permissionCodes: payload.resourceKeys,
    resourceKeys: payload.resourceKeys
  });
  return normalizeRoleRecord(response.data.data);
}

export async function updateAdminRole(
  roleCode: string,
  payload: AdminRoleUpsertPayload
): Promise<AdminRoleRecord> {
  const response = await apiClient.put<ApiResponse<AdminRoleRecord>>(`/admin/roles/${roleCode}`, {
    ...payload,
    permissionCodes: payload.resourceKeys,
    resourceKeys: payload.resourceKeys
  });
  return normalizeRoleRecord(response.data.data);
}

export async function deleteAdminRole(roleCode: string): Promise<void> {
  await apiClient.delete(`/admin/roles/${roleCode}`);
}

export async function fetchAdminResources(params?: {
  keyword?: string;
  resourceType?: "GROUP" | "PAGE";
  enabled?: boolean;
}): Promise<AdminResourceRecord[]> {
  const response = await apiClient.get<ApiResponse<AdminResourceRecord[]>>("/admin/resources", {
    params
  });
  return response.data.data;
}

export async function fetchAdminResourceTree(params?: {
  mine?: boolean;
  enabledOnly?: boolean;
}): Promise<AdminResourceRecord[]> {
  const response = await apiClient.get<ApiResponse<AdminResourceRecord[]>>("/admin/resources/tree", {
    params
  });
  return response.data.data;
}

export async function createAdminResource(
  payload: AdminResourceCreatePayload
): Promise<AdminResourceRecord> {
  const response = await apiClient.post<ApiResponse<AdminResourceRecord>>("/admin/resources", payload);
  return response.data.data;
}

export async function updateAdminResource(
  resourceKey: string,
  payload: AdminResourceUpdatePayload
): Promise<AdminResourceRecord> {
  const response = await apiClient.put<ApiResponse<AdminResourceRecord>>(
    `/admin/resources/${resourceKey}`,
    payload
  );
  return response.data.data;
}

export async function deleteAdminResource(resourceKey: string): Promise<void> {
  await apiClient.delete(`/admin/resources/${resourceKey}`);
}

export async function fetchRoleResourceKeys(roleCode: string): Promise<string[]> {
  const response = await apiClient.get<ApiResponse<string[]>>(`/admin/resources/role/${roleCode}`);
  return response.data.data;
}

export async function updateRoleResourceKeys(roleCode: string, resourceKeys: string[]): Promise<string[]> {
  const response = await apiClient.put<ApiResponse<string[]>>(`/admin/resources/role/${roleCode}`, {
    resourceKeys
  });
  return response.data.data;
}

export async function fetchAdminPermissions(params?: {
  category?: string;
  keyword?: string;
  enabled?: boolean;
}): Promise<AdminPermissionRecord[]> {
  const response = await apiClient.get<ApiResponse<AdminPermissionRecord[]>>("/admin/permissions", {
    params
  });
  return response.data.data;
}

export async function createAdminPermission(
  payload: AdminPermissionCreatePayload
): Promise<AdminPermissionRecord> {
  const response = await apiClient.post<ApiResponse<AdminPermissionRecord>>("/admin/permissions", payload);
  return response.data.data;
}

export async function updateAdminPermission(
  permissionCode: string,
  payload: AdminPermissionUpdatePayload
): Promise<AdminPermissionRecord> {
  const response = await apiClient.put<ApiResponse<AdminPermissionRecord>>(
    `/admin/permissions/${permissionCode}`,
    payload
  );
  return response.data.data;
}

export async function deleteAdminPermission(permissionCode: string): Promise<void> {
  await apiClient.delete(`/admin/permissions/${permissionCode}`);
}

export async function syncAdminPermissions(
  overwriteText = false
): Promise<AdminPermissionSyncResult> {
  const response = await apiClient.post<ApiResponse<AdminPermissionSyncResult>>(
    "/admin/permissions/sync",
    null,
    { params: { overwriteText } }
  );
  return response.data.data;
}

export async function fetchWorkflowDefinitions(): Promise<WorkflowDefinitionRecord[]> {
  const response = await apiClient.get<ApiResponse<WorkflowDefinitionRecord[]>>("/admin/workflow/definitions");
  return response.data.data;
}

export async function upsertWorkflowDefinition(
  nodeKey: string,
  payload: WorkflowDefinitionUpsertPayload
): Promise<WorkflowDefinitionRecord> {
  const response = await apiClient.put<ApiResponse<WorkflowDefinitionRecord>>(
    `/admin/workflow/definitions/${nodeKey}`,
    payload
  );
  return response.data.data;
}

export async function fetchWorkflowNodeRules(): Promise<WorkflowNodeRuleRecord[]> {
  const response = await apiClient.get<ApiResponse<WorkflowNodeRuleRecord[]>>("/admin/workflow/node-rules");
  return response.data.data;
}

export async function fetchWorkflowNodeRule(nodeKey: string): Promise<WorkflowNodeRuleRecord> {
  const response = await apiClient.get<ApiResponse<WorkflowNodeRuleRecord>>(`/admin/workflow/node-rules/${nodeKey}`);
  return response.data.data;
}

export async function upsertWorkflowNodeRule(
  nodeKey: string,
  payload: WorkflowNodeRuleUpsertPayload
): Promise<WorkflowNodeRuleRecord> {
  const response = await apiClient.put<ApiResponse<WorkflowNodeRuleRecord>>(
    `/admin/workflow/node-rules/${nodeKey}`,
    payload
  );
  return response.data.data;
}

export async function fetchWorkflowRoleCodes(): Promise<string[]> {
  const response = await apiClient.get<ApiResponse<string[]>>("/admin/workflow/role-codes");
  return response.data.data;
}

export async function fetchAdminAuditLogs(params: {
  actionType?: string;
  operator?: string;
  targetType?: string;
  limit?: number;
}): Promise<AdminAuditLogRecord[]> {
  const response = await apiClient.get<ApiResponse<AdminAuditLogRecord[]>>("/admin/audit-logs", {
    params
  });
  return response.data.data;
}
