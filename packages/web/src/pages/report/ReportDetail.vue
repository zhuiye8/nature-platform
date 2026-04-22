<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getReportDetail, submitReport } from '@/api/report'
import { getInstanceByBiz } from '@/api/workflow'
import type { ReportDetail } from '@/api/report'
import type { InstanceDetail } from '@/api/workflow'
import FilePoolPanel from '@/components/FilePoolPanel.vue'
import { useOperableTasks } from '@/composables/useOperableTasks'

const route = useRoute()
const projectRegisterId = Number(route.params.projectRegisterId)

const detail = ref<ReportDetail | null>(null)
const workflowInstance = ref<InstanceDetail | null>(null)
const loading = ref(true)

/**
 * 操作模式: 当前用户在 my-tasks 中有本项目的 REPORT_COMPILE 任务时开启。
 * - 编辑文件池 + 显示"提交报告"按钮
 * - 非操作模式(普通查看者/归档后/非编制人): 文件池只读,无提交按钮
 */
const { hasTaskFor, refresh } = useOperableTasks()
const canEditCompile = computed(() =>
  hasTaskFor('PROJECT_REGISTER', projectRegisterId, 'REPORT_COMPILE'),
)

async function fetchData() {
  loading.value = true
  try {
    const [reportDetail, instance] = await Promise.all([
      getReportDetail(projectRegisterId),
      getInstanceByBiz('PROJECT_REGISTER', projectRegisterId).catch(() => null),
    ])

    detail.value = reportDetail
    workflowInstance.value = instance
  } finally {
    loading.value = false
  }
}

async function handleSubmitReport() {
  try {
    await submitReport({ projectRegisterId })
    ElMessage.success('报告已提交')
    // 刷新 my-tasks 缓存: 提交后本任务消失,按钮/编辑模式应立即关闭
    await refresh()
    fetchData()
  } catch {
    // handled by request interceptor
  }
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div v-loading="loading">
    <el-card shadow="never" style="margin-bottom: 16px">
      <template #header>
        <span style="font-weight: 600">报告编制</span>
      </template>

      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="当前节点">
          <el-tag size="small">{{ detail?.currentNode ?? '-' }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="编制人">
          {{ detail?.compilerName ?? '未分配' }}
        </el-descriptions-item>
      </el-descriptions>

      <div v-if="canEditCompile" style="margin-top: 16px">
        <el-button type="primary" @click="handleSubmitReport">提交报告</el-button>
      </div>
    </el-card>

    <el-card shadow="never" style="margin-bottom: 16px">
      <template #header>
        <span style="font-weight: 600">编制报告文件</span>
      </template>
      <FilePoolPanel
        api-type="compile"
        :project-register-id="projectRegisterId"
        :readonly="!canEditCompile"
      />
    </el-card>

    <el-card
      v-if="detail?.reviewTasks && detail.reviewTasks.length > 0"
      shadow="never"
      style="margin-bottom: 16px"
    >
      <template #header>
        <span style="font-weight: 600">报告审核</span>
      </template>
      <el-table :data="detail.reviewTasks" stripe border size="small">
        <el-table-column prop="assigneeName" label="审核人" min-width="120" />
        <el-table-column label="状态" min-width="100" align="center">
          <template #default="{ row }">
            <el-tag
              :type="row.result === 'APPROVED' ? 'success' : row.result === 'REJECTED' ? 'danger' : 'warning'"
              size="small"
            >
              {{ row.status === 'COMPLETED' ? (row.result === 'APPROVED' ? '通过' : '驳回') : '审核中' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="意见" min-width="200" show-overflow-tooltip />
      </el-table>
    </el-card>

    <el-card v-if="workflowInstance?.actionLogs?.length" shadow="never">
      <template #header>
        <span style="font-weight: 600">流程记录</span>
      </template>
      <el-timeline>
        <el-timeline-item
          v-for="log in workflowInstance.actionLogs"
          :key="log.id"
          :timestamp="log.createdAt"
          placement="top"
        >
          <el-tag
            :type="log.action === 'APPROVE' ? 'success' : log.action === 'REJECT' ? 'danger' : 'primary'"
            size="small"
          >
            {{ log.action }}
          </el-tag>
          <span style="margin-left: 8px; font-size: 13px">
            {{ log.operatorName }} - {{ log.nodeKey ?? '-' }}
          </span>
          <div
            v-if="log.remark"
            style="font-size: 12px; color: #909399; margin-top: 4px"
          >
            {{ log.remark }}
          </div>
        </el-timeline-item>
      </el-timeline>
    </el-card>

  </div>
</template>
