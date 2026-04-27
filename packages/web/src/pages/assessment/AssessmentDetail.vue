<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import {
  getAssessmentProjectDetail,
  getReviewStatus,
  initiateQualityReview,
  resubmitAssessmentResult,
} from '@/api/assessment'
import { getInstanceByBiz } from '@/api/workflow'
import type { ProjectDetailForAssessment, ReviewStatus } from '@/api/assessment'
import { useAuthStore } from '@/stores/auth'
import { getStatusLabel } from '@/utils/status-map'
import { formatTime } from '@/utils/format'
import { SERVICE_CONTENT_TAG_TYPE } from '@/utils/enums'
import { getSystemItems, type EnrichedSystemItem } from '@/api/project'
import { getFileList, getFileDownloadPath, getFilePreviewPath, type FileItem } from '@/api/file'
import FilePoolPanel from '@/components/FilePoolPanel.vue'
import ReviewOpinionHistory from '@/components/ReviewOpinionHistory.vue'
import SystemItemDetailDialog from '@/components/SystemItemDetailDialog.vue'
import { useOperableTasks } from '@/composables/useOperableTasks'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const projectRegisterId = Number(route.params.projectRegisterId)

const project = ref<ProjectDetailForAssessment | null>(null)
const reviewStatus = ref<ReviewStatus | null>(null)
const workflowInstance = ref<any>(null)
const loading = ref(true)
const resubmitting = ref(false)

// System item detail dialog
const siDialogVisible = ref(false)
const siDialogItem = ref<EnrichedSystemItem | null>(null)
const systemItemsWithFiles = ref<EnrichedSystemItem[]>([])

async function loadSystemItemsWithFiles() {
  try {
    systemItemsWithFiles.value = await getSystemItems(projectRegisterId)
  } catch { systemItemsWithFiles.value = [] }
}

// ── 合同归档扫描件（仅合同归档时加载）──
const contractScanFiles = ref<FileItem[]>([])
async function loadContractScanFiles(contractId: number | null | undefined) {
  if (!contractId) { contractScanFiles.value = []; return }
  try {
    contractScanFiles.value = (await getFileList('CONTRACT_SCAN', contractId)) as any as FileItem[]
  } catch { contractScanFiles.value = [] }
}

// ── File preview (opens in new tab; backend applies watermark) ──
const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
function canPreviewByName(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return imageExts.some((e) => lower.endsWith(e)) || lower.endsWith('.pdf')
}
function openFilePreview(fileId: number, fileName: string) {
  if (!canPreviewByName(fileName)) {
    window.open(getFileDownloadPath(fileId), '_blank')
    return
  }
  window.open(getFilePreviewPath(fileId), '_blank')
}
function formatFileSize(bytes: number): string {
  if (!bytes) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function showSiDetail(row: EnrichedSystemItem) {
  const enriched = systemItemsWithFiles.value.find((i) => i.id === row.id) || row
  siDialogItem.value = enriched
  siDialogVisible.value = true
}

const isPM = computed(() => {
  if (!project.value) return false
  return project.value.members.some(
    (m) => m.userId === authStore.user?.id && m.roleType === 'PM',
  )
})

const isMember = computed(() => {
  if (!project.value) return false
  return project.value.members.some((m) => m.userId === authStore.user?.id)
})

const currentNode = computed(() => {
  const inst = workflowInstance.value
  return inst?.currentNode || inst?.instance?.currentNode || ''
})

const isAtAssessmentNode = computed(() => currentNode.value === 'ON_SITE_ASSESSMENT')

const isAtReviewNode = computed(() =>
  ['TECH_REVIEW', 'CONTENT_REVIEW', 'REPORT_ASSIGN', 'REPORT_COMPILE', 'FINAL_REVIEW'].includes(currentNode.value),
)

// Check if any task at the current node is PENDING_RECTIFICATION
const isPendingRectification = computed(() => {
  const inst = workflowInstance.value
  const tasks = inst?.tasks || inst?.instance?.tasks || []
  return tasks.some((t: any) => t.status === 'PENDING_RECTIFICATION')
})

const pmName = computed(() => {
  if (!project.value) return '-'
  const pm = project.value.members.find((m) => m.roleType === 'PM')
  return pm?.displayName || '-'
})

const assessors = computed(() => {
  if (!project.value) return []
  return project.value.members
    .filter((m) => m.roleType === 'ASSESSOR')
    .map((m) => m.displayName)
})

async function fetchData() {
  loading.value = true
  try {
    const [proj, review, instance] = await Promise.all([
      getAssessmentProjectDetail(projectRegisterId),
      getReviewStatus(projectRegisterId).catch(() => null),
      getInstanceByBiz('PROJECT_REGISTER', projectRegisterId).catch(() => null),
    ])
    project.value = proj
    reviewStatus.value = review
    workflowInstance.value = instance
  } finally {
    loading.value = false
  }
  loadSystemItemsWithFiles()
  // Only fetch contract archive scans if contract has been archived
  // (saves a roundtrip for fully un-archived contracts)
  const archiveStatus = project.value?.contractArchiveStatus
  if (archiveStatus === 'ARCHIVED' || archiveStatus === 'PARTIAL_ARCHIVE') {
    loadContractScanFiles(project.value?.contractId)
  }
}

// 测评相关操作完成后刷新 my-tasks,让各列表行的操作按钮立即反映最新状态
const { refresh: refreshMyTasks } = useOperableTasks()

async function handleInitiateReview() {
  try {
    await ElMessageBox.confirm('确定发起质量审核？', '发起质量审核')
    await initiateQualityReview(projectRegisterId)
    ElMessage.success('质量审核已发起')
    await refreshMyTasks()
    fetchData()
  } catch { /* cancelled */ }
}

async function handleResubmit() {
  try {
    await ElMessageBox.confirm('确认重新提交测评成果？审核人将重新审核。', '重新提交')
    resubmitting.value = true
    await resubmitAssessmentResult(projectRegisterId)
    ElMessage.success('已重新提交，审核人将重新审核')
    await refreshMyTasks()
    fetchData()
  } catch { /* cancelled or error */ }
  finally { resubmitting.value = false }
}


// Display round: if currently at ON_SITE_ASSESSMENT with roundNo>1, the new round hasn't started yet
const displayRoundNo = computed(() => {
  const rs = reviewStatus.value as any
  if (!rs) return 1
  const round = rs.roundNo ?? 1
  if (currentNode.value === 'ON_SITE_ASSESSMENT' && round > 1) return round - 1
  return round
})

const hasAnyReviewData = computed(() => {
  if (!reviewStatus.value) return false
  const rs = reviewStatus.value as any
  return (rs.techReview?.length > 0 || rs.contentReview?.length > 0 ||
    rs.reportAssign?.length > 0 || rs.reportCompile?.length > 0 || rs.finalReview?.length > 0)
})

function filterCurrentRound(tasks: any[]): any[] {
  // Filter out CANCELLED tasks (from previous rounds)
  return tasks.filter((t: any) => t.status !== 'CANCELLED')
}

function getTaskTagType(row: any): 'primary' | 'success' | 'info' | 'warning' | 'danger' {
  if (row.status === 'COMPLETED') return row.result === 'APPROVED' ? 'success' : 'danger'
  if (row.status === 'PENDING_RECTIFICATION') return 'warning'
  if (row.status === 'PENDING') return 'warning'
  return 'info'
}

function getTaskStatusLabel(row: any): string {
  if (row.status === 'COMPLETED') {
    if (row.result === 'APPROVED') return '通过'
    if (row.result === 'REJECTED') return '驳回'
    if (row.result === 'SUBMITTED') return '已提交'
    if (row.result === 'REVIEW') return '复核'
    return row.result || '已完成'
  }
  if (row.status === 'PENDING_RECTIFICATION') return '待整改'
  if (row.status === 'PENDING') return '待处理'
  return row.status
}

function getSlotLabel(slotKey: string): string {
  const map: Record<string, string> = {
    TECH: '整体技术审核',
    CONTENT_A: '内容审核（技术）',
    CONTENT_B: '内容审核（管理）',
    CONTENT_C: '内容审核（网络）',
  }
  return map[slotKey] || slotKey
}

onMounted(fetchData)
</script>

<template>
  <div class="n-page-container" v-loading="loading">
    <div class="n-page-header" style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px">
      <el-button :icon="ArrowLeft" @click="router.back()">返回</el-button>
      <h2 class="n-page-title" style="margin: 0">测评详情</h2>
    </div>

    <!-- Project Detail -->
    <el-card shadow="never" style="margin-bottom: 16px" v-if="project">
      <template #header>
        <span style="font-weight: 600">项目信息</span>
      </template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="项目名称">{{ project.applicationName }}</el-descriptions-item>
        <el-descriptions-item label="客户名称">{{ project.customerName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="服务年度">{{ project.contractYear }}年</el-descriptions-item>
        <el-descriptions-item label="项目状态">
          <el-tag size="small">{{ getStatusLabel(project.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="项目经理">{{ pmName }}</el-descriptions-item>
        <el-descriptions-item label="测评师">
          {{ assessors.length > 0 ? assessors.join('、') : '-' }}
        </el-descriptions-item>
      </el-descriptions>

      <!-- System Items -->
      <div style="margin-top: 16px">
        <h4 style="margin-bottom: 8px">系统明细</h4>
        <el-table :data="project.systemItems" stripe border size="small">
          <el-table-column type="index" label="#" width="50" />
          <el-table-column prop="systemNo" label="项目编号" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">{{ row.systemNo || '--' }}</template>
          </el-table-column>
          <el-table-column prop="systemName" label="系统名称" min-width="150" show-overflow-tooltip />
          <el-table-column label="安全等级" width="100" align="center">
            <template #default="{ row }">
              {{ row.securityLevel || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="assessedUnitName" label="被测单位" min-width="150" show-overflow-tooltip />
          <el-table-column prop="filingAgency" label="备案单位" min-width="120" show-overflow-tooltip />
          <el-table-column prop="filingCertificateNo" label="备案证明编号" width="150" show-overflow-tooltip />
          <el-table-column label="操作" width="80" align="center">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="showSiDetail(row)">详情</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>

    <!-- 关联合同信息 -->
    <el-card v-if="project" shadow="never" style="margin-bottom: 16px">
      <template #header>
        <span style="font-weight: 600">关联合同信息</span>
      </template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="合同编号">{{ project.contractNo || '--' }}</el-descriptions-item>
        <el-descriptions-item label="合同名称">{{ project.contractName || '--' }}</el-descriptions-item>
        <el-descriptions-item label="客户名称">{{ project.customerName || '--' }}</el-descriptions-item>
        <el-descriptions-item label="统一信用代码">{{ project.customerUscc || '--' }}</el-descriptions-item>
        <el-descriptions-item label="联系人">{{ project.contactName || '--' }}</el-descriptions-item>
        <el-descriptions-item label="联系电话">{{ project.contactPhone || '--' }}</el-descriptions-item>
        <el-descriptions-item label="服务内容">
          <el-tag v-if="project.serviceContent" :type="SERVICE_CONTENT_TAG_TYPE[project.serviceContent] || 'info'" size="small">
            {{ project.serviceContent }}
          </el-tag>
          <span v-else>--</span>
        </el-descriptions-item>
        <el-descriptions-item label="合同类型">{{ project.contractType || '--' }}</el-descriptions-item>
        <el-descriptions-item label="签单销售">{{ project.salesPersonName || '--' }}</el-descriptions-item>
        <el-descriptions-item label="合作方">{{ project.partnerName || '--' }}</el-descriptions-item>
        <el-descriptions-item label="服务年份">{{ (project.serviceYears || []).map((y: number) => y + '年').join('、') || '--' }}</el-descriptions-item>
        <el-descriptions-item label="合同金额">{{ project.paymentAmount ? '¥' + Number(project.paymentAmount).toLocaleString() : '--' }}</el-descriptions-item>
        <template v-if="project.contractArchiveStatus === 'ARCHIVED' || project.contractArchiveStatus === 'PARTIAL_ARCHIVE'">
          <el-descriptions-item label="归档状态">
            <el-tag :type="project.contractArchiveStatus === 'ARCHIVED' ? 'success' : 'warning'" size="small">
              {{ project.contractArchiveStatus === 'ARCHIVED' ? '已归档' : '部分归档' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="归档人">{{ project.contractArchivedByName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="归档时间" :span="2">{{ project.contractArchivedAt ? formatTime(project.contractArchivedAt) : '--' }}</el-descriptions-item>
        </template>
      </el-descriptions>

      <!-- 合同归档扫描件（仅合同归档时有数据） -->
      <div v-if="contractScanFiles.length > 0" style="margin-top: 16px">
        <h4 style="margin: 0 0 8px; font-size: 14px; color: #606266">合同归档扫描件</h4>
        <div style="display: flex; flex-direction: column; gap: 4px">
          <div
            v-for="f in contractScanFiles"
            :key="'cs-' + f.id"
            style="display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: #fafafa; border-radius: 4px"
          >
            <el-link type="primary" :underline="false" @click="openFilePreview(f.id, f.fileName)">{{ f.fileName }}</el-link>
            <span style="color: #909399; font-size: 12px">{{ formatFileSize(f.fileSize) }}</span>
            <span style="color: #909399; font-size: 12px; margin-left: auto">{{ f.uploaderName || '--' }} · {{ formatTime(f.uploadedAt) }}</span>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 测评文件池 -->
    <el-card shadow="never" style="margin-bottom: 16px">
      <template #header>
        <div style="display: flex; align-items: center; justify-content: space-between">
          <span style="font-weight: 600">测评文件</span>
          <el-button
            v-if="isPM && isAtAssessmentNode"
            type="success"
            size="small"
            @click="handleInitiateReview"
          >
            发起质量审核
          </el-button>
        </div>
      </template>
      <FilePoolPanel
        api-type="assessment"
        :project-register-id="projectRegisterId"
        file-pool="ASSESSMENT_FILE"
        :readonly="!isMember || isAtReviewNode"
      />
    </el-card>

    <!-- 测评成果池 -->
    <el-card shadow="never" style="margin-bottom: 16px">
      <template #header>
        <div style="display: flex; align-items: center; justify-content: space-between">
          <span style="font-weight: 600">测评成果</span>
          <div v-if="isPM && isPendingRectification" style="display: flex; align-items: center; gap: 8px">
            <el-tag type="warning" effect="dark">待整改</el-tag>
            <el-button
              type="primary"
              size="small"
              :loading="resubmitting"
              @click="handleResubmit"
            >
              重新提交
            </el-button>
          </div>
        </div>
      </template>
      <FilePoolPanel
        api-type="assessment"
        :project-register-id="projectRegisterId"
        file-pool="ASSESSMENT_RESULT"
        :readonly="!isPM || (isAtReviewNode && !isPendingRectification)"
      />
    </el-card>

    <!-- 审核意见历史 -->
    <el-card v-if="isAtReviewNode || isPendingRectification" shadow="never" style="margin-bottom: 16px">
      <template #header>
        <span style="font-weight: 600">审核意见历史</span>
      </template>
      <ReviewOpinionHistory :project-register-id="projectRegisterId" />
    </el-card>

    <!-- Quality Review Status (all review nodes) -->
    <el-card v-if="reviewStatus && hasAnyReviewData" shadow="never" style="margin-bottom: 16px">
      <template #header>
        <div style="display: flex; align-items: center; gap: 8px">
          <span style="font-weight: 600">质量审核状态</span>
          <el-tag v-if="displayRoundNo > 1" type="info" size="small">第 {{ displayRoundNo }} 轮</el-tag>
        </div>
      </template>

      <!-- Tech Review -->
      <div v-if="(reviewStatus as any).techReview?.length > 0">
        <h4 style="margin: 0 0 8px; font-size: 14px; color: #606266">技术审核</h4>
        <el-table :data="filterCurrentRound((reviewStatus as any).techReview)" border size="small" stripe>
          <el-table-column prop="assigneeName" label="审核人" min-width="120" />
          <el-table-column label="状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="getTaskTagType(row)" size="small">{{ getTaskStatusLabel(row) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="意见" min-width="200" show-overflow-tooltip />
          <el-table-column label="完成时间" min-width="170">
            <template #default="{ row }">{{ formatTime(row.completedAt) }}</template>
          </el-table-column>
        </el-table>
      </div>

      <!-- Content Review -->
      <div v-if="(reviewStatus as any).contentReview?.length > 0" style="margin-top: 16px">
        <h4 style="margin: 0 0 8px; font-size: 14px; color: #606266">内容审核（三路并行）</h4>
        <el-table :data="filterCurrentRound((reviewStatus as any).contentReview)" border size="small" stripe>
          <el-table-column label="审核项" min-width="150">
            <template #default="{ row }">{{ getSlotLabel(row.slotKey) }}</template>
          </el-table-column>
          <el-table-column prop="assigneeName" label="审核人" min-width="100" />
          <el-table-column label="状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="getTaskTagType(row)" size="small">{{ getTaskStatusLabel(row) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="意见" min-width="200" show-overflow-tooltip />
          <el-table-column label="完成时间" min-width="170">
            <template #default="{ row }">{{ formatTime(row.completedAt) }}</template>
          </el-table-column>
        </el-table>
      </div>

      <!-- Report Assign -->
      <div v-if="(reviewStatus as any).reportAssign?.length > 0" style="margin-top: 16px">
        <h4 style="margin: 0 0 8px; font-size: 14px; color: #606266">报告编制分配</h4>
        <el-table :data="filterCurrentRound((reviewStatus as any).reportAssign)" border size="small" stripe>
          <el-table-column prop="assigneeName" label="分配人" min-width="120" />
          <el-table-column label="状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="getTaskTagType(row)" size="small">{{ getTaskStatusLabel(row) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="意见" min-width="200" show-overflow-tooltip />
          <el-table-column label="完成时间" min-width="170">
            <template #default="{ row }">{{ formatTime(row.completedAt) }}</template>
          </el-table-column>
        </el-table>
      </div>

      <!-- Report Compile -->
      <div v-if="(reviewStatus as any).reportCompile?.length > 0" style="margin-top: 16px">
        <h4 style="margin: 0 0 8px; font-size: 14px; color: #606266">报告编制</h4>
        <el-table :data="filterCurrentRound((reviewStatus as any).reportCompile)" border size="small" stripe>
          <el-table-column prop="assigneeName" label="编制人" min-width="120" />
          <el-table-column label="状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="getTaskTagType(row)" size="small">{{ getTaskStatusLabel(row) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="意见" min-width="200" show-overflow-tooltip />
          <el-table-column label="完成时间" min-width="170">
            <template #default="{ row }">{{ formatTime(row.completedAt) }}</template>
          </el-table-column>
        </el-table>
      </div>

      <!-- Final Review -->
      <div v-if="(reviewStatus as any).finalReview?.length > 0" style="margin-top: 16px">
        <h4 style="margin: 0 0 8px; font-size: 14px; color: #606266">最终审核</h4>
        <el-table :data="filterCurrentRound((reviewStatus as any).finalReview)" border size="small" stripe>
          <el-table-column prop="assigneeName" label="审核人" min-width="120" />
          <el-table-column label="状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="getTaskTagType(row)" size="small">{{ getTaskStatusLabel(row) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="意见" min-width="200" show-overflow-tooltip />
          <el-table-column label="完成时间" min-width="170">
            <template #default="{ row }">{{ formatTime(row.completedAt) }}</template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>

    <!-- Workflow Timeline -->
    <el-card shadow="never" v-if="(workflowInstance as any)?.actionLogs?.length">
      <template #header>
        <span style="font-weight: 600">流程记录</span>
      </template>
      <el-timeline>
        <el-timeline-item
          v-for="log in ((workflowInstance as any)?.actionLogs || [])"
          :key="log.id"
          :timestamp="formatTime(log.createdAt)"
          placement="top"
        >
          <div>
            <el-tag
              :type="log.action === 'APPROVE' ? 'success' : log.action === 'REJECT' ? 'danger' : 'primary'"
              size="small"
            >
              {{ getStatusLabel(log.action) }}
            </el-tag>
            <span style="margin-left: 8px; font-size: 13px">
              {{ log.operatorName || '系统' }} — {{ getStatusLabel(log.nodeKey) }}
            </span>
          </div>
          <div v-if="log.remark" style="font-size: 12px; color: #909399; margin-top: 4px">{{ log.remark }}</div>
        </el-timeline-item>
      </el-timeline>
    </el-card>

    <SystemItemDetailDialog v-model:visible="siDialogVisible" :item="siDialogItem" />
  </div>
</template>
