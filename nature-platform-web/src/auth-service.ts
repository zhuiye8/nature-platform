/**
 * @input apiClient and ApiResponse from local HTTP layer
 * @output login(), fetchCurrentUser(), fetchDingTalkLoginUrl() auth service functions
 * @position Frontend application service layer for authentication-related API calls
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { apiClient, type ApiResponse } from "./api";

export interface LoginResponse {
  token: string;
  username: string;
  mustChangePassword: boolean;
}

export interface CurrentUser {
  username: string;
  displayName: string;
  roles: string[];
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

