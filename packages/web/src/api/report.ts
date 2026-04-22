import request from './request'
import type { PageQuery, PageResult } from '@nature/shared'

/** 报告管理列表业务状态（与后端 ReportStatus 对齐） */
export type ReportStatus = 'PENDING' | 'REVIEWING' | 'REVISION' | 'APPROVED'

export interface ReportProject {
  id: number
  applicationName: string
  contractYear: number
  /** 项目原 status（DRAFT/SUBMITTED/APPROVED 等） —— 保留以备调试 */
  status: string
  compiledBy: number | null
  compiledAt: string | null
  compilerName: string | null
  createdAt: string
  /** 当前工作流节点（可能为 null 若 wf_instance 丢失） */
  currentNode: string | null
  /** 编制人可操作的 REPORT_COMPILE task id（点击"编制"时跳转） */
  currentTaskId: number | null
  /** 当前节点任一 PENDING/PENDING_RECTIFICATION task id（点击"查看"只读跳转） */
  viewTaskId: number | null
  /** 是否需要修改（复核退回） —— 等价于 businessStatus==='REVISION' */
  needsRevision: boolean
  /** 业务状态（用于标签展示与筛选） */
  businessStatus: ReportStatus
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

export interface ReportQuery extends PageQuery {
  keyword?: string
  status?: ReportStatus
  /** 按编制人 userId 筛选 */
  compilerId?: number
}

export const getReportPage = (params: ReportQuery) =>
  request.get<PageResult<ReportProject>>('/report/page', { params })

export const getReportDetail = (projectRegisterId: number) =>
  request.get<ReportDetail>(`/report/${projectRegisterId}`)

export const submitReport = (data: { projectRegisterId: number; remark?: string }) =>
  request.post('/report/submit', data)
