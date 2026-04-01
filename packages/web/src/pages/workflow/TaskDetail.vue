<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Download } from '@element-plus/icons-vue'
import { getTaskDetail, signalTask, resubmitTask, getUsersByRole } from '@/api/workflow'
import { getContractDetail } from '@/api/contract'
import { getProjectDetail, getSystemItems } from '@/api/project'
import { getFileList, getDownloadUrl, getPreviewUrl, type FileItem } from '@/api/file'
import { getStatusLabel, getStatusTagType } from '@/utils/status-map'
import { formatTime } from '@/utils/format'
import SystemItemDetailDialog from '@/components/SystemItemDetailDialog.vue'
import { useAuthStore } from '@/stores/auth'
import ReviewOpinionDialog from '@/components/ReviewOpinionDialog.vue'
import ReviewOpinionHistory from '@/components/ReviewOpinionHistory.vue'
import FilePoolPanel from '@/components/FilePoolPanel.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const loading = ref(true)
const submitting = ref(false)
const taskData = ref<any>(null)
const bizData = ref<any>(null)
const remark = ref('')
const contractData = ref<any>(null)

// System item detail dialog
const siDialogVisible = ref(false)
const siDialogItem = ref<any>(null)
const systemItemsWithFiles = ref<any[]>([])

async function loadSystemItemsWithFiles(projectId: number) {
  try {
    systemItemsWithFiles.value = (await getSystemItems(projectId)) as any[]
  } catch {
    systemItemsWithFiles.value = []
  }
}

function showSiDetail(row: any) {
  const enriched = systemItemsWithFiles.value.find((i: any) => i.id === row.id) || row
  siDialogItem.value = enriched
  siDialogVisible.value = true
}

const taskId = computed(() => Number(route.params.taskId))
const isPending = computed(() => taskData.value?.status === 'PENDING')
// Can current user operate on this task? (assignee match or pool task with no assignee)
const canOperate = computed(() => {
  if (!taskData.value || !isPending.value) return false
  const assigneeId = taskData.value.assigneeId
  if (!assigneeId) return true // pool task
  return assigneeId === authStore.user?.id
})
const nodeKey = computed(() => taskData.value?.nodeKey ?? '')
const isProjectReview = computed(() => nodeKey.value === 'PROJECT_REVIEW')
const isReportAssign = computed(() => nodeKey.value === 'REPORT_ASSIGN')
const isReportCompile = computed(() => nodeKey.value === 'REPORT_COMPILE')
const isQualityReview = computed(() => ['QUALITY_REVIEW', 'TECH_REVIEW', 'CONTENT_REVIEW'].includes(nodeKey.value))

// Review opinion dialog for quality review nodes (including REPORT_ASSIGN and REPORT_COMPILE)
const opinionDialogVisible = ref(false)
const opinionActionType = ref<'APPROVE' | 'REVIEW' | 'REJECT'>('APPROVE')
const useOpinionDialog = computed(() => ['TECH_REVIEW', 'CONTENT_REVIEW', 'FINAL_REVIEW', 'REPORT_ASSIGN', 'REPORT_COMPILE'].includes(nodeKey.value))

// Report writer selection for REPORT_ASSIGN
const reportWriterOptions = ref<{ id: number; displayName: string }[]>([])
const selectedReportWriterId = ref<number | undefined>(undefined)

function openOpinionDialog(action: 'APPROVE' | 'REVIEW' | 'REJECT') {
  opinionActionType.value = action
  opinionDialogVisible.value = true
}

function onOpinionCompleted() {
  router.push('/dashboard')
}

// Assessor selection for PROJECT_REVIEW approval
const assessorOptions = ref<{ id: number; displayName: string }[]>([])
const selectedAssessorIds = ref<number[]>([])

// (File pools now handled by FilePoolPanel component)

// Contract file for CONTRACT_REVIEW
const contractFileForReview = ref<FileItem | null>(null)
const contractFilePreviewUrl = ref('')
const previewableImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

async function fetchContractFile(bizId: number) {
  try {
    const files = (await getFileList('CONTRACT', bizId)) as any as FileItem[]
    contractFileForReview.value = files && files.length > 0 ? files[0] : null
    if (contractFileForReview.value && (previewableImageTypes.includes(contractFileForReview.value.contentType) || contractFileForReview.value.contentType === 'application/pdf')) {
      const result = (await getPreviewUrl(contractFileForReview.value.id)) as any
      contractFilePreviewUrl.value = result.url || result
    } else {
      contractFilePreviewUrl.value = ''
    }
  } catch { contractFileForReview.value = null; contractFilePreviewUrl.value = '' }
}

async function downloadContractFile() {
  if (!contractFileForReview.value) return
  try {
    const result = (await getDownloadUrl(contractFileForReview.value.id)) as any
    const a = document.createElement('a')
    a.href = result.url || result
    a.download = contractFileForReview.value.fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } catch { /* ignore */ }
}

async function handleFileDownload(fileId: number) {
  try {
    const result = (await getDownloadUrl(fileId)) as any
    window.open(result.url, '_blank')
  } catch { ElMessage.error('下载失败') }
}

function formatFileSize(bytes: number) {
  if (!bytes) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// getTaskDetail returns: { ...task, instance: { instance: {...}, tasks: [...], logs: [...] } }
const wfInstance = computed(() => taskData.value?.instance?.instance ?? null)
const wfLogs = computed(() => taskData.value?.instance?.logs ?? [])
const bizType = computed(() => wfInstance.value?.bizType ?? '')
const bizId = computed(() => wfInstance.value?.bizId ?? 0)

async function fetchData() {
  loading.value = true
  try {
    const task = (await getTaskDetail(taskId.value)) as any
    taskData.value = task

    // Extract bizType/bizId directly from response (not computed, to avoid timing issue)
    const type = task?.instance?.instance?.bizType ?? ''
    const id = task?.instance?.instance?.bizId ?? 0

    // Load business data based on bizType
    if (type === 'CONTRACT' && id) {
      bizData.value = (await getContractDetail(id)) as any
      fetchContractFile(id)
    } else if (type === 'PROJECT_REGISTER' && id) {
      bizData.value = (await getProjectDetail(id)) as any
      await loadSystemItemsWithFiles(id)
      // Load associated contract info for project review
      if (bizData.value?.contractId) {
        try {
          contractData.value = (await getContractDetail(bizData.value.contractId)) as any
        } catch { contractData.value = null }
      }
    }

    // Load assessor candidates if this is a project review task
    if (task?.nodeKey === 'PROJECT_REVIEW') {
      try {
        assessorOptions.value = (await getUsersByRole('assessor')) as any
      } catch { assessorOptions.value = [] }
    }

    // Load report writer candidates if this is a report assign task
    if (task?.nodeKey === 'REPORT_ASSIGN') {
      try {
        reportWriterOptions.value = (await getUsersByRole('report_writer')) as any
      } catch { reportWriterOptions.value = [] }
    }

    // File pools are now handled by FilePoolPanel components in the template
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}

const isFinalReview = computed(() => nodeKey.value === 'FINAL_REVIEW')

async function handleReportAssignApprove() {
  if (!taskData.value) return
  if (!selectedReportWriterId.value) {
    ElMessage.warning('请选择编制人')
    return
  }
  submitting.value = true
  try {
    await signalTask({
      instanceId: taskData.value.instanceId,
      taskId: taskId.value,
      action: 'APPROVE',
      remark: '分配编制任务',
      opinionText: '测评成果审核通过，分配编制任务',
      extraData: { reportWriterIds: [selectedReportWriterId.value] },
    })
    ElMessage.success('已分配编制人')
    router.push('/dashboard')
  } catch { /* interceptor */ }
  finally { submitting.value = false }
}

// Enrich task data with bizName for ReviewOpinionDialog
const taskDataForDialog = computed(() => {
  if (!taskData.value) return null
  const name = bizData.value?.applicationName
    || bizData.value?.projectName
    || bizData.value?.contractName
    || ''
  return { ...taskData.value, bizName: name }
})
const isPendingRectification = computed(() => taskData.value?.status === 'PENDING_RECTIFICATION')
const isReviewNode = computed(() => ['TECH_REVIEW', 'CONTENT_REVIEW', 'REPORT_ASSIGN', 'REPORT_COMPILE', 'FINAL_REVIEW'].includes(nodeKey.value))
const resubmitting = ref(false)

async function handleResubmit() {
  if (!taskData.value) return
  resubmitting.value = true
  try {
    await resubmitTask(taskData.value.instanceId)
    ElMessage.success('已重新提交，审核人将重新审核')
    router.push('/dashboard')
  } catch {
    // handled by interceptor
  } finally {
    resubmitting.value = false
  }
}

async function handleAction(action: 'APPROVE' | 'REJECT') {
  if (!taskData.value) return

  if (action === 'REJECT' && !remark.value.trim()) {
    ElMessage.warning('请填写驳回原因')
    return
  }

  // Project review: must select at least 1 assessor when approving
  if (isProjectReview.value && action === 'APPROVE' && selectedAssessorIds.value.length === 0) {
    ElMessage.warning('请至少选择一名测评师')
    return
  }

  submitting.value = true
  try {
    const extraData: Record<string, any> = {}
    if (isProjectReview.value && action === 'APPROVE') {
      extraData.assessorUserIds = selectedAssessorIds.value
    }

    await signalTask({
      instanceId: taskData.value.instanceId,
      taskId: taskId.value,
      action,
      remark: remark.value.trim() || undefined,
      ...(Object.keys(extraData).length > 0 ? { extraData } : {}),
    })
    const msgMap: Record<string, string> = { APPROVE: '审批通过', REJECT: '已驳回' }
    ElMessage.success(msgMap[action] || '操作成功')
    router.push('/dashboard')
  } catch {
    // handled by interceptor
  } finally {
    submitting.value = false
  }
}

function goBack() {
  router.push('/dashboard')
}


onMounted(() => {
  fetchData()
})
</script>

<template>
  <div v-loading="loading">
    <!-- ── 页头 ─────────────────────────────────────────────────────── -->
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px">
      <el-button :icon="ArrowLeft" @click="goBack">返回</el-button>
      <h2 style="margin: 0; font-size: 18px; color: #303133">
        {{ taskData?.nodeName ?? '任务详情' }}
      </h2>
      <el-tag v-if="taskData" :type="getStatusTagType(taskData.status)" size="large">
        {{ getStatusLabel(taskData.status) }}
      </el-tag>
    </div>

    <!-- ── 合同业务数据 ──────────────────────────────────────────────── -->
    <el-card v-if="bizType === 'CONTRACT' && bizData" shadow="never" style="margin-bottom: 16px">
      <template #header>
        <span style="font-weight: 600">合同信息</span>
      </template>

      <!-- 基本信息 -->
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="合同编号">{{ bizData.contractNo || '--' }}</el-descriptions-item>
        <el-descriptions-item label="合同名称" :span="2">{{ bizData.contractName || '--' }}</el-descriptions-item>
        <el-descriptions-item label="客户名称">{{ bizData.customerName || '--' }}</el-descriptions-item>
        <el-descriptions-item label="联系人">{{ bizData.contactName || '--' }}</el-descriptions-item>
        <el-descriptions-item label="联系电话">{{ bizData.contactPhone || '--' }}</el-descriptions-item>
        <el-descriptions-item label="合同类型">{{ getStatusLabel(bizData.contractType) || bizData.contractType || '--' }}</el-descriptions-item>
        <el-descriptions-item label="成交情况">{{ getStatusLabel(bizData.dealStatus) || bizData.dealStatus || '--' }}</el-descriptions-item>
        <el-descriptions-item label="签单销售">{{ bizData.salesPersonName || '--' }}</el-descriptions-item>
        <el-descriptions-item label="合作方">{{ bizData.partnerName || '--' }}</el-descriptions-item>
      </el-descriptions>

      <!-- 财务信息 -->
      <h4 style="margin: 16px 0 8px; font-size: 14px; color: #606266">财务信息</h4>
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="合同金额（元）">{{ bizData.paymentAmount ?? '--' }}</el-descriptions-item>
        <el-descriptions-item label="付款方式">{{ bizData.paymentMethod || '--' }}</el-descriptions-item>
        <el-descriptions-item label="付款单位">{{ bizData.paymentCompany || '--' }}</el-descriptions-item>
        <el-descriptions-item label="合作方">{{ bizData.partnerName || '--' }}</el-descriptions-item>
        <el-descriptions-item label="业绩归属城市">{{ bizData.performanceCity || '--' }}</el-descriptions-item>
        <el-descriptions-item label="回款状态">
          <el-tag v-if="bizData.paymentStatus" :type="getStatusTagType(bizData.paymentStatus)" size="small">
            {{ getStatusLabel(bizData.paymentStatus) }}
          </el-tag>
          <span v-else>--</span>
        </el-descriptions-item>
      </el-descriptions>

      <!-- 服务信息 -->
      <h4 style="margin: 16px 0 8px; font-size: 14px; color: #606266">服务信息</h4>
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="服务年份">
          <template v-if="Array.isArray(bizData.serviceYears) && bizData.serviceYears.length">
            <el-tag v-for="y in bizData.serviceYears" :key="y" size="small" style="margin-right: 6px">{{ y }}年</el-tag>
          </template>
          <span v-else>--</span>
        </el-descriptions-item>
      </el-descriptions>

      <!-- 系统明细子表 -->
      <div v-if="bizData.systemItems?.length" style="margin-top: 16px">
        <h4 style="margin: 0 0 8px; font-size: 14px; color: #606266">系统明细（{{ bizData.systemItems.length }} 个）</h4>
        <el-table :data="bizData.systemItems" border size="small" stripe>
          <el-table-column type="index" label="#" width="50" align="center" />
          <el-table-column prop="systemName" label="系统名称" min-width="150" show-overflow-tooltip />
          <el-table-column label="安全等级" width="90" align="center">
            <template #default="{ row }">{{ getStatusLabel(row.systemLevel || row.securityLevel) || '--' }}</template>
          </el-table-column>
          <el-table-column prop="assessedUnitName" label="被测单位" min-width="120" show-overflow-tooltip />
          <el-table-column prop="assessedUnitContact" label="联系人" width="90" />
          <el-table-column label="操作" width="80" align="center">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="showSiDetail(row)">详情</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 合同文件 -->
      <div v-if="contractFileForReview" style="margin-top: 16px">
        <h4 style="margin: 0 0 8px; font-size: 14px; color: #606266">合同文件</h4>
        <div style="border: 1px solid var(--el-border-color-lighter); border-radius: 8px; padding: 16px; background: var(--el-fill-color-lighter)">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px">
            <div>
              <div style="font-weight: 500; margin-bottom: 4px">{{ contractFileForReview.fileName }}</div>
              <div style="font-size: 12px; color: var(--el-text-color-secondary)">
                {{ formatTime(contractFileForReview.uploadedAt) }}
              </div>
            </div>
            <el-button size="small" :icon="Download" @click="downloadContractFile">下载</el-button>
          </div>
          <!-- 图片预览 -->
          <div v-if="contractFilePreviewUrl && ['image/jpeg','image/png','image/gif','image/webp'].includes(contractFileForReview.contentType)" style="text-align: center; border-top: 1px solid var(--el-border-color-lighter); padding-top: 12px">
            <el-image :src="contractFilePreviewUrl" :preview-src-list="[contractFilePreviewUrl]" fit="contain" style="max-width: 100%; max-height: 400px; border-radius: 6px" />
          </div>
          <!-- PDF预览 -->
          <div v-else-if="contractFilePreviewUrl && contractFileForReview.contentType === 'application/pdf'" style="border-top: 1px solid var(--el-border-color-lighter); padding-top: 12px">
            <iframe :src="contractFilePreviewUrl" style="width: 100%; height: 400px; border: none; border-radius: 6px" />
          </div>
          <!-- 不支持预览 -->
          <div v-else style="text-align: center; padding: 16px 0; color: var(--el-text-color-placeholder); border-top: 1px solid var(--el-border-color-lighter); padding-top: 12px; font-size: 13px">
            该格式不支持在线预览，请下载查看
          </div>
        </div>
      </div>

      <!-- 其他 -->
      <h4 style="margin: 16px 0 8px; font-size: 14px; color: #606266">其他</h4>
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="备注" :span="2">{{ bizData.remark || '--' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatTime(bizData.createdAt) }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{ formatTime(bizData.updatedAt) }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <!-- ── 关联合同信息（项目审核时展示） ────────────────────────────── -->
    <el-card v-if="bizType === 'PROJECT_REGISTER' && contractData" shadow="never" style="margin-bottom: 16px">
      <template #header>
        <span style="font-weight: 600">关联合同信息</span>
      </template>
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="合同编号">{{ contractData.contractNo || '--' }}</el-descriptions-item>
        <el-descriptions-item label="合同名称">{{ contractData.contractName || '--' }}</el-descriptions-item>
        <el-descriptions-item label="客户名称">{{ contractData.customerName || '--' }}</el-descriptions-item>
        <el-descriptions-item label="合同金额">{{ contractData.paymentAmount ?? '--' }}</el-descriptions-item>
        <el-descriptions-item label="签单销售">{{ contractData.salesPersonName || '--' }}</el-descriptions-item>
        <el-descriptions-item label="合同类型">{{ getStatusLabel(contractData.contractType) || '--' }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <!-- ── 项目业务数据 ──────────────────────────────────────────────── -->
    <el-card v-if="bizType === 'PROJECT_REGISTER' && bizData" shadow="never" style="margin-bottom: 16px">
      <template #header>
        <span style="font-weight: 600">项目信息</span>
      </template>

      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="申请单名称" :span="2">{{ bizData.applicationName || '--' }}</el-descriptions-item>
        <el-descriptions-item label="关联合同">{{ bizData.contractName || '--' }}</el-descriptions-item>
        <el-descriptions-item label="合同年份">{{ bizData.contractYear || '--' }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusTagType(bizData.status)" size="small">
            {{ getStatusLabel(bizData.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatTime(bizData.createdAt) }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ bizData.remark || '--' }}</el-descriptions-item>
      </el-descriptions>

      <!-- 系统明细子表 -->
      <div v-if="bizData.systemItems?.length" style="margin-top: 16px">
        <h4 style="margin: 0 0 8px; font-size: 14px; color: #606266">系统明细（{{ bizData.systemItems.length }} 个）</h4>
        <el-table :data="bizData.systemItems" border size="small" stripe>
          <el-table-column type="index" label="#" width="50" align="center" />
          <el-table-column prop="systemName" label="系统名称" min-width="150" show-overflow-tooltip />
          <el-table-column label="安全等级" width="90" align="center">
            <template #default="{ row }">{{ getStatusLabel(row.securityLevel) || '--' }}</template>
          </el-table-column>
          <el-table-column prop="assessedUnitName" label="被测单位" min-width="120" show-overflow-tooltip />
          <el-table-column prop="assessedUnitContact" label="联系人" width="90" />
          <el-table-column label="操作" width="80" align="center">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="showSiDetail(row)">详情</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 项目成员 -->
      <div v-if="bizData.members?.length" style="margin-top: 16px">
        <h4 style="margin: 0 0 8px; font-size: 14px; color: #606266">项目成员</h4>
        <el-table :data="bizData.members" border size="small" stripe>
          <el-table-column prop="displayName" label="姓名" width="120" />
          <el-table-column label="角色" width="120">
            <template #default="{ row }">
              <el-tag size="small">{{ getStatusLabel(row.roleType) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="getStatusTagType(row.status)" size="small">{{ getStatusLabel(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="分配时间" min-width="170">
            <template #default="{ row }">{{ formatTime(row.assignedAt) }}</template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 测评成果（审核依据） -->
      <div v-if="isQualityReview || isReportAssign || isReportCompile || isFinalReview" style="margin-top: 16px">
        <h4 style="margin: 0 0 8px; font-size: 14px; color: #606266">测评成果（审核依据）</h4>
        <FilePoolPanel api-type="assessment" :project-register-id="bizId" file-pool="ASSESSMENT_RESULT" :readonly="true" />
      </div>

      <!-- 编制报告文件池（编制人可上传，其他节点只读） -->
      <div v-if="isReportCompile || isFinalReview" style="margin-top: 16px">
        <h4 style="margin: 0 0 8px; font-size: 14px; color: #606266">编制报告</h4>
        <FilePoolPanel api-type="compile" :project-register-id="bizId" :readonly="!isReportCompile" />
      </div>
    </el-card>

    <!-- ── 无业务数据时的提示 ─────────────────────────────────────────── -->
    <el-card v-else-if="!loading && !bizData" shadow="never" style="margin-bottom: 16px">
      <el-empty description="暂无关联业务数据" :image-size="80" />
    </el-card>

    <!-- ── 审核意见历史（质量审核节点） ──────────────────────────────── -->
    <el-card v-if="isReviewNode && bizId" shadow="never" style="margin-bottom: 16px">
      <template #header>
        <span style="font-weight: 600">审核意见历史</span>
      </template>
      <ReviewOpinionHistory :project-register-id="bizId" />
    </el-card>

    <!-- ── 重新提交操作栏（PM + PENDING_RECTIFICATION） ────────────── -->
    <el-card v-if="isPendingRectification" shadow="never" style="margin-bottom: 16px">
      <template #header>
        <span style="font-weight: 600">待整改</span>
      </template>
      <el-alert
        title="审核人已提出整改意见，请修改测评成果后重新提交"
        type="warning"
        :closable="false"
        show-icon
        style="margin-bottom: 16px"
      />
      <div style="display: flex; justify-content: flex-end">
        <el-button
          type="primary"
          :loading="resubmitting"
          @click="handleResubmit"
        >
          重新提交
        </el-button>
      </div>
    </el-card>

    <!-- ── 审批流程时间线 ─────────────────────────────────────────────── -->
    <el-collapse v-if="wfLogs.length" style="margin-bottom: 16px">
      <el-collapse-item name="timeline">
        <template #title>
          <span style="font-weight: 600; font-size: 14px">审批流程（{{ wfLogs.length }} 条记录）</span>
        </template>

      <el-timeline style="padding-top: 12px">
        <el-timeline-item
          v-for="log in wfLogs"
          :key="log.id"
          :timestamp="formatTime(log.createdAt)"
          placement="top"
        >
          <div style="display: flex; align-items: center; gap: 8px">
            <span>{{ log.operatorName || '系统' }}</span>
            <el-tag :type="getStatusTagType(log.action)" size="small">
              {{ getStatusLabel(log.action) }}
            </el-tag>
            <span v-if="log.fromNode || log.toNode" style="color: #909399; font-size: 12px">
              {{ log.fromNode ? getStatusLabel(log.fromNode) + ' → ' : '' }}{{ log.toNode ? getStatusLabel(log.toNode) : '' }}
            </span>
          </div>
          <p v-if="log.remark" style="color: #909399; margin: 4px 0 0; font-size: 13px">
            {{ log.remark }}
          </p>
        </el-timeline-item>
      </el-timeline>
      </el-collapse-item>
    </el-collapse>

    <!-- ── 审核操作栏 ─────────────────────────────────────────────────── -->
    <el-card v-if="canOperate" shadow="never">
      <template #header>
        <span style="font-weight: 600">审核操作</span>
      </template>

      <!-- PROJECT_REVIEW: assessor selection -->
      <div v-if="isProjectReview" style="margin-bottom: 16px">
        <div style="margin-bottom: 8px; font-weight: 600; font-size: 14px">
          分配测评师 <span style="color: #f56c6c">*</span>
          <span style="color: #909399; font-weight: normal; font-size: 12px; margin-left: 8px">
            审核通过后将自动分配为本项目的测评师
          </span>
        </div>
        <el-select
          v-model="selectedAssessorIds"
          multiple
          filterable
          placeholder="请选择测评师（可多选）"
          style="width: 100%"
        >
          <el-option
            v-for="user in assessorOptions"
            :key="user.id"
            :label="user.displayName"
            :value="user.id"
          />
        </el-select>
        <div v-if="selectedAssessorIds.length > 0" style="margin-top: 4px; color: #67c23a; font-size: 12px">
          已选 {{ selectedAssessorIds.length }} 人
        </div>
      </div>

      <!-- REPORT_ASSIGN: 分配编制人 -->
      <div v-if="isReportAssign" style="margin-bottom: 16px">
        <div style="margin-bottom: 8px; font-weight: 600; font-size: 14px">
          分配编制人 <span style="color: #f56c6c">*</span>
          <span style="color: #909399; font-weight: normal; font-size: 12px; margin-left: 8px">
            通过后将分配给选中的编制人进行报告编制
          </span>
        </div>
        <el-select
          v-model="selectedReportWriterId"
          filterable
          placeholder="请选择编制人"
          style="width: 100%"
        >
          <el-option
            v-for="user in reportWriterOptions"
            :key="user.id"
            :label="user.displayName"
            :value="user.id"
          />
        </el-select>
      </div>

      <!-- REPORT_ASSIGN: 通过（需选编制人）+ 复核 -->
      <template v-if="isReportAssign">
        <div style="display: flex; gap: 12px; justify-content: flex-end">
          <el-button type="success" :loading="submitting" @click="handleReportAssignApprove">通过</el-button>
          <el-button type="warning" @click="openOpinionDialog('REVIEW')">复核</el-button>
        </div>
      </template>

      <!-- 其他质量审核节点: 只显示按钮，意见在弹窗中填写 -->
      <template v-else-if="useOpinionDialog">
        <div style="display: flex; gap: 12px; justify-content: flex-end">
          <el-button type="success" @click="openOpinionDialog('APPROVE')">通过</el-button>
          <el-button type="warning" @click="openOpinionDialog('REVIEW')">复核</el-button>
          <el-button v-if="isFinalReview" type="danger" @click="openOpinionDialog('REJECT')">驳回</el-button>
        </div>
      </template>

      <!-- 非质量审核节点: 备注输入 + 按钮 -->
      <template v-else>
        <el-input
          v-model="remark"
          type="textarea"
          :rows="3"
          placeholder="备注（驳回时必填，通过时选填）"
          maxlength="500"
          show-word-limit
          style="margin-bottom: 16px"
        />
        <div style="display: flex; gap: 12px; justify-content: flex-end">
          <el-button
            type="danger"
            :loading="submitting"
            @click="handleAction('REJECT')"
          >
            驳回
          </el-button>
          <el-button
            type="success"
            :loading="submitting"
            @click="handleAction('APPROVE')"
          >
            通过
          </el-button>
        </div>
      </template>
    </el-card>

    <ReviewOpinionDialog
      :visible="opinionDialogVisible"
      :task="taskDataForDialog"
      :action-type="opinionActionType"
      @update:visible="opinionDialogVisible = $event"
      @completed="onOpinionCompleted"
    />

    <SystemItemDetailDialog
      v-model:visible="siDialogVisible"
      :item="siDialogItem"
    />
  </div>
</template>
