<script setup lang="ts">
/**
 * ReviewOpinionPanel — 审核意见展示面板
 *
 * 数据来源: workflow action log 中带 remark 的所有审核记录
 *   - APPROVE（通过）: 绿色 success
 *   - REJECT / REJECT_TO_ASSESSMENT / REJECT_TO_TECH（驳回）: 红色 error
 *   - REVIEW / REVIEW_TO_COMPILE（复核）: 黄色 warning
 *
 * 视觉:
 *   - 最新一条意见 Alert 醒目展示
 *   - 多条历史折叠在 Timeline 里
 *   - 没有 remark 的通过记录不展示（避免刷屏）
 *
 * 历史: 2026-05-08 由 RejectReasonPanel 重命名扩大语义而来
 *       原仅展示驳回/复核 → 现在通过有意见也展示
 */
import { ref, onMounted, watch, computed } from 'vue'
import { getInstanceByBiz } from '@/api/workflow'
import { getStatusLabel } from '@/utils/status-map'
import { formatTime } from '@/utils/format'

const props = defineProps<{
  bizType: string
  bizId: number
}>()

interface OpinionRecord {
  action: string
  nodeKey: string
  operatorName: string
  remark: string
  createdAt: string
}

const records = ref<OpinionRecord[]>([])
const loading = ref(false)

const latestOpinion = computed(() => records.value.length > 0 ? records.value[0] : null)

const alertType = computed<'success' | 'error' | 'warning' | 'info'>(() => {
  if (!latestOpinion.value) return 'info'
  const action = latestOpinion.value.action
  if (action === 'APPROVE') return 'success'
  if (['REJECT', 'REJECT_TO_ASSESSMENT', 'REJECT_TO_TECH'].includes(action)) return 'error'
  return 'warning'
})

const alertTitle = computed(() => {
  if (!latestOpinion.value) return ''
  const action = latestOpinion.value.action
  let label = '审核'
  if (action === 'APPROVE') label = '通过'
  else if (['REJECT', 'REJECT_TO_ASSESSMENT', 'REJECT_TO_TECH'].includes(action)) label = '驳回'
  else if (['REVIEW', 'REVIEW_TO_COMPILE'].includes(action)) label = '复核'
  return `${getStatusLabel(latestOpinion.value.nodeKey)} ${label}`
})

async function fetchData() {
  if (!props.bizId) return
  loading.value = true
  try {
    const instance = (await getInstanceByBiz(props.bizType, props.bizId)) as any
    const logs: any[] = instance?.logs || instance?.actionLogs || []
    // 过滤所有审核动作 + 必须有 remark（避免没填意见的通过记录刷屏）
    records.value = logs
      .filter((log: any) =>
        [
          'APPROVE',
          'REJECT',
          'REVIEW',
          'REJECT_TO_ASSESSMENT',
          'REJECT_TO_TECH',
          'REVIEW_TO_COMPILE',
        ].includes(log.action) && (log.remark ?? '').trim().length > 0,
      )
      .reverse()
      .map((log: any) => ({
        action: log.action,
        nodeKey: log.nodeKey || '',
        operatorName: log.operatorName || '系统',
        remark: log.remark || '',
        createdAt: log.createdAt || '',
      }))
  } catch {
    records.value = []
  } finally {
    loading.value = false
  }
}

function getActionTag(action: string) {
  if (action === 'APPROVE') return { label: '通过', type: 'success' as const }
  if (['REJECT', 'REJECT_TO_ASSESSMENT', 'REJECT_TO_TECH'].includes(action))
    return { label: '驳回', type: 'danger' as const }
  return { label: '复核', type: 'warning' as const }
}

onMounted(fetchData)
watch(() => [props.bizType, props.bizId], fetchData)

defineExpose({ refresh: fetchData })
</script>

<template>
  <div v-if="!loading && records.length > 0">
    <!-- 最新一条审核意见醒目提示 -->
    <el-alert
      v-if="latestOpinion"
      :title="alertTitle"
      :type="alertType"
      :closable="false"
      show-icon
      style="margin-bottom: 16px"
    >
      <template #default>
        <div style="font-size: 13px">
          <span style="font-weight: 500">{{ latestOpinion.operatorName }}</span>
          <span style="color: #909399; margin-left: 8px">{{ formatTime(latestOpinion.createdAt) }}</span>
        </div>
        <div v-if="latestOpinion.remark" style="margin-top: 4px; white-space: pre-wrap">{{ latestOpinion.remark }}</div>
      </template>
    </el-alert>

    <!-- 多条历史折叠展示 -->
    <el-collapse v-if="records.length > 1">
      <el-collapse-item name="history">
        <template #title>
          <span style="font-weight: 600; font-size: 13px">全部审核意见（{{ records.length }} 条）</span>
        </template>
        <el-timeline style="padding-top: 8px">
          <el-timeline-item
            v-for="(record, idx) in records"
            :key="idx"
            :timestamp="formatTime(record.createdAt)"
            placement="top"
          >
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px">
              <span style="font-weight: 500">{{ record.operatorName }}</span>
              <el-tag :type="getActionTag(record.action).type" size="small">
                {{ getActionTag(record.action).label }}
              </el-tag>
              <el-tag type="info" size="small">{{ getStatusLabel(record.nodeKey) }}</el-tag>
            </div>
            <p v-if="record.remark" style="margin: 4px 0; color: #606266; font-size: 13px; white-space: pre-wrap">{{ record.remark }}</p>
          </el-timeline-item>
        </el-timeline>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>
