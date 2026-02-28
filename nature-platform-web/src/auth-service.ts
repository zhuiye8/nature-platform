/**
 * @input apiClient and ApiResponse from local HTTP layer
 * @output login(), fetchCurrentUser(), fetchDingTalkLoginUrl() auth service functions with role/resource/menu profile contracts
 * @position Frontend application service layer for authentication and RBAC bootstrap API calls
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { apiClient, type ApiResponse } from "./api";

export interface LoginResponse {
  token: string;
  username: string;
  mustChangePassword: boolean;
}

export interface MenuTreeNode {
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
  children: MenuTreeNode[];
}

export interface CurrentUser {
  username: string;
  displayName: string;
  roles: string[];
  resources: string[];
  permissions: string[];
  menuTree: MenuTreeNode[];
  timezone: string;
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const response = await apiClient.post<ApiResponse<LoginResponse>>("/auth/login", {
    username,
    password
  });
  return response.data.data;
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  const response = await apiClient.get<ApiResponse<CurrentUser>>("/auth/me");
  return response.data.data;
}

export async function fetchDingTalkLoginUrl(): Promise<string> {
  const response = await apiClient.get<ApiResponse<{ url: string }>>("/auth/dingtalk/url");
  return response.data.data.url;
}
