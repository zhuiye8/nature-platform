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
// Dept review: just approve/reject, no assignment
const isDeptReview = computed(() => nodeKey.value === 'DEPT_REVIEW')
// Director review: approve + assign PM (single) + assessors (multi, grouped by level)
const isDirectorReview = computed(() => nodeKey.value === 'DIRECTOR_REVIEW')
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

// Assessor + PM selection for DIRECTOR_REVIEW approval
// 3 assessor levels: senior / middle / junior
// PM candidates = senior + middle (single select)
// Assessor candidates = all 3 levels (multi select, grouped by level)
const seniorAssessors = ref<{ id: number; displayName: string }[]>([])
const middleAssessors = ref<{ id: number; displayName: string }[]>([])
const juniorAssessors = ref<{ id: number; displayName: string }[]>([])
const selectedAssessorIds = ref<number[]>([])
const selectedPmId = ref<number | undefined>(undefined)

// 已选汇总（用于底部确认面板）
const selectedPmInfo = computed(() => {
  if (!selectedPmId.value) return null
  const senior = seniorAssessors.value.find((u) => u.id === selectedPmId.value)
  if (senior) return { ...senior, level: 'senior' as const, levelLabel: '高级' }
  const middle = middleAssessors.value.find((u) => u.id === selectedPmId.value)
  if (middle) return { ...middle, level: 'middle' as const, levelLabel: '中级' }
  return null
})

const selectedAssessorsByLevel = computed(() => {
  const idSet = new Set(selectedAssessorIds.value)
  return {
    senior: seniorAssessors.value.filter((u) => idSet.has(u.id)),
    middle: middleAssessors.value.filter((u) => idSet.has(u.id)),
    junior: juniorAssessors.value.filter((u) => idSet.has(u.id)),
  }
})

const hasAnyAssignSelection = computed(
  () => !!selectedPmId.value || selectedAssessorIds.value.length > 0,
)

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

// Related contract attachments for PROJECT_REGISTER review (DEPT/DIRECTOR_REVIEW)
// These are read-only references to the contract's files
const linkedContractFiles = ref<FileItem[]>([])
const linkedContractDescFiles = ref<FileItem[]>([])

async function fetchLinkedContractAttachments(contractId: number) {
  try { linkedContractFiles.value = (await getFileList('CONTRACT', contractId)) as any as FileItem[] }
  catch { linkedContractFiles.value = [] }
  try { linkedContractDescFiles.value = (await getFileList('CONTRACT_DESC', contractId)) as any as FileItem[] }
  catch { linkedContractDescFiles.value = [] }
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
      // Load associated contract info + attachments for project review
      if (bizData.value?.contractId) {
        try {
          contractData.value = (await getContractDetail(bizData.value.contractId)) as any
        } catch { contractData.value = null }
        await fetchLinkedContractAttachments(bizData.value.contractId)
      }
    }

    // Load assessor candidates (grouped by level) for DIRECTOR_REVIEW
    if (task?.nodeKey === 'DIRECTOR_REVIEW') {
      try {
        const [senior, middle, junior] = await Promise.all([
          getUsersByRole('senior_assessor'),
          getUsersByRole('middle_assessor'),
          getUsersByRole('junior_assessor'),
        ])
        seniorAssessors.value = senior as any
        middleAssessors.value = middle as any
        juniorAssessors.value = junior as any
      } catch {
        seniorAssessors.value = []
        middleAssessors.value = []
        juniorAssessors.value = []
      }
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

  // Director review: must select PM + at least 1 assessor when approving
  if (isDirectorReview.value && action === 'APPROVE') {
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
    if (isDirectorReview.value && action === 'APPROVE') {
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

      <!-- 关联合同附件 -->
      <div v-if="linkedContractFiles.length > 0 || linkedContractDescFiles.length > 0" style="margin-top: 16px">
        <h4 style="margin: 0 0 10px; font-size: 14px; color: #606266">合同附件</h4>
        <div v-if="linkedContractFiles.length > 0" style="margin-bottom: 12px">
          <div style="font-size: 12px; color: #909399; margin-bottom: 6px">合同文件</div>
          <div style="display: flex; flex-direction: column; gap: 6px">
            <div
              v-for="f in linkedContractFiles"
              :key="'lcf-'+f.id"
              style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #fafafa; border-radius: 4px; border: 1px solid var(--el-border-color-extra-light)"
            >
              <el-link type="primary" :underline="false" @click="openFilePreview(f.id, f.fileName)">{{ f.fileName }}</el-link>
              <span style="color: #909399; font-size: 12px">{{ formatFileSize(f.fileSize) }}</span>
              <span style="color: #909399; font-size: 12px; margin-left: auto">{{ f.uploaderName || '--' }} · {{ formatTime(f.uploadedAt) }}</span>
            </div>
          </div>
        </div>
        <div v-if="linkedContractDescFiles.length > 0">
          <div style="font-size: 12px; color: #909399; margin-bottom: 6px">合同附件说明</div>
          <div style="display: flex; flex-direction: column; gap: 6px">
            <div
              v-for="f in linkedContractDescFiles"
              :key="'lcd-'+f.id"
              style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #fafafa; border-radius: 4px; border: 1px solid var(--el-border-color-extra-light)"
            >
              <el-link type="primary" :underline="false" @click="openFilePreview(f.id, f.fileName)">{{ f.fileName }}</el-link>
              <span style="color: #909399; font-size: 12px">{{ formatFileSize(f.fileSize) }}</span>
              <span style="color: #909399; font-size: 12px; margin-left: auto">{{ f.uploaderName || '--' }} · {{ formatTime(f.uploadedAt) }}</span>
            </div>
          </div>
        </div>
      </div>
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

      <!-- DEPT_REVIEW: 部门经理仅确认，不分配人员（无额外提示，直接走下方备注+通过/驳回） -->


      <!-- DIRECTOR_REVIEW: 项目主管审核+分配 PM + 测评师（分级） -->
      <div v-if="isDirectorReview" class="assign-panel">
        <!-- ── 项目经理（单选） ── -->
        <div class="assign-section">
          <div class="assign-section__head">
            <span class="assign-section__title">
              分配项目经理 <span class="assign-section__required">*</span>
            </span>
            <span class="assign-section__hint">（仅高级 / 中级测评师可担任）</span>
          </div>

          <div v-if="seniorAssessors.length === 0 && middleAssessors.length === 0" class="assign-empty">
            暂无高/中级测评师
          </div>

          <template v-else>
            <div v-if="seniorAssessors.length > 0" class="assign-level level--senior">
              <div class="assign-level__head">
                <span class="assign-level__name">高级</span>
                <span class="assign-level__count">{{ seniorAssessors.length }}</span>
              </div>
              <div class="assign-level__grid">
                <label
                  v-for="u in seniorAssessors"
                  :key="'pm-s-'+u.id"
                  :class="['person-chip', { 'is-selected': selectedPmId === u.id }]"
                >
                  <input type="radio" name="pm" :value="u.id" v-model="selectedPmId" class="person-chip__input" />
                  <span class="person-chip__check"></span>
                  <span class="person-chip__name">{{ u.displayName }}</span>
                </label>
              </div>
            </div>

            <div v-if="middleAssessors.length > 0" class="assign-level level--middle">
              <div class="assign-level__head">
                <span class="assign-level__name">中级</span>
                <span class="assign-level__count">{{ middleAssessors.length }}</span>
              </div>
              <div class="assign-level__grid">
                <label
                  v-for="u in middleAssessors"
                  :key="'pm-m-'+u.id"
                  :class="['person-chip', { 'is-selected': selectedPmId === u.id }]"
                >
                  <input type="radio" name="pm" :value="u.id" v-model="selectedPmId" class="person-chip__input" />
                  <span class="person-chip__check"></span>
                  <span class="person-chip__name">{{ u.displayName }}</span>
                </label>
              </div>
            </div>
          </template>
        </div>

        <!-- ── 测评师（多选） ── -->
        <div class="assign-section">
          <div class="assign-section__head">
            <span class="assign-section__title">
              分配测评师 <span class="assign-section__required">*</span>
            </span>
            <span v-if="selectedAssessorIds.length > 0" class="assign-section__selected">
              已选 <strong>{{ selectedAssessorIds.length }}</strong> 人
            </span>
          </div>

          <div v-if="seniorAssessors.length + middleAssessors.length + juniorAssessors.length === 0" class="assign-empty">
            暂无测评师
          </div>

          <template v-else>
            <div v-if="seniorAssessors.length > 0" class="assign-level level--senior">
              <div class="assign-level__head">
                <span class="assign-level__name">高级</span>
                <span class="assign-level__count">{{ seniorAssessors.length }}</span>
              </div>
              <div class="assign-level__grid">
                <label
                  v-for="u in seniorAssessors"
                  :key="'as-s-'+u.id"
                  :class="['person-chip', { 'is-selected': selectedAssessorIds.includes(u.id) }]"
                >
                  <input type="checkbox" :value="u.id" v-model="selectedAssessorIds" class="person-chip__input" />
                  <span class="person-chip__check"></span>
                  <span class="person-chip__name">{{ u.displayName }}</span>
                </label>
              </div>
            </div>

            <div v-if="middleAssessors.length > 0" class="assign-level level--middle">
              <div class="assign-level__head">
                <span class="assign-level__name">中级</span>
                <span class="assign-level__count">{{ middleAssessors.length }}</span>
              </div>
              <div class="assign-level__grid">
                <label
                  v-for="u in middleAssessors"
                  :key="'as-m-'+u.id"
                  :class="['person-chip', { 'is-selected': selectedAssessorIds.includes(u.id) }]"
                >
                  <input type="checkbox" :value="u.id" v-model="selectedAssessorIds" class="person-chip__input" />
                  <span class="person-chip__check"></span>
                  <span class="person-chip__name">{{ u.displayName }}</span>
                </label>
              </div>
            </div>

            <div v-if="juniorAssessors.length > 0" class="assign-level level--junior">
              <div class="assign-level__head">
                <span class="assign-level__name">初级</span>
                <span class="assign-level__count">{{ juniorAssessors.length }}</span>
              </div>
              <div class="assign-level__grid">
                <label
                  v-for="u in juniorAssessors"
                  :key="'as-j-'+u.id"
                  :class="['person-chip', { 'is-selected': selectedAssessorIds.includes(u.id) }]"
                >
                  <input type="checkbox" :value="u.id" v-model="selectedAssessorIds" class="person-chip__input" />
                  <span class="person-chip__check"></span>
                  <span class="person-chip__name">{{ u.displayName }}</span>
                </label>
              </div>
            </div>
          </template>
        </div>

        <!-- ── 已选汇总（最终确认） ── -->
        <div v-if="hasAnyAssignSelection" class="assign-summary">
          <div class="assign-summary__title">
            <el-icon style="margin-right: 6px"><svg viewBox="0 0 1024 1024" width="14" height="14"><path d="M432 726.4 192 486.4l45.6-45.6L432 635.2l354.4-354.4L832 326.4z" fill="currentColor"/></svg></el-icon>
            已选分配清单
          </div>

          <div class="assign-summary__row">
            <span class="assign-summary__label">项目经理</span>
            <div class="assign-summary__value">
              <template v-if="selectedPmInfo">
                <span :class="['summary-chip', 'level--' + selectedPmInfo.level]">
                  <span class="summary-chip__level">{{ selectedPmInfo.levelLabel }}</span>
                  <span class="summary-chip__name">{{ selectedPmInfo.displayName }}</span>
                </span>
              </template>
              <span v-else class="assign-summary__empty">未选择</span>
            </div>
          </div>

          <div class="assign-summary__row">
            <span class="assign-summary__label">
              测评师
              <span v-if="selectedAssessorIds.length > 0" class="assign-summary__count">{{ selectedAssessorIds.length }}</span>
            </span>
            <div class="assign-summary__value">
              <template v-if="selectedAssessorIds.length > 0">
                <span v-for="u in selectedAssessorsByLevel.senior" :key="'sm-s-'+u.id" class="summary-chip level--senior">
                  <span class="summary-chip__level">高</span>
                  <span class="summary-chip__name">{{ u.displayName }}</span>
                </span>
                <span v-for="u in selectedAssessorsByLevel.middle" :key="'sm-m-'+u.id" class="summary-chip level--middle">
                  <span class="summary-chip__level">中</span>
                  <span class="summary-chip__name">{{ u.displayName }}</span>
                </span>
                <span v-for="u in selectedAssessorsByLevel.junior" :key="'sm-j-'+u.id" class="summary-chip level--junior">
                  <span class="summary-chip__level">初</span>
                  <span class="summary-chip__name">{{ u.displayName }}</span>
                </span>
              </template>
              <span v-else class="assign-summary__empty">未选择</span>
            </div>
          </div>
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

<style scoped>
/* ══════════════════════════════════════════════════════════════
 * 分配面板（DIRECTOR_REVIEW）
 * ══════════════════════════════════════════════════════════════ */
.assign-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 20px;
}

.assign-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.assign-section__head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding-bottom: 8px;
  border-bottom: 1px dashed var(--el-border-color-light);
}

.assign-section__title {
  font-weight: 600;
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.assign-section__required {
  color: var(--el-color-danger);
  margin-left: 2px;
}

.assign-section__hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-weight: normal;
}

.assign-section__selected {
  margin-left: auto;
  font-size: 12px;
  color: var(--el-color-success);
}

.assign-section__selected strong {
  font-size: 14px;
  font-weight: 700;
  margin: 0 2px;
}

.assign-empty {
  padding: 16px;
  text-align: center;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
}

/* ── 级别分组 ── */
.assign-level {
  --level-color: #909399;
  --level-bg: rgba(144, 147, 153, 0.08);
  padding: 10px 12px 12px 16px;
  border-radius: 6px;
  border-left: 3px solid var(--level-color);
  background: var(--level-bg);
}

.assign-level.level--senior {
  --level-color: #e6a23c;
  --level-bg: rgba(230, 162, 60, 0.06);
}

.assign-level.level--middle {
  --level-color: #409eff;
  --level-bg: rgba(64, 158, 255, 0.05);
}

.assign-level.level--junior {
  --level-color: #909399;
  --level-bg: rgba(144, 147, 153, 0.04);
}

.assign-level + .assign-level {
  margin-top: 10px;
}

.assign-level__head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}

.assign-level__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--level-color);
  letter-spacing: 0.5px;
}

.assign-level__count {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  background: var(--el-bg-color);
  padding: 1px 8px;
  border-radius: 10px;
  border: 1px solid var(--el-border-color-lighter);
}

.assign-level__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(108px, 1fr));
  gap: 8px;
}

/* ── 人员选择卡片 ── */
.person-chip {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  min-height: 36px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-bg-color);
  cursor: pointer;
  user-select: none;
  transition: all 0.15s ease;
}

.person-chip:hover:not(.is-selected) {
  border-color: var(--level-color, var(--el-color-primary-light-5));
  background: var(--el-color-primary-light-9);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
}

.person-chip.is-selected {
  border-color: var(--level-color, var(--el-color-primary));
  background: var(--level-color, var(--el-color-primary));
  color: #fff;
  box-shadow: 0 2px 6px color-mix(in srgb, var(--level-color, #409eff) 30%, transparent);
}

.person-chip__input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.person-chip__check {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  border: 1.5px solid var(--el-border-color-darker);
  border-radius: 3px;
  background: var(--el-bg-color);
  transition: all 0.15s ease;
  position: relative;
}

/* radio (PM) uses circular check */
.person-chip:has(input[type="radio"]) .person-chip__check {
  border-radius: 50%;
}

.person-chip.is-selected .person-chip__check {
  background: #fff;
  border-color: #fff;
}

.person-chip.is-selected .person-chip__check::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 6px;
  height: 6px;
  border-radius: inherit;
  background: var(--level-color, var(--el-color-primary));
  transform: translate(-50%, -50%);
}

/* checkbox (assessor) uses checkmark instead of dot */
.person-chip:has(input[type="checkbox"]).is-selected .person-chip__check::after {
  content: '';
  position: absolute;
  left: 3px;
  top: 0px;
  width: 5px;
  height: 9px;
  border: solid var(--level-color, var(--el-color-primary));
  border-width: 0 2px 2px 0;
  background: transparent;
  border-radius: 0;
  transform: rotate(45deg);
}

.person-chip__name {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 移动端响应 */
@media (max-width: 640px) {
  .assign-level__grid {
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  }
  .person-chip__name {
    font-size: 12px;
  }
}

/* ══════════════════════════════════════════════════════════════
 * 已选汇总面板（底部确认）
 * ══════════════════════════════════════════════════════════════ */
.assign-summary {
  margin-top: 4px;
  padding: 14px 16px;
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.04) 0%, rgba(103, 194, 58, 0.04) 100%);
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: 8px;
  position: relative;
}

.assign-summary::before {
  content: '';
  position: absolute;
  left: -1px;
  top: -1px;
  bottom: -1px;
  width: 3px;
  background: linear-gradient(180deg, var(--el-color-primary) 0%, var(--el-color-success) 100%);
  border-radius: 8px 0 0 8px;
}

.assign-summary__title {
  display: flex;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-color-primary);
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px dashed var(--el-color-primary-light-5);
}

.assign-summary__row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 6px 0;
}

.assign-summary__row + .assign-summary__row {
  border-top: 1px dashed var(--el-border-color-extra-light);
  margin-top: 2px;
  padding-top: 8px;
}

.assign-summary__label {
  flex-shrink: 0;
  min-width: 72px;
  padding-top: 3px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-regular);
  display: flex;
  align-items: center;
  gap: 6px;
}

.assign-summary__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  background: var(--el-color-success);
  border-radius: 10px;
}

.assign-summary__value {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 28px;
}

.assign-summary__empty {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
  padding: 4px 0;
}

/* 汇总中的小 chip */
.summary-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px 3px 4px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 14px;
  font-size: 12px;
  line-height: 1.4;
  transition: all 0.15s ease;
}

.summary-chip:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
}

.summary-chip__level {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 20px;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  border-radius: 10px;
  letter-spacing: 0.5px;
}

.summary-chip__name {
  color: var(--el-text-color-primary);
  font-weight: 500;
}

/* 级别染色 */
.summary-chip.level--senior { border-color: #e6a23c; }
.summary-chip.level--senior .summary-chip__level { background: #e6a23c; }

.summary-chip.level--middle { border-color: #409eff; }
.summary-chip.level--middle .summary-chip__level { background: #409eff; }

.summary-chip.level--junior { border-color: #909399; }
.summary-chip.level--junior .summary-chip__level { background: #909399; }
</style>
