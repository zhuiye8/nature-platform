// ============================================================================
// Shared types used by server, web, and terminal packages
// ============================================================================

/** Standard API response envelope per API_CONVENTIONS.md */
export interface ApiResponse<T = unknown> {
  code: number
  data: T
  message: string
}

/** Paginated list response */
export interface PageResult<T = unknown> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

/** Paginated query parameters */
export interface PageQuery {
  page?: number
  pageSize?: number
  sort?: string
  order?: 'asc' | 'desc'
  keyword?: string
}

/** User info returned after login / from profile endpoint */
export interface UserInfo {
  id: number
  username: string
  displayName: string
  mustChangePassword?: boolean
  dingUnionId?: string | null
  mobile?: string | null
  permissions: string[]
  roles: string[]
  /** Role display names from iam_role.role_name (same order as roles[]) */
  roleNames?: string[]
}

/** Login request body */
export interface LoginRequest {
  username: string
  password: string
}

/** Login response data */
export interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: UserInfo
}
