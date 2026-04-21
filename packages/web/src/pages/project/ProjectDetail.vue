<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Edit, Download, Paperclip } from '@element-plus/icons-vue'
import { getStatusLabel, getStatusTagType } from '@/utils/status-map'
import { formatTime } from '@/utils/format'
import { getProjectDetail, getSystemItems } from '@/api/project'
import type { ProjectDetail as ProjectDetailType, ProjectMember } from '@/api/project'
import { getInstanceByBiz } from '@/api/workflow'
import type { InstanceDetail, TaskItem } from '@/api/workflow'
import { getFileDownloadPath, getFilePreviewPath, getFileList, type FileItem } from '@/api/file'
import { useAuthStore } from '@/stores/auth'
import RejectReasonPanel from '@/components/RejectReasonPanel.vue'
import SystemItemDetailDialog from '@/components/SystemItemDetailDialog.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const loading = ref(false)
const project = ref<ProjectDetailType | null>(null)
const workflowInstance = ref<InstanceDetail | null>(null)

// 合同附件（附件 + 附件说明 + 归档扫描件）
const contractFiles = ref<FileItem[]>([])
const contractDescFiles = ref<FileItem[]>([])
const contractScanFiles = ref<FileItem[]>([])

async function loadContractAttachments(contractId: number) {
  try { contractFiles.value = (await getFileList('CONTRACT', contractId)) as any as FileItem[] }
  catch { contractFiles.value = [] }
  try { contractDescFiles.value = (await getFileList('CONTRACT_DESC', contractId)) as any as FileItem[] }
  catch { contractDescFiles.value = [] }
  try { contractScanFiles.value = (await getFileList('CONTRACT_SCAN', contractId)) as any as FileItem[] }
  catch { contractScanFiles.value = [] }
}

// System items with file info
const systemItemsEnriched = ref<any[]>([])


const roleTypeLabel: Record<string, string> = {
  PM: '项目经理',
  ASSESSOR: '测评师',
  REPORT_WRITER: '报告编制人',
}

const roleTypeTagType: Record<string, 'primary' | 'success' | 'warning' | 'info'> = {
  PM: 'primary',
  ASSESSOR: 'success',
  REPORT_WRITER: 'warning',
}

const actionLabel: Record<string, string> = {
  SUBMIT: '提交',
  APPROVE: '通过',
  REJECT: '驳回',
}

const actionTimelineType: Record<string, '' | 'primary' | 'success' | 'warning' | 'danger' | 'info'> = {
  SUBMIT: 'primary',
  APPROVE: 'success',
  REJECT: 'danger',
}

async function fetchDetail() {
  const id = Number(route.params.id)
  if (!id) return
  loading.value = true
  try {
    project.value = (await getProjectDetail(id)) as unknown as ProjectDetailType
    await fetchWorkflow()
    // Load system items with files
    try {
      systemItemsEnriched.value = (await getSystemItems(id)) as any[]
    } catch {
      systemItemsEnriched.value = project.value.systemItems || []
    }
    // Load contract attachments
    if (project.value?.contractId) {
      await loadContractAttachments(project.value.contractId)
    }
  } finally {
    loading.value = false
  }
}

async function fetchWorkflow() {
  const id = Number(route.params.id)
  if (!id) return
  try {
    workflowInstance.value = (await getInstanceByBiz('PROJECT', id)) as unknown as InstanceDetail
  } catch {
    workflowInstance.value = null
  }
}

function getPendingTask(): TaskItem | null {
  if (!workflowInstance.value) return null
  return workflowInstance.value.tasks.find((t) => t.status === 'PENDING') || null
}

// 审批跳转到 TaskDetail 页面（统一入口）
function handleApproveReject() {
  const task = getPendingTask()
  if (task) {
    router.push(`/workflow/task/${task.id}`)
  }
}

function handleBack() {
  router.back()
}

function handleEdit() {
  if (project.value) {
    router.push(`/project/${project.value.id}/edit`)
  }
}

function canEdit() {
  if (!project.value) return false
  return project.value.status === 'DRAFT' || project.value.status === 'REJECTED'
}

function openFileDownload(fileId: number) {
  window.open(getFileDownloadPath(fileId), '_blank')
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
    openFileDownload(fileId)
    return
  }
  window.open(getFilePreviewPath(fileId), '_blank')
}

function formatFileSize(bytes: number) {
  if (!bytes) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

onMounted(() => {
  fetchDetail()
})
</script>

<template>
  <div v-loading="loading">
    <el-card shadow="never">
      <template #header>
        <div style="display: flex; align-items: center; justify-content: space-between">
          <div style="display: flex; align-items: center; gap: 12px">
            <el-button :icon="ArrowLeft" text @click="handleBack">返回</el-button>
            <span style="font-weight: 600; font-size: 16px">项目详情</span>
          </div>
          <el-button
            v-if="canEdit()"
            v-permission="'project:update'"
            type="primary"
            :icon="Edit"
            @click="handleEdit"
          >
            编辑
          </el-button>
        </div>
      </template>

      <RejectReasonPanel v-if="project?.status === 'REJECTED'" biz-type="PROJECT_REGISTER" :biz-id="project.id" />

      <template v-if="project">
        <!-- 基本信息 -->
        <el-descriptions :column="2" border>
          <el-descriptions-item label="申请单名称">{{ project.applicationName }}</el-descriptions-item>
          <el-descriptions-item label="申请单编号">{{ project.applicationNo || '--' }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStatusTagType(project.status)" size="small">
              {{ getStatusLabel(project.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="合同年度">{{ project.contractYear }}年</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ project.createdAt }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ project.remark || '--' }}</el-descriptions-item>
        </el-descriptions>

        <!-- 关联合同信息 -->
        <h4 style="margin: 24px 0 12px; font-size: 15px; font-weight: 600">关联合同信息</h4>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="合同编号">{{ (project as any).contractNo || '--' }}</el-descriptions-item>
          <el-descriptions-item label="合同名称">{{ project.contractName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="客户名称">{{ (project as any).customerName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="统一信用代码">{{ (project as any).customerUscc || '--' }}</el-descriptions-item>
          <el-descriptions-item label="联系人">{{ (project as any).contactName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="联系电话">{{ (project as any).contactPhone || '--' }}</el-descriptions-item>
          <el-descriptions-item label="服务内容">{{ (project as any).serviceContent || '--' }}</el-descriptions-item>
          <el-descriptions-item label="合同类型">{{ (project as any).contractType || '--' }}</el-descriptions-item>
          <el-descriptions-item label="签单销售">{{ (project as any).salesPersonName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="合作方">{{ (project as any).partnerName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="服务年份">{{ ((project as any).serviceYears || []).map((y: number) => y + '年').join('、') || '--' }}</el-descriptions-item>
          <el-descriptions-item label="合同金额">{{ (project as any).paymentAmount ? `¥${Number((project as any).paymentAmount).toLocaleString()}` : '--' }}</el-descriptions-item>
          <template v-if="(project as any).contractArchiveStatus === 'ARCHIVED' || (project as any).contractArchiveStatus === 'PARTIAL_ARCHIVE'">
            <el-descriptions-item label="归档状态">
              <el-tag :type="(project as any).contractArchiveStatus === 'ARCHIVED' ? 'success' : 'warning'" size="small">
                {{ (project as any).contractArchiveStatus === 'ARCHIVED' ? '已归档' : '部分归档' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="归档人">{{ (project as any).contractArchivedByName || '--' }}</el-descriptions-item>
            <el-descriptions-item label="归档时间" :span="2">{{ (project as any).contractArchivedAt ? formatTime((project as any).contractArchivedAt) : '--' }}</el-descriptions-item>
          </template>
        </el-descriptions>

        <!-- 关联合同附件 -->
        <div v-if="contractFiles.length > 0 || contractDescFiles.length > 0 || contractScanFiles.length > 0" style="margin-top: 16px">
          <h4 style="margin: 0 0 8px; font-size: 14px; color: #606266">关联合同附件</h4>
          <div v-if="contractFiles.length > 0" style="margin-bottom: 12px">
            <div style="font-size: 12px; color: #909399; margin-bottom: 4px">合同文件</div>
            <div style="display: flex; flex-direction: column; gap: 4px">
              <div v-for="f in contractFiles" :key="'cf-'+f.id" style="display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: #fafafa; border-radius: 4px">
                <el-link type="primary" :underline="false" @click="openFilePreview(f.id, f.fileName)">{{ f.fileName }}</el-link>
                <span style="color: #909399; font-size: 12px">{{ formatFileSize(f.fileSize) }}</span>
                <span style="color: #909399; font-size: 12px; margin-left: auto">{{ f.uploaderName || '--' }} · {{ formatTime(f.uploadedAt) }}</span>
              </div>
            </div>
          </div>
          <div v-if="contractDescFiles.length > 0" style="margin-bottom: 12px">
            <div style="font-size: 12px; color: #909399; margin-bottom: 4px">合同附件说明</div>
            <div style="display: flex; flex-direction: column; gap: 4px">
              <div v-for="f in contractDescFiles" :key="'cd-'+f.id" style="display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: #fafafa; border-radius: 4px">
                <el-link type="primary" :underline="false" @click="openFilePreview(f.id, f.fileName)">{{ f.fileName }}</el-link>
                <span style="color: #909399; font-size: 12px">{{ formatFileSize(f.fileSize) }}</span>
                <span style="color: #909399; font-size: 12px; margin-left: auto">{{ f.uploaderName || '--' }} · {{ formatTime(f.uploadedAt) }}</span>
              </div>
            </div>
          </div>
          <!-- 合同归档扫描件（仅合同归档时有数据） -->
          <div v-if="contractScanFiles.length > 0">
            <div style="font-size: 12px; color: #909399; margin-bottom: 4px">合同归档扫描件</div>
            <div style="display: flex; flex-direction: column; gap: 4px">
              <div v-for="f in contractScanFiles" :key="'cs-'+f.id" style="display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: #fafafa; border-radius: 4px">
                <el-link type="primary" :underline="false" @click="openFilePreview(f.id, f.fileName)">{{ f.fileName }}</el-link>
                <span style="color: #909399; font-size: 12px">{{ formatFileSize(f.fileSize) }}</span>
                <span style="color: #909399; font-size: 12px; margin-left: auto">{{ f.uploaderName || '--' }} · {{ formatTime(f.uploadedAt) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 系统明细 -->
        <div v-if="systemItemsEnriched.length > 0" style="margin-top: 24px">
          <h3 style="margin-bottom: 12px; font-size: 15px; font-weight: 600">系统明细（{{ systemItemsEnriched.length }} 个）</h3>
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
        <div style="margin-top: 24px">
          <h3 style="margin: 0 0 12px; font-size: 15px; font-weight: 600">项目成员</h3>
          <el-table
            v-if="project.members && project.members.length > 0"
            :data="project.members"
            stripe
            border
            style="width: 100%"
          >
            <el-table-column prop="displayName" label="姓名" min-width="120" />
            <el-table-column label="角色" min-width="120" align="center">
              <template #default="{ row }">
                <el-tag :type="roleTypeTagType[row.roleType] || 'info'" size="small">
                  {{ roleTypeLabel[row.roleType] || row.roleType }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="状态" min-width="100" align="center">
              <template #default="{ row }">
                <el-tag :type="getStatusTagType(row.status)" size="small">{{ getStatusLabel(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="分配时间" min-width="170">
              <template #default="{ row }">{{ row.assignedAt || '--' }}</template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="暂无项目成员" :image-size="60" />
        </div>

        <!-- 审批流程 -->
        <div v-if="workflowInstance" style="margin-top: 24px">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px">
            <h3 style="margin: 0; font-size: 15px; font-weight: 600">审批流程</h3>
            <el-button v-if="getPendingTask()" type="primary" size="small" @click="handleApproveReject">审批</el-button>
          </div>
          <el-timeline>
            <el-timeline-item
              v-for="log in workflowInstance.actionLogs"
              :key="log.id"
              :type="actionTimelineType[log.action] || 'info'"
              :timestamp="formatTime(log.createdAt)"
              placement="top"
            >
              <div>
                <span style="font-weight: 500">{{ log.operatorName }}</span>
                <el-tag :type="actionTimelineType[log.action] || 'info'" size="small" style="margin-left: 8px">
                  {{ actionLabel[log.action] || log.action }}
                </el-tag>
              </div>
              <div v-if="log.remark" style="color: #909399; margin-top: 4px; font-size: 13px">{{ log.remark }}</div>
            </el-timeline-item>
          </el-timeline>
          <el-empty v-if="workflowInstance.actionLogs.length === 0" description="暂无审批记录" :image-size="80" />
        </div>
      </template>
    </el-card>

    <SystemItemDetailDialog v-model:visible="siDialogVisible" :item="siDialogItem" />
  </div>
</template>
