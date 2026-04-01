<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { getOpinionHistory, type ReviewOpinionItem } from '@/api/review-opinion'
import { getDownloadUrl } from '@/api/file'
import { getStatusLabel, getStatusTagType } from '@/utils/status-map'
import { formatTime } from '@/utils/format'

const props = defineProps<{
  projectRegisterId: number
}>()

const loading = ref(false)
const opinions = ref<ReviewOpinionItem[]>([])

// Group opinions by roundNo
const groupedByRound = computed(() => {
  const map = new Map<number, ReviewOpinionItem[]>()
  for (const item of opinions.value) {
    const round = item.roundNo
    if (!map.has(round)) map.set(round, [])
    map.get(round)!.push(item)
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0])
})

async function fetchData() {
  if (!props.projectRegisterId) return
  loading.value = true
  try {
    const data = await getOpinionHistory(props.projectRegisterId)
    opinions.value = (data as any) ?? []
  } catch {
    opinions.value = []
  } finally {
    loading.value = false
  }
}


function getActionTag(actionType: string) {
  switch (actionType) {
    case 'APPROVE': return { label: '通过', type: 'success' }
    case 'REVIEW': return { label: '复核', type: 'warning' }
    case 'REJECT': return { label: '驳回', type: 'danger' }
    case 'RESUBMIT': return { label: '重新提交', type: 'info' }
    default: return { label: actionType, type: '' }
  }
}

async function handleDownloadAttachment(fileId: number) {
  try {
    const result = (await getDownloadUrl(fileId)) as any
    window.open(result.url, '_blank')
  } catch { /* ignore */ }
}

onMounted(fetchData)
watch(() => props.projectRegisterId, fetchData)
</script>

<script lang="ts">
import { computed } from 'vue'
export default { name: 'ReviewOpinionHistory' }
</script>

<template>
  <div v-loading="loading">
    <el-empty v-if="!loading && opinions.length === 0" description="暂无审核意见记录" :image-size="60" />
    <div v-else>
      <div v-for="[roundNo, items] in groupedByRound" :key="roundNo" style="margin-bottom: 20px">
        <div style="margin-bottom: 8px; font-weight: 600; font-size: 14px; color: #303133">
          第 {{ roundNo }} 轮
        </div>
        <el-timeline>
          <el-timeline-item
            v-for="item in items"
            :key="item.id"
            :timestamp="formatTime(item.createdAt)"
            placement="top"
          >
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px">
              <span style="font-weight: 500">{{ item.operatorName || '未知' }}</span>
              <el-tag :type="getActionTag(item.actionType).type as any" size="small">
                {{ getActionTag(item.actionType).label }}
              </el-tag>
              <el-tag v-if="item.nodeKey" size="small" type="info">
                {{ getStatusLabel(item.nodeKey) }}
              </el-tag>
              <el-tag v-if="item.slotKey" size="small" plain>
                {{ getStatusLabel(item.slotKey) || item.slotKey }}
              </el-tag>
            </div>
            <p v-if="item.opinionText" style="margin: 4px 0; color: #606266; font-size: 13px; white-space: pre-wrap">
              {{ item.opinionText }}
            </p>
            <div v-if="item.attachmentIds && (item.attachmentIds as number[]).length > 0" style="margin-top: 4px">
              <span style="font-size: 12px; color: #909399; margin-right: 4px">附件：</span>
              <el-button
                v-for="fileId in (item.attachmentIds as number[])"
                :key="fileId"
                type="primary"
                link
                size="small"
                @click="handleDownloadAttachment(fileId)"
              >
                附件#{{ fileId }}
              </el-button>
            </div>
          </el-timeline-item>
        </el-timeline>
      </div>
    </div>
  </div>
</template>
