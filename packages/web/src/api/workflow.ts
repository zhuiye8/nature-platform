import request from './request'

export interface TaskItem {
  id: number
  instanceId: number
  nodeKey: string
  nodeName: string
  nodeType: string
  slotKey: string | null
  status: string
  bizType: string
  bizId: number
  bizName: string
  createdAt: string
}

export interface ActionLog {
  id: number
  operatorName: string
  action: string
  nodeKey?: string
  remark: string | null
  createdAt: string
}

export interface InstanceDetail {
  id: number
  bizType: string
  bizId: number
  status: string
  tasks: TaskItem[]
  actionLogs: ActionLog[]
}

export function getMyTasks() {
  return request.get<TaskItem[]>('/workflow/my-tasks')
}

export function signalTask(data: {
  instanceId: number
  taskId: number
  action: string
  remark?: string
  opinionText?: string
  attachmentIds?: number[]
  extraData?: Record<string, any>
}) {
  return request.post('/workflow/signal', data)
}

export function resubmitTask(instanceId: number) {
  return request.post(`/workflow/resubmit/${instanceId}`)
}

export function getUsersByRole(roleCode: string) {
  return request.get<{ id: number; displayName: string }[]>(`/user/by-role/${roleCode}`)
}

export function getTaskDetail(taskId: number) {
  return request.get<any>(`/workflow/task/${taskId}`)
}

export function getInstanceByBiz(bizType: string, bizId: number) {
  return request.get<InstanceDetail>(`/workflow/instance/biz/${bizType}/${bizId}`)
}
