/**
 * @input Axios client; auth store for bearer token injection; router for auth redirects
 * @output apiClient instance and typed ApiResponse contract for backend communication
 * @position HTTP infrastructure layer centralizing request headers and 401/403 interception
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import axios from "axios";
import { ElMessage } from "element-plus";
import { useAuthStore } from "./auth-store";
import { router } from "./router";

export interface ApiResponse<T> {
  code: string;
  message: string;
  data: T;
  traceId: string;
  timestamp: string;
}

export const apiClient = axios.create({
  baseURL: "/api/v1",
  timeout: 15000
});

interface ErrorControlConfig {
  skipGlobalError?: boolean;
}

apiClient.interceptors.request.use((config) => {
  const authStore = useAuthStore();
  if (authStore.token) {
    config.headers.Authorization = `Bearer ${authStore.token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const message = (error?.response?.data?.message as string | undefined)?.trim();
    const skipGlobalError = Boolean((error?.config as ErrorControlConfig | undefined)?.skipGlobalError);
    if (status === 401) {
      const authStore = useAuthStore();
      authStore.clearSession();
      router.push("/login");
    } else if (status === 403 && !skipGlobalError) {
      ElMessage.error(message || "当前账号无权限执行该操作");
    }
    return Promise.reject(error);
  }
);
