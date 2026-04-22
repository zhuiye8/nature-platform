<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useOperableTasks } from '@/composables/useOperableTasks'
import type { TaskItem } from '@/api/workflow'

/**
 * 列表行的统一"操作"按钮。
 *
 * - 从 my-tasks 里查本条业务的 PENDING 任务
 * - 无任务 → 不渲染(零副作用,可放在任何列表行)
 * - 有任务 → 按节点类型显示对应文案和跳转目标
 *
 * 与"查看"按钮并列,做到:
 *   • 审核类 (REVIEW) → 跳 TaskDetail 审核页
 *   • 业务操作 → 跳各自业务详情页(该页接入 useOperableTasks 后会进入"操作模式")
 */

type ActionMeta = {
  label: string
  routeFn: (t: TaskItem) => string
  type: 'primary' | 'warning'
}

// 节点 → 按钮文案 + 跳转目标
// POLICE_REGISTER 不在表中: 公安登记靠上传文件自动推进,列表行无需按钮
const NODE_ACTION_MAP: Record<string, ActionMeta> = {
  // 审核类 → TaskDetail
  DEPT_REVIEW:     { label: '审核', routeFn: (t) => `/workflow/task/${t.id}`, type: 'primary' },
  DIRECTOR_REVIEW: { label: '审核', routeFn: (t) => `/workflow/task/${t.id}`, type: 'primary' },
  CONTRACT_REVIEW: { label: '审核', routeFn: (t) => `/workflow/task/${t.id}`, type: 'primary' },
  TECH_REVIEW:     { label: '审核', routeFn: (t) => `/workflow/task/${t.id}`, type: 'primary' },
  CONTENT_REVIEW:  { label: '审核', routeFn: (t) => `/workflow/task/${t.id}`, type: 'primary' },
  FINAL_REVIEW:    { label: '审核', routeFn: (t) => `/workflow/task/${t.id}`, type: 'primary' },
  REPORT_ASSIGN:   { label: '分配', routeFn: (t) => `/workflow/task/${t.id}`, type: 'primary' },
  // 业务操作 → 对应业务详情页(该页按操作模式展示)
  CONTRACT_ARCHIVE:   { label: '归档', routeFn: (t) => `/contract/${t.bizId}?action=archive`, type: 'warning' },
  REPORT_COMPILE:     { label: '编制', routeFn: (t) => `/report/${t.bizId}`, type: 'warning' },
  ON_SITE_ASSESSMENT: { label: '测评', routeFn: (t) => `/assessment/${t.bizId}`, type: 'warning' },
  MATERIAL_ARCHIVE:   { label: '归档', routeFn: (t) => `/archive/${t.bizId}`, type: 'warning' },
}

const props = defineProps<{
  bizType: string
  bizId: number
}>()

const router = useRouter()
const { getTaskFor } = useOperableTasks()

const task = computed(() => getTaskFor(props.bizType, props.bizId))
const meta = computed<ActionMeta | null>(() =>
  task.value ? (NODE_ACTION_MAP[task.value.nodeKey] ?? null) : null,
)

function handleClick() {
  if (!task.value || !meta.value) return
  router.push(meta.value.routeFn(task.value))
}
</script>

<template>
  <el-button
    v-if="meta"
    :type="meta.type"
    link
    size="small"
    @click="handleClick"
  >
    {{ meta.label }}
  </el-button>
</template>
