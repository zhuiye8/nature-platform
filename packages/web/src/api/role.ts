import request from './request'

export interface RoleItem {
  id: number
  roleCode: string
  roleName: string
  description: string | null
  systemFlag: boolean
  enabled: boolean
  sortOrder: number
}

export interface RoleDetail extends RoleItem {
  permissionCodes: string[]
}

export interface RoleForm {
  roleCode: string
  roleName: string
  description?: string
}

export interface PermissionItem {
  id: number
  permissionCode: string
  permissionName: string
  category: string
  description: string | null
}

export const getRoleList = (): Promise<RoleItem[]> =>
  request.get('/role/list') as any

export const getRoleDetail = (id: number): Promise<RoleDetail> =>
  request.get(`/role/${id}`) as any

export const createRole = (data: RoleForm) =>
  request.post('/role', data)

export const updateRole = (id: number, data: Partial<RoleForm>) =>
  request.put(`/role/${id}`, data)

export const deleteRole = (id: number) =>
  request.delete(`/role/${id}`)

export const assignRolePermissions = (roleCode: string, permissionCodes: string[]) =>
  request.put(`/role/assign-permissions/${roleCode}`, { permissionCodes })

export const getAllPermissions = (): Promise<Record<string, PermissionItem[]>> =>
  request.get('/role/all-permissions') as any

// Role members
export interface RoleMember {
  userId: number
  username: string
  displayName: string
  mobile: string | null
  sortOrder: number
}

export const getRoleUsers = (roleCode: string): Promise<RoleMember[]> =>
  request.get(`/role/${roleCode}/users`) as any

export const updateRoleUsers = (roleCode: string, users: { userId: number; sortOrder: number }[]) =>
  request.put(`/role/${roleCode}/users`, { users })
