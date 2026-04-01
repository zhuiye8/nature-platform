<script setup lang="ts">
/**
 * RejectReasonPanel — 驳回/复核意见展示面板
 * 方案1: 最新驳回原因醒目 Alert
 * 方案2: 所有驳回/复核记录列表（支持并行审核的多条记录）
 *
 * 数据来源: workflow action log 中 action=REJECT/REVIEW 的记录
 */
import { ref, onMounted, watch, computed } from 'vue'
import { getInstanceByBiz, type ActionLog } from '@/api/workflow'
import { getStatusLabel } from '@/utils/status-map'
import { formatTime } from '@/utils/format'

const props = defineProps<{
  bizType: string
  bizId: number
}>()

interface RejectRecord {
  action: string
  nodeKey: string
  operatorName: string
  remark: string
  createdAt: string
}

const records = ref<RejectRecord[]>([])
const loading = ref(false)

const latestReject = computed(() => records.value.length > 0 ? records.value[0] : null)

const alertType = computed(() => {
  if (!latestReject.value) return 'info'
  return latestReject.value.action === 'REJECT' ? 'error' : 'warning'
})

const alertTitle = computed(() => {
  if (!latestReject.value) return ''
  const actionLabel = latestReject.value.action === 'REJECT' ? '驳回' : '复核'
  return `${getStatusLabel(latestReject.value.nodeKey)} ${actionLabel}`
})

async function fetchData() {
  if (!props.bizId) return
  loading.value = true
  try {
    const instance = await getInstanceByBiz(props.bizType, props.bizId) as any
    const logs: any[] = instance?.logs || instance?.actionLogs || []
    // Filter REJECT and REVIEW actions, newest first
    records.value = logs
      .filter((log: any) => ['REJECT', 'REVIEW', 'REJECT_TO_ASSESSMENT', 'REJECT_TO_TECH', 'REVIEW_TO_COMPILE'].includes(log.action))
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
  if (['REJECT', 'REJECT_TO_ASSESSMENT', 'REJECT_TO_TECH'].includes(action))
    return { label: '驳回', type: 'danger' as const }
  return { label: '复核', type: 'warning' as const }
}

onMounted(fetchData)
watch(() => [props.bizType, props.bizId], fetchData)
</script>

<template>
  <div v-if="!loading && records.length > 0">
    <!-- 方案1: 最新驳回/复核原因醒目提示 -->
    <el-alert
      v-if="latestReject"
      :title="alertTitle"
      :type="alertType"
      :closable="false"
      show-icon
      style="margin-bottom: 16px"
    >
      <template #default>
        <div style="font-size: 13px">
          <span style="font-weight: 500">{{ latestReject.operatorName }}</span>
          <span style="color: #909399; margin-left: 8px">{{ formatTime(latestReject.createdAt) }}</span>
        </div>
        <div v-if="latestReject.remark" style="margin-top: 4px; white-space: pre-wrap">{{ latestReject.remark }}</div>
      </template>
    </el-alert>

    <!-- 方案2: 全部驳回/复核记录列表 -->
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
