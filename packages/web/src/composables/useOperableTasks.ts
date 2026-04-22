import { computed, ref, type Ref } from 'vue'
import { getMyTasks, type TaskItem } from '@/api/workflow'

/**
 * 全局共享的"我的待办任务"缓存。
 *
 * 设计目标：
 * - 一次 getMyTasks() API 调用,供所有列表/详情页共享
 * - 列表行"操作按钮"、详情页"操作模式"判定、TaskDetail.canOperate 全部统一
 * - 操作成功后调用 refresh() 刷新缓存,避免按钮/模式滞后
 *
 * 权限判定约定：
 * - 一个任务出现在用户的 my-tasks 中 = 用户有权操作它
 *   (后端 workflow.getMyTasks 已综合: assignee 直接匹配 + pool role 匹配 + 回避规则)
 * - 前端不再重复做角色/权限判断,以 my-tasks 为准,避免逻辑分裂
 */

// ── module-level 单例 state (所有调用方共享) ──
const _tasks: Ref<TaskItem[]> = ref([])
const _loaded = ref(false)
const _loading = ref(false)
let _firstLoadPromise: Promise<void> | null = null

async function _doFetch(): Promise<void> {
  _loading.value = true
  try {
    const data = await getMyTasks()
    _tasks.value = data ?? []
    _loaded.value = true
  } catch {
    // 静默失败: my-tasks 取不到等同于"无操作权限",所有按钮不显示
    _tasks.value = []
    _loaded.value = true
  } finally {
    _loading.value = false
  }
}

/**
 * 首次调用时触发加载；后续调用复用 promise / 缓存。
 * 这保证了多组件同时挂载也只会 fetch 一次。
 */
function ensureLoaded(): Promise<void> {
  if (_loaded.value) return Promise.resolve()
  if (_firstLoadPromise) return _firstLoadPromise
  _firstLoadPromise = _doFetch().finally(() => {
    _firstLoadPromise = null
  })
  return _firstLoadPromise
}

export function useOperableTasks() {
  // 首次用到就触发加载;调用方可通过 ref 响应式读取
  ensureLoaded()

  /**
   * 按 bizType + bizId 匹配 PENDING 任务；
   * 传 nodeKey 则额外按节点精确匹配,不传则返回任意节点的第一条。
   */
  function getTaskFor(
    bizType: string,
    bizId: number | null | undefined,
    nodeKey?: string,
  ): TaskItem | null {
    if (bizId == null) return null
    return (
      _tasks.value.find(
        (t) =>
          t.bizType === bizType &&
          t.bizId === bizId &&
          t.status === 'PENDING' &&
          (nodeKey ? t.nodeKey === nodeKey : true),
      ) ?? null
    )
  }

  function hasTaskFor(
    bizType: string,
    bizId: number | null | undefined,
    nodeKey?: string,
  ): boolean {
    return getTaskFor(bizType, bizId, nodeKey) !== null
  }

  /** 所有 my-task id 的集合,供 TaskDetail.canOperate 用 O(1) 判定 */
  const myTaskIds = computed(() => new Set(_tasks.value.map((t) => t.id)))

  /**
   * 操作成功后调用,重新拉取 my-tasks。
   * 比如: 提交归档、审核通过、提交报告 之后。
   */
  async function refresh(): Promise<void> {
    await _doFetch()
  }

  return {
    /** 响应式的任务列表(只读) */
    tasks: computed(() => _tasks.value),
    /** 是否在加载中 */
    loading: computed(() => _loading.value),
    myTaskIds,
    getTaskFor,
    hasTaskFor,
    refresh,
    ensureLoaded,
  }
}
