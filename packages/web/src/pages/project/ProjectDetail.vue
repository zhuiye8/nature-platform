<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Edit, Download } from '@element-plus/icons-vue'
import { getStatusLabel, getStatusTagType } from '@/utils/status-map'
import { formatTime } from '@/utils/format'
import { getProjectDetail, getSystemItems } from '@/api/project'
import type { ProjectDetail as ProjectDetailType, ProjectMember } from '@/api/project'
import { getInstanceByBiz } from '@/api/workflow'
import type { InstanceDetail, TaskItem } from '@/api/workflow'
import { getFileDownloadPath, getFilePreviewPath } from '@/api/file'
import { useAuthStore } from '@/stores/auth'
import TaskActionDialog from '@/components/TaskActionDialog.vue'
import RejectReasonPanel from '@/components/RejectReasonPanel.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const loading = ref(false)
const project = ref<ProjectDetailType | null>(null)
const workflowInstance = ref<InstanceDetail | null>(null)
const dialogVisible = ref(false)
const currentTask = ref<TaskItem | null>(null)

// System items with file info
const systemItemsEnriched = ref<any[]>([])

const statusLabel: Record<string, string> = {
  DRAFT: '草稿',
  SUBMITTED: '已提交',
  APPROVED: '已通过',
  REJECTED: '已驳回',
}

const statusTagType: Record<string, 'info' | 'warning' | 'success' | 'danger'> = {
  DRAFT: 'info',
  SUBMITTED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
}

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

function handleApproveReject() {
  const task = getPendingTask()
  if (task) {
    currentTask.value = task
    dialogVisible.value = true
  }
}

function handleTaskCompleted() {
  fetchDetail()
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

// ── File preview dialog ──
const previewVisible = ref(false)
const previewUrl = ref('')
const previewFileName = ref('')
const previewFileId = ref(0)
const previewType = ref<'image' | 'pdf' | 'none'>('none')

const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
function getPreviewType(fileName: string): 'image' | 'pdf' | 'none' {
  const lower = fileName.toLowerCase()
  if (imageExts.some((e) => lower.endsWith(e))) return 'image'
  if (lower.endsWith('.pdf')) return 'pdf'
  return 'none'
}

function openFilePreview(fileId: number, fileName: string) {
  const type = getPreviewType(fileName)
  if (type === 'none') {
    openFileDownload(fileId)
    return
  }
  previewType.value = type
  previewUrl.value = getFilePreviewPath(fileId)
  previewFileName.value = fileName
  previewFileId.value = fileId
  previewVisible.value = true
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
            <el-tag :type="statusTagType[project.status] || 'info'" size="small">
              {{ statusLabel[project.status] || project.status }}
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
        </el-descriptions>

        <!-- 系统明细 -->
        <div v-if="systemItemsEnriched.length > 0" style="margin-top: 24px">
          <h3 style="margin-bottom: 12px; font-size: 15px; font-weight: 600">系统明细（{{ systemItemsEnriched.length }} 个）</h3>
          <el-card
            v-for="(si, idx) in systemItemsEnriched"
            :key="si.id || idx"
            shadow="never"
            style="margin-bottom: 12px; border: 1px solid var(--el-border-color-lighter)"
          >
            <template #header>
              <span style="font-weight: 600">{{ si.systemName }}{{ si.securityLevel ? '（' + si.securityLevel + '）' : '' }}</span>
            </template>

            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="备案机关">{{ si.filingAgency || '--' }}</el-descriptions-item>
              <el-descriptions-item label="安全等级">{{ si.securityLevel || '--' }}</el-descriptions-item>
              <el-descriptions-item label="是否复评">{{ si.isReassessment ? '是' : '否' }}</el-descriptions-item>
              <el-descriptions-item label="要求录入日期">{{ si.requiredEntryDate || '--' }}</el-descriptions-item>
              <el-descriptions-item label="要求出报告日期">{{ si.requiredReportDeliveryDate || '--' }}</el-descriptions-item>
            </el-descriptions>

            <h5 style="margin: 12px 0 8px; color: #606266">被测单位信息</h5>
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="单位名称">{{ si.assessedUnitName || '--' }}</el-descriptions-item>
              <el-descriptions-item label="所属行业">{{ si.assessedUnitIndustry || '--' }}</el-descriptions-item>
              <el-descriptions-item label="联系人">{{ si.assessedUnitContact || '--' }}</el-descriptions-item>
              <el-descriptions-item label="联系电话">{{ si.assessedUnitMobile || '--' }}</el-descriptions-item>
              <el-descriptions-item label="地址" :span="2">{{ si.assessedUnitAddress || '--' }}</el-descriptions-item>
            </el-descriptions>

            <h5 style="margin: 12px 0 8px; color: #606266">备案信息</h5>
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="备案证明">
                <template v-if="si.filingCertificateFile">
                  <el-link type="primary" underline="never" @click="openFilePreview(si.filingCertificateFile.id, si.filingCertificateFile.fileName)">
                    {{ si.filingCertificateFile.fileName }}
                  </el-link>
                  <span style="color: #999; font-size: 12px; margin-left: 8px">({{ formatFileSize(si.filingCertificateFile.fileSize) }})</span>
                  <el-button type="primary" link size="small" :icon="Download" style="margin-left: 8px" @click.stop="openFileDownload(si.filingCertificateFile.id)">下载</el-button>
                </template>
                <span v-else style="color: #999">未上传</span>
              </el-descriptions-item>
              <el-descriptions-item label="证明编号">{{ si.filingCertificateNo || '--' }}</el-descriptions-item>
              <el-descriptions-item label="出具时间">{{ si.filingCertificateIssuedAt || '--' }}</el-descriptions-item>
              <el-descriptions-item label="备案表">
                <template v-if="si.hasFilingForm && si.filingFormFile">
                  <el-link type="primary" underline="never" @click="openFilePreview(si.filingFormFile.id, si.filingFormFile.fileName)">
                    {{ si.filingFormFile.fileName }}
                  </el-link>
                  <el-button type="primary" link size="small" :icon="Download" style="margin-left: 8px" @click.stop="openFileDownload(si.filingFormFile.id)">下载</el-button>
                </template>
                <span v-else-if="si.hasFilingForm" style="color: #e6a23c">有（未上传）</span>
                <span v-else style="color: #999">无</span>
              </el-descriptions-item>
              <el-descriptions-item label="定级报告">
                <template v-if="si.hasClassificationReport && si.classificationReportFile">
                  <el-link type="primary" underline="never" @click="openFilePreview(si.classificationReportFile.id, si.classificationReportFile.fileName)">
                    {{ si.classificationReportFile.fileName }}
                  </el-link>
                  <el-button type="primary" link size="small" :icon="Download" style="margin-left: 8px" @click.stop="openFileDownload(si.classificationReportFile.id)">下载</el-button>
                </template>
                <span v-else-if="si.hasClassificationReport" style="color: #e6a23c">有（未上传）</span>
                <span v-else style="color: #999">无</span>
              </el-descriptions-item>
            </el-descriptions>
          </el-card>
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

    <TaskActionDialog v-model:visible="dialogVisible" :task="currentTask" @completed="handleTaskCompleted" />

    <!-- 文件预览弹窗 -->
    <el-dialog v-model="previewVisible" :title="previewFileName" width="80%" top="5vh" destroy-on-close>
      <div v-if="previewType === 'image'" style="text-align: center">
        <el-image :src="previewUrl" fit="contain" style="max-width: 100%; max-height: 70vh" />
      </div>
      <iframe v-else-if="previewType === 'pdf'" :src="previewUrl" style="width: 100%; height: 70vh; border: none" />
      <template #footer>
        <el-button :icon="Download" @click="openFileDownload(previewFileId)">下载</el-button>
      </template>
    </el-dialog>
  </div>
</template>
