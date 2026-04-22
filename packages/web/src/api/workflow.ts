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

/** wf_instance 单行（getInstanceDetail 返回的 instance 字段） */
export interface WfInstanceRow {
  id: number
  definitionId: number
  bizType: string
  bizId: number
  currentNode: string
  status: string
  roundNo: number
  startedBy: number
  startedAt: string
  finishedAt: string | null
  variables: unknown
  updatedAt: string
}

/** wf_task 原始行（不含 nodeName，与 TaskItem 列表视图不同） */
export interface WfTaskRow {
  id: number
  instanceId: number
  nodeKey: string
  slotKey: string | null
  assigneeId: number | null
  status: string
  result: string | null
  remark: string | null
  formData: unknown
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

/** wf_action_log 原始行 */
export interface WfActionLogRow {
  id: number
  instanceId: number
  taskId: number | null
  nodeKey: string
  action: string
  fromNode: string | null
  toNode: string | null
  operatorId: number
  /**
   * 操作人显示名 —— 目前后端 getInstanceDetail 未 join user 表填充此字段，
   * 所以前端渲染时用 `operatorName || '系统'` fallback。保留可选以匹配运行时实际。
   */
  operatorName?: string
  remark: string | null
  createdAt: string
}

/** getTaskDetail 返回：wf_task 单行 + nodeName + 实例上下文（含该实例全部 tasks / logs） */
export interface WfTaskDetail extends WfTaskRow {
  nodeName: string
  instance: {
    instance: WfInstanceRow
    tasks: WfTaskRow[]
    logs: WfActionLogRow[]
  }
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
  return request.get<WfTaskDetail>(`/workflow/task/${taskId}`)
}

export function getInstanceByBiz(bizType: string, bizId: number) {
  return request.get<InstanceDetail>(`/workflow/instance/biz/${bizType}/${bizId}`)
}
