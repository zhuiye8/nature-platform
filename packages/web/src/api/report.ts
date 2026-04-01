import request from './request'

export interface ReportProject {
  id: number
  applicationName: string
  contractYear: number
  status: string
  compiledBy: number | null
  compiledAt: string | null
  compilerName: string | null
  createdAt: string
}

export interface ReportDetail {
  instanceId: number
  currentNode: string
  status: string
  compiledBy: number | null
  compiledAt: string | null
  compilerName: string | null
  reviewTasks: Array<{
    id: number
    assigneeId: number | null
    assigneeName: string | null
    status: string
    result: string | null
    remark: string | null
    completedAt: string | null
  }>
}

export const getReportPage = (params: Record<string, any>) =>
  request.get('/report/page', { params })

export const getReportDetail = (projectRegisterId: number): Promise<ReportDetail> =>
  request.get(`/report/${projectRegisterId}`) as any

export const submitReport = (data: { projectRegisterId: number; remark?: string }) =>
  request.post('/report/submit', data)
