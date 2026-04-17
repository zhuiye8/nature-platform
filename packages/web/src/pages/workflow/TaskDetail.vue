<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Download, Paperclip } from '@element-plus/icons-vue'
import { getTaskDetail, signalTask, resubmitTask, getUsersByRole } from '@/api/workflow'
import { getContractDetail } from '@/api/contract'
import { getProjectDetail, getSystemItems } from '@/api/project'
import { getFileList, getFileDownloadPath, getFilePreviewPath, type FileItem } from '@/api/file'
import { getStatusLabel, getStatusTagType } from '@/utils/status-map'
import { formatTime } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import ReviewOpinionDialog from '@/components/ReviewOpinionDialog.vue'
import ReviewOpinionHistory from '@/components/ReviewOpinionHistory.vue'
import FilePoolPanel from '@/components/FilePoolPanel.vue'
import SystemItemDetailDialog from '@/components/SystemItemDetailDialog.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const loading = ref(true)
const submitting = ref(false)
const taskData = ref<any>(null)
const bizData = ref<any>(null)
const remark = ref('')
const contractData = ref<any>(null)

// System items with files (for PROJECT_REGISTER)
const systemItemsEnriched = ref<any[]>([])

async function loadSystemItemsWithFiles(projectId: number) {
  try {
    systemItemsEnriched.value = (await getSystemItems(projectId)) as any[]
  } catch {
    systemItemsEnriched.value = []
  }
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

// Assessor + PM selection for PROJECT_REVIEW approval
const assessorOptions = ref<{ id: number; displayName: string }[]>([])
const selectedAssessorIds = ref<number[]>([])
const pmOptions = ref<{ id: number; displayName: string }[]>([])
const selectedPmId = ref<number | undefined>(undefined)

// (File pools now handled by FilePoolPanel component)

// Contract files for CONTRACT_REVIEW (multi-file + desc)
const contractFilesForReview = ref<FileItem[]>([])
const contractDescFileForReview = ref<FileItem | null>(null)

async function fetchContractFile(bizId: number) {
  try {
    contractFilesForReview.value = (await getFileList('CONTRACT', bizId)) as any as FileItem[]
  } catch { contractFilesForReview.value = [] }
  try {
    const descFiles = (await getFileList('CONTRACT_DESC', bizId)) as any as FileItem[]
    contractDescFileForReview.value = descFiles && descFiles.length > 0 ? descFiles[0] : null
  } catch { contractDescFileForReview.value = null }
}

function handleFileDownload(fileId: number) {
  window.open(getFileDownloadPath(fileId), '_blank')
}

function formatFileSize(bytes: number) {
  if (!bytes) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// ── System item detail dialog ──
const siDialogVisible = ref(false)
const siDialogItem = ref<any>(null)
function showSystemItemDetail(row: any) {
  siDialogItem.value = row
  siDialogVisible.value = true
}

// ── File preview (opens in new tab; backend applies watermark) ──
const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
function canPreviewByName(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return imageExts.some((e) => lower.endsWith(e)) || lower.endsWith('.pdf')
}

function openFilePreview(fileId: number, fileName: string) {
  if (!canPreviewByName(fileName)) {
    handleFileDownload(fileId)
    return
  }
  window.open(getFilePreviewPath(fileId), '_blank')
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

    // Load assessor + PM candidates if this is a project review task
    if (task?.nodeKey === 'PROJECT_REVIEW') {
      try {
        assessorOptions.value = (await getUsersByRole('assessor')) as any
      } catch { assessorOptions.value = [] }
      try {
        pmOptions.value = (await getUsersByRole('project_manager')) as any
      } catch { pmOptions.value = [] }
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

// Enrich task data with bizName for ReviewOpinionDialog.
// For CONTRACT workflows we prefer "组名(分类)" so reviewers see a meaningful
// label at the contract review / archive stage. Matches the same format used
// by workflow.service.ts getMyTasks for the dashboard task list.
const taskDataForDialog = computed(() => {
  if (!taskData.value) return null
  const b = bizData.value as any
  let name = b?.applicationName || b?.projectName || ''
  if (!name && b) {
    if (b.groupName && b.contractCategory) {
      name = `${b.groupName}(${b.contractCategory})`
    } else if (b.groupName) {
      name = b.groupName
    } else if (b.contractName) {
      name = b.contractName
    }
  }
  return { ...taskData.value, bizName: name || '' }
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

  // Project review: must select PM + at least 1 assessor when approving
  if (isProjectReview.value && action === 'APPROVE') {
    if (!selectedPmId.value) {
      ElMessage.warning('请选择项目经理')
      return
    }
    if (selectedAssessorIds.value.length === 0) {
      ElMessage.warning('请至少选择一名测评师')
      return
    }
  }

  submitting.value = true
  try {
    const extraData: Record<string, any> = {}
    if (isProjectReview.value && action === 'APPROVE') {
      extraData.pmUserId = selectedPmId.value
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
        <el-descriptions-item label="合同组">{{ bizData.groupName || '--' }}</el-descriptions-item>
        <el-descriptions-item label="合同分类">{{ bizData.contractCategory || '--' }}</el-descriptions-item>
        <el-descriptions-item label="合同编号">{{ bizData.contractNo || '--' }}</el-descriptions-item>
        <el-descriptions-item label="合同名称" :span="2">{{ bizData.contractName || '--' }}</el-descriptions-item>
        <el-descriptions-item label="客户名称">{{ bizData.customerName || '--' }}</el-descriptions-item>
        <el-descriptions-item label="统一信用代码">{{ bizData.customerUscc || '--' }}</el-descriptions-item>
        <el-descriptions-item label="联系人">{{ bizData.contactName || '--' }}</el-descriptions-item>
        <el-descriptions-item label="联系电话">{{ bizData.contactPhone || '--' }}</el-descriptions-item>
        <el-descriptions-item label="服务内容">{{ bizData.serviceContent || '--' }}</el-descriptions-item>
        <el-descriptions-item label="合同类型">{{ bizData.contractType || '--' }}</el-descriptions-item>
        <el-descriptions-item label="成交情况">{{ getStatusLabel(bizData.dealStatus) || bizData.dealStatus || '--' }}</el-descriptions-item>
        <el-descriptions-item label="签单销售">{{ bizData.salesPersonName || '--' }}</el-descriptions-item>
        <el-descriptions-item label="合作方">{{ bizData.partnerName || '--' }}</el-descriptions-item>
        <el-descriptions-item label="业绩归属城市">{{ bizData.performanceCity || '--' }}</el-descriptions-item>
      </el-descriptions>

      <!-- 财务信息 -->
      <h4 style="margin: 16px 0 8px; font-size: 14px; color: #606266">财务信息</h4>
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="付款金额">{{ bizData.paymentAmount ?? '--' }}</el-descriptions-item>
        <el-descriptions-item label="付款单位">{{ bizData.paymentCompany || '--' }}</el-descriptions-item>
        <el-descriptions-item label="发票类型">{{ bizData.invoiceType || '--' }}</el-descriptions-item>
        <el-descriptions-item label="税率">{{ bizData.taxRate ? bizData.taxRate + '%' : '--' }}</el-descriptions-item>
        <el-descriptions-item label="付款方式">{{ bizData.paymentMethod || '--' }}</el-descriptions-item>
        <el-descriptions-item label="回款状态">
          <el-tag v-if="bizData.paymentStatus" :type="getStatusTagType(bizData.paymentStatus)" size="small">
            {{ getStatusLabel(bizData.paymentStatus) }}
          </el-tag>
          <span v-else>--</span>
        </el-descriptions-item>
      </el-descriptions>
      <el-descriptions :column="1" border size="small" style="margin-top: 8px">
        <el-descriptions-item label="付款信息">
          <div style="white-space: pre-wrap">{{ bizData.paymentInfo || '--' }}</div>
        </el-descriptions-item>
        <el-descriptions-item label="回款备注">{{ bizData.paymentRemark || '--' }}</el-descriptions-item>
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
        </el-table>
      </div>

      <!-- 合同文件 -->
      <div v-if="contractFilesForReview.length > 0" style="margin-top: 16px">
        <h4 style="margin: 0 0 8px; font-size: 14px; color: #606266">合同文件</h4>
        <el-table :data="contractFilesForReview" border size="small" style="width: 100%">
          <el-table-column prop="fileName" label="文件名" min-width="200" show-overflow-tooltip />
          <el-table-column label="大小" width="100">
            <template #default="{ row }">{{ formatFileSize(row.fileSize) }}</template>
          </el-table-column>
          <el-table-column label="上传时间" width="170">
            <template #default="{ row }">{{ formatTime(row.uploadedAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="80" align="center">
            <template #default="{ row }">
              <el-button type="primary" link size="small" :icon="Download" @click="handleFileDownload(row.id)">下载</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 合同文件说明 -->
      <div v-if="contractDescFileForReview" style="margin-top: 16px">
        <h4 style="margin: 0 0 8px; font-size: 14px; color: #606266">合同文件说明</h4>
        <div style="display: flex; align-items: center; justify-content: space-between; border: 1px solid var(--el-border-color-lighter); border-radius: 6px; padding: 10px 14px; background: var(--el-fill-color-lighter)">
          <div>
            <span>{{ contractDescFileForReview.fileName }}</span>
            <span style="font-size: 12px; color: var(--el-text-color-secondary); margin-left: 12px">{{ formatFileSize(contractDescFileForReview.fileSize) }}</span>
          </div>
          <el-button size="small" :icon="Download" @click="handleFileDownload(contractDescFileForReview.id)">下载</el-button>
        </div>
      </div>

      <!-- 合同组关联合同 -->
      <div v-if="bizData.groupContracts && bizData.groupContracts.length > 1" style="margin-top: 16px">
        <h4 style="margin: 0 0 8px; font-size: 14px; color: #606266">合同组关联合同</h4>
        <el-table :data="bizData.groupContracts" border size="small">
          <el-table-column prop="contractNo" label="合同编号" min-width="180" show-overflow-tooltip />
          <el-table-column prop="contractName" label="合同名称" min-width="200" show-overflow-tooltip />
          <el-table-column prop="contractCategory" label="分类" width="100" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.contractCategory" size="small">{{ row.contractCategory }}</el-tag>
              <span v-else>--</span>
            </template>
          </el-table-column>
          <el-table-column label="审核状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="getStatusTagType(row.reviewStatus)" size="small">{{ getStatusLabel(row.reviewStatus) || row.reviewStatus }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="" width="60" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.id === bizData.id" type="primary" size="small" effect="dark">当前</el-tag>
            </template>
          </el-table-column>
        </el-table>
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
        <el-descriptions-item label="统一信用代码">{{ contractData.customerUscc || '--' }}</el-descriptions-item>
        <el-descriptions-item label="联系人">{{ contractData.contactName || '--' }}</el-descriptions-item>
        <el-descriptions-item label="联系电话">{{ contractData.contactPhone || '--' }}</el-descriptions-item>
        <el-descriptions-item label="服务内容">{{ contractData.serviceContent || '--' }}</el-descriptions-item>
        <el-descriptions-item label="合同类型">{{ contractData.contractType || '--' }}</el-descriptions-item>
        <el-descriptions-item label="签单销售">{{ contractData.salesPersonName || '--' }}</el-descriptions-item>
        <el-descriptions-item label="合作方">{{ contractData.partnerName || '--' }}</el-descriptions-item>
        <el-descriptions-item label="合同金额">{{ contractData.paymentAmount ?? '--' }}</el-descriptions-item>
        <el-descriptions-item label="服务年份">
          <template v-if="Array.isArray(contractData.serviceYears) && contractData.serviceYears.length">
            <el-tag v-for="y in contractData.serviceYears" :key="y" size="small" style="margin-right: 4px">{{ y }}年</el-tag>
          </template>
          <span v-else>--</span>
        </el-descriptions-item>
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

      <!-- 系统明细（表格） -->
      <div v-if="systemItemsEnriched.length > 0" style="margin-top: 16px">
        <h4 style="margin: 0 0 8px; font-size: 14px; color: #606266">系统明细（{{ systemItemsEnriched.length }} 个）</h4>
        <el-table :data="systemItemsEnriched" stripe border size="small" style="width: 100%">
          <el-table-column prop="systemNo" label="项目编号" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">{{ row.systemNo || '--' }}</template>
          </el-table-column>
          <el-table-column prop="systemName" label="被测评系统名称" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">
              <el-link type="primary" underline="never" @click="showSystemItemDetail(row)">{{ row.systemName }}</el-link>
            </template>
          </el-table-column>
          <el-table-column prop="filingCertificateNo" label="备案证明编号" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">{{ row.filingCertificateNo || '--' }}</template>
          </el-table-column>
          <el-table-column prop="securityLevel" label="安全保护等级" min-width="110" align="center">
            <template #default="{ row }">{{ row.securityLevel || '--' }}</template>
          </el-table-column>
          <el-table-column prop="filingAgency" label="备案机关" min-width="150" show-overflow-tooltip>
            <template #default="{ row }">{{ row.filingAgency || '--' }}</template>
          </el-table-column>
          <el-table-column prop="assessedUnitName" label="被测评系统单位名称" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">{{ row.assessedUnitName || '--' }}</template>
          </el-table-column>
          <el-table-column label="备案证明" width="100" align="center">
            <template #default="{ row }">
              <el-link v-if="row.filingCertificateFile" type="primary" :underline="false" @click="openFilePreview(row.filingCertificateFile.id, row.filingCertificateFile.fileName)">
                <el-icon><Paperclip /></el-icon>
              </el-link>
              <span v-else style="color: #999">--</span>
            </template>
          </el-table-column>
          <el-table-column label="备案表" width="80" align="center">
            <template #default="{ row }">
              <el-link v-if="row.hasFilingForm && row.filingFormFile" type="primary" :underline="false" @click="openFilePreview(row.filingFormFile.id, row.filingFormFile.fileName)">
                <el-icon><Paperclip /></el-icon>
              </el-link>
              <span v-else-if="row.hasFilingForm" style="color: #e6a23c">有</span>
              <span v-else style="color: #999">--</span>
            </template>
          </el-table-column>
          <el-table-column label="定级报告" width="80" align="center">
            <template #default="{ row }">
              <el-link v-if="row.hasClassificationReport && row.classificationReportFile" type="primary" :underline="false" @click="openFilePreview(row.classificationReportFile.id, row.classificationReportFile.fileName)">
                <el-icon><Paperclip /></el-icon>
              </el-link>
              <span v-else-if="row.hasClassificationReport" style="color: #e6a23c">有</span>
              <span v-else style="color: #999">--</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" fixed="right" align="center">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="showSystemItemDetail(row)">详情</el-button>
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
      <el-alert v-if="isReportCompile" title="请在「报告管理」栏上传编制报告后再提交" type="warning" :closable="false" show-icon style="margin-top: 16px" />
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

      <!-- PROJECT_REVIEW: PM + assessor selection -->
      <div v-if="isProjectReview" style="margin-bottom: 16px">
        <div style="margin-bottom: 8px; font-weight: 600; font-size: 14px">
          分配项目经理 <span style="color: #f56c6c">*</span>
        </div>
        <el-select
          v-model="selectedPmId"
          filterable
          placeholder="请选择项目经理"
          style="width: 100%; margin-bottom: 16px"
        >
          <el-option
            v-for="user in pmOptions"
            :key="user.id"
            :label="user.displayName"
            :value="user.id"
          />
        </el-select>

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

    <SystemItemDetailDialog v-model:visible="siDialogVisible" :item="siDialogItem" />
  </div>
</template>
