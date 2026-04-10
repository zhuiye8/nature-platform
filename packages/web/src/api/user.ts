import request from './request'

export interface UserItem {
  id: number
  username: string
  displayName: string
  mobile: string | null
  email: string | null
  enabled: boolean
  sourceType: string
  deptId: number | null
  createdAt: string
}

export interface UserDetail extends UserItem {
  roles: string[]
}

export interface UserForm {
  username: string
  password?: string
  displayName: string
  mobile?: string
  email?: string
  deptId?: number
  enabled?: boolean
}

export interface SimpleUser {
  id: number
  username: string
  displayName: string
}

export const getUserPage = (params: Record<string, any>) =>
  request.get('/user/page', { params })

export const getUserDetail = (id: number): Promise<UserDetail> =>
  request.get(`/user/${id}`) as any

export const createUser = (data: UserForm) =>
  request.post('/user', data)

export const updateUser = (id: number, data: Partial<UserForm>) =>
  request.put(`/user/${id}`, data)

export const assignUserRoles = (id: number, roleCodes: string[]) =>
  request.put(`/user/${id}/assign-roles`, { roleCodes })

export const toggleUserEnabled = (id: number) =>
  request.put(`/user/${id}/toggle-enabled`)

export const resetUserPassword = (id: number, newPassword: string) =>
  request.put(`/user/${id}/reset-password`, { newPassword })

export const getSimpleUserList = (): Promise<SimpleUser[]> =>
  request.get('/user/simple-list') as any

export const checkUsername = (
  username: string,
  excludeId?: number,
): Promise<{ available: boolean; reason?: string }> =>
  request.get('/user/check-username', {
    params: { username, excludeId },
  }) as any
