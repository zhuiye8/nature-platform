<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Edit } from '@element-plus/icons-vue'
import { getStatusLabel, getStatusTagType } from '@/utils/status-map'
import { formatTime } from '@/utils/format'
import { getProjectDetail, getSystemItems } from '@/api/project'
import type { ProjectDetail as ProjectDetailType, ProjectSystemItem, ProjectMember } from '@/api/project'
import { getInstanceByBiz } from '@/api/workflow'
import type { InstanceDetail, TaskItem } from '@/api/workflow'
import { useAuthStore } from '@/stores/auth'
import TaskActionDialog from '@/components/TaskActionDialog.vue'
import SystemItemDetailDialog from '@/components/SystemItemDetailDialog.vue'
import RejectReasonPanel from '@/components/RejectReasonPanel.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const loading = ref(false)
const project = ref<ProjectDetailType | null>(null)
const workflowInstance = ref<InstanceDetail | null>(null)
const dialogVisible = ref(false)
const currentTask = ref<TaskItem | null>(null)

// System item detail dialog
const systemItemDialogVisible = ref(false)
const selectedSystemItem = ref<any>(null)
const systemItemsWithFiles = ref<any[]>([])

async function loadSystemItemsWithFiles() {
  if (!project.value) return
  try {
    systemItemsWithFiles.value = (await getSystemItems(project.value.id)) as any[]
  } catch {
    systemItemsWithFiles.value = project.value.systemItems || []
  }
}

function showSystemItemDetail(row: any) {
  // Find the enriched version with files
  const enriched = systemItemsWithFiles.value.find((i: any) => i.id === row.id) || row
  selectedSystemItem.value = enriched
  systemItemDialogVisible.value = true
}

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
}

const roleTypeTagType: Record<string, 'primary' | 'success' | 'warning' | 'info'> = {
  PM: 'primary',
  ASSESSOR: 'success',
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

// Member assignment removed — now handled by workflow (reviewer assigns assessors, police assigns PM)

async function fetchDetail() {
  const id = Number(route.params.id)
  if (!id) return
  loading.value = true
  try {
    project.value = (await getProjectDetail(id)) as unknown as ProjectDetailType
    await fetchWorkflow()
    await loadSystemItemsWithFiles()
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

      <!-- 驳回/复核意见醒目提示 -->
      <RejectReasonPanel v-if="project?.status === 'REJECTED'" biz-type="PROJECT_REGISTER" :biz-id="project.id" />

      <template v-if="project">
        <!-- Basic Info -->
        <el-descriptions :column="2" border>
          <el-descriptions-item label="申请单名称">
            {{ project.applicationName }}
          </el-descriptions-item>
          <el-descriptions-item label="申请单编号">
            {{ project.applicationNo || '--' }}
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTagType[project.status] || 'info'" size="small">
              {{ statusLabel[project.status] || project.status }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="合同年度">
            {{ project.contractYear }}年
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ project.createdAt }}
          </el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">
            {{ project.remark || '--' }}
          </el-descriptions-item>
        </el-descriptions>

        <!-- Related Contract & Customer Info -->
        <h4 style="margin: 24px 0 12px; font-size: 15px; font-weight: 600">关联合同信息</h4>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="合同名称">{{ project.contractName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="合同编号">{{ (project as any).contractNo || '--' }}</el-descriptions-item>
          <el-descriptions-item label="合同类型">{{ getStatusLabel((project as any).contractType) || '--' }}</el-descriptions-item>
          <el-descriptions-item label="服务年份">{{ ((project as any).serviceYears || []).map((y: number) => y + '年').join('、') || '--' }}</el-descriptions-item>
          <el-descriptions-item label="合同金额">{{ (project as any).paymentAmount ? `¥${Number((project as any).paymentAmount).toLocaleString()}` : '--' }}</el-descriptions-item>
          <el-descriptions-item label="回款状态">
            <el-tag v-if="(project as any).paymentStatus" :type="getStatusTagType((project as any).paymentStatus)" size="small">{{ getStatusLabel((project as any).paymentStatus) }}</el-tag>
            <span v-else>--</span>
          </el-descriptions-item>
          <el-descriptions-item label="联系人">{{ (project as any).contactName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="联系电话">{{ (project as any).contactPhone || '--' }}</el-descriptions-item>
        </el-descriptions>

        <h4 style="margin: 24px 0 12px; font-size: 15px; font-weight: 600">客户信息</h4>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="客户名称">{{ (project as any).customerName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="客户联系人">{{ (project as any).customerContactName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="联系电话">{{ (project as any).customerContactPhone || '--' }}</el-descriptions-item>
          <el-descriptions-item label="地址">{{ (project as any).customerAddress || '--' }}</el-descriptions-item>
        </el-descriptions>

        <!-- System Items -->
        <div v-if="project.systemItems && project.systemItems.length > 0" style="margin-top: 24px">
          <h3 style="margin-bottom: 12px; font-size: 15px; font-weight: 600">系统明细</h3>
          <el-table :data="project.systemItems" stripe border style="width: 100%">
            <el-table-column type="index" label="序号" width="60" align="center" />
            <el-table-column prop="systemName" label="系统名称" min-width="150" show-overflow-tooltip />
            <el-table-column prop="securityLevel" label="安全等级" width="100" align="center" />
            <el-table-column label="是否复评" width="100" align="center">
              <template #default="{ row }">
                {{ row.isReassessment ? '是' : '否' }}
              </template>
            </el-table-column>
            <el-table-column prop="filingAgency" label="备案单位" min-width="130" show-overflow-tooltip />
            <el-table-column prop="assessedUnitName" label="被测单位" min-width="130" show-overflow-tooltip />
            <el-table-column prop="assessedUnitContact" label="联系人" width="100" />
            <el-table-column prop="assessedUnitMobile" label="联系电话" width="130" />
            <el-table-column label="要求录入日期" width="130">
              <template #default="{ row }">
                {{ row.requiredEntryDate || '--' }}
              </template>
            </el-table-column>
            <el-table-column label="要求出报告日期" width="140">
              <template #default="{ row }">
                {{ row.requiredReportDeliveryDate || '--' }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="80" align="center">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="showSystemItemDetail(row)">详情</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <!-- Project Members -->
        <div style="margin-top: 24px">
          <div style="margin-bottom: 12px">
            <h3 style="margin: 0; font-size: 15px; font-weight: 600">项目成员</h3>
          </div>

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
              <template #default="{ row }">
                {{ row.assignedAt || '--' }}
              </template>
            </el-table-column>
          </el-table>
          <el-empty
            v-else
            description="暂无项目成员"
            :image-size="60"
          />
        </div>

        <!-- Workflow Timeline -->
        <div v-if="workflowInstance" style="margin-top: 24px">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px">
            <h3 style="margin: 0; font-size: 15px; font-weight: 600">审批流程</h3>
            <el-button
              v-if="getPendingTask()"
              type="primary"
              size="small"
              @click="handleApproveReject"
            >
              审批
            </el-button>
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
                <el-tag
                  :type="actionTimelineType[log.action] || 'info'"
                  size="small"
                  style="margin-left: 8px"
                >
                  {{ actionLabel[log.action] || log.action }}
                </el-tag>
              </div>
              <div v-if="log.remark" style="color: #909399; margin-top: 4px; font-size: 13px">
                {{ log.remark }}
              </div>
            </el-timeline-item>
          </el-timeline>

          <el-empty
            v-if="workflowInstance.actionLogs.length === 0"
            description="暂无审批记录"
            :image-size="80"
          />
        </div>
      </template>
    </el-card>

    <TaskActionDialog
      v-model:visible="dialogVisible"
      :task="currentTask"
      @completed="handleTaskCompleted"
    />

    <SystemItemDetailDialog
      v-model:visible="systemItemDialogVisible"
      :item="selectedSystemItem"
    />
  </div>
</template>
