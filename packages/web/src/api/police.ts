import request from './request'

export interface PoliceItem {
  id: number
  projectRegisterId: number
  registerNo: string | null
  filingAgency: string | null
  contactName: string | null
  contactPhone: string | null
  projectManagerId: number
  projectManagerName: string | null
  remark: string | null
  status: string
  createdAt: string
}

export interface PoliceForm {
  projectRegisterId: number
  projectManagerId: number
  registerNo?: string
  scanFileUrl?: string
  remark?: string
}

export interface SimpleUser {
  id: number
  displayName: string
}

export const getPoliceRegisterPage = (params: Record<string, any>) =>
  request.get('/police/page', { params })

export const getPoliceRegisterDetail = (id: number) =>
  request.get(`/police/${id}`)

export const createPoliceRegister = (data: PoliceForm) =>
  request.post('/police', data)

export const updatePoliceRegister = (id: number, data: Partial<PoliceForm>) =>
  request.put(`/police/${id}`, data)

export const completePoliceRegister = (id: number) =>
  request.post(`/police/${id}/complete`)

export const getProjectManagers = (): Promise<SimpleUser[]> =>
  request.get('/police/project-managers') as any

export interface AvailableProject {
  id: number
  applicationName: string
}

export const getAvailableProjects = (): Promise<AvailableProject[]> =>
  request.get('/police/available-projects') as any
