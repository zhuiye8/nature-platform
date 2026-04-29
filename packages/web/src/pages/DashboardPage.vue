<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { getMyTasks } from '@/api/workflow'
import type { TaskItem } from '@/api/workflow'
import { getStatusLabel, getStatusTagType } from '@/utils/status-map'
import { formatTime } from '@/utils/format'
import request from '@/api/request'

const authStore = useAuthStore()
const router = useRouter()
const allTasks = ref<TaskItem[]>([])
const loading = ref(false)
const activeTab = ref('review')

async function fetchTasks() {
  loading.value = true
  try {
    allTasks.value = (await getMyTasks()) as unknown as TaskItem[]
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}

// Split tasks into review tasks and business reminders
// PENDING_RECTIFICATION (PM 待整改): 虽然 nodeType=REVIEW (来自 TECH_REVIEW 等), 但 PM 不审核
//   归到 businessTasks (业务提醒) 让 PM 看到 + 跳测评详情整改, 更符合直觉
const reviewTasks = computed(() =>
  allTasks.value.filter((t) =>
    (t as any).status !== 'PENDING_RECTIFICATION' &&
    (t.nodeType === 'REVIEW' || t.nodeType === 'PARALLEL_REVIEW'),
  ),
)

const businessTasks = computed(() =>
  allTasks.value.filter((t) =>
    (t as any).status === 'PENDING_RECTIFICATION' ||
    (t.nodeType !== 'REVIEW' && t.nodeType !== 'PARALLEL_REVIEW'),
  ),
)

// Route mapping for business reminders — nodeKey → target route
const businessRouteMap: Record<string, (task: TaskItem) => string> = {
  CONTRACT_ARCHIVE: () => '/contract',
  POLICE_REGISTER: () => '/police',
  ON_SITE_ASSESSMENT: () => '/assessment',
  TECH_REVIEW: (t) => `/workflow/task/${t.id}`,
  CONTENT_REVIEW: (t) => `/workflow/task/${t.id}`,
  FINAL_REVIEW: (t) => `/workflow/task/${t.id}`,
  CONTRACT_REVIEW: (t) => `/workflow/task/${t.id}`,
  REPORT_COMPILE: () => '/report',
  MATERIAL_ARCHIVE: (t) => `/archive/${t.bizId}`,
  // 财务相关：跳到详情页（详情页内审核，比 TaskDetail 信息更全）
  FIN_INVOICE_REVIEW: (t) => `/finance/invoice/${t.bizId}`,
  FIN_EXPENSE_DEPT_REVIEW: (t) => `/finance/expense/${t.bizId}`,
  FIN_EXPENSE_FIN_REVIEW: (t) => `/finance/expense/${t.bizId}`,
}

// Smart display for task type — uses nodeKey + slotKey instead of raw bizType
function getTaskTypeLabel(task: TaskItem): string {
  const t = task as any
  // PENDING_RECTIFICATION: PM 视角的待整改任务（task.assigneeId 是审核人，但 PM 在项目里能看到）
  if (t.status === 'PENDING_RECTIFICATION') return '现场测评待整改'
  if (t.nodeKey === 'TECH_REVIEW') return '技术审核'
  if (t.nodeKey === 'CONTENT_REVIEW') {
    const slotMap: Record<string, string> = {
      CONTENT_A: '内容审核(技术)',
      CONTENT_B: '内容审核(管理)',
      CONTENT_C: '内容审核(网络)',
    }
    return slotMap[t.slotKey] || '内容审核'
  }
  if (t.nodeKey === 'FINAL_REVIEW') return '最终审核'
  if (t.nodeKey === 'CONTRACT_REVIEW') return '合同审核'
  if (t.nodeKey === 'CONTRACT_ARCHIVE') return '合同归档'
  if (t.nodeKey === 'POLICE_REGISTER') return '公安登记'
  if (t.nodeKey === 'ON_SITE_ASSESSMENT') return '现场测评'
  if (t.nodeKey === 'REPORT_ASSIGN') return '编制任务分配'
  if (t.nodeKey === 'REPORT_COMPILE') return '报告编制'
  if (t.nodeKey === 'MATERIAL_ARCHIVE') return '材料归档'
  if (t.nodeKey === 'FIN_INVOICE_REVIEW') return '开票审核'
  if (t.nodeKey === 'FIN_EXPENSE_DEPT_REVIEW') return '请款部门审核'
  if (t.nodeKey === 'FIN_EXPENSE_FIN_REVIEW') return '请款财务审核'
  return getStatusLabel(t.bizType) || t.nodeKey
}

// 统一路由：
//   PENDING_RECTIFICATION (PM 待整改) → 跳现场测评详情页 (整改入口在 AssessmentDetail)
//   财务相关审核 → 跳详情页 (详情页内有审核按钮)
//   其他 → 跳 TaskDetail
function handleAction(task: TaskItem) {
  const t = task as any
  if (t.status === 'PENDING_RECTIFICATION') {
    router.push(`/assessment/${task.bizId}`)
    return
  }
  const routeFn = businessRouteMap[task.nodeKey]
  if (routeFn) {
    router.push(routeFn(task))
  } else {
    router.push(`/workflow/task/${task.id}`)
  }
}

const handleReviewAction = handleAction
const handleBusinessAction = handleAction


// 无角色用户
const hasNoRole = computed(() => !authStore.user?.roles?.length)
const roleRequested = ref(false)
const roleRequesting = ref(false)

async function handleRequestRole() {
  roleRequesting.value = true
  try {
    await request.post('/auth/request-role')
    roleRequested.value = true
    ElMessage.success('已通知管理员，请耐心等待')
  } catch {
    ElMessage.error('提醒失败，请稍后重试')
  } finally {
    roleRequesting.value = false
  }
}

onMounted(() => {
  if (!hasNoRole.value) {
    fetchTasks()
  }
})
</script>

<template>
  <div>
    <!-- 无角色等待页 -->
    <template v-if="hasNoRole">
      <el-card shadow="never">
        <div style="text-align: center; padding: 60px 0">
          <el-icon style="font-size: 64px; color: var(--el-color-primary); margin-bottom: 16px"><UserFilled /></el-icon>
          <h2 style="color: #303133; margin: 0 0 12px">账号已创建成功</h2>
          <p style="color: #909399; margin: 0 0 24px; font-size: 14px">请等待管理员为您分配角色后使用系统</p>
          <el-button
            type="primary"
            :loading="roleRequesting"
            :disabled="roleRequested"
            @click="handleRequestRole"
          >
            {{ roleRequested ? '已提醒，请耐心等待' : '提醒管理员' }}
          </el-button>
        </div>
      </el-card>
    </template>

    <template v-else>
    <!-- Welcome card -->
    <el-card shadow="never" style="margin-bottom: 16px">
      <div style="display: flex; align-items: center; justify-content: space-between">
        <div>
          <h2 style="color: #303133; margin: 0 0 8px; font-size: 18px">
            欢迎使用 Nature 等保测评平台
          </h2>
          <p style="color: #909399; margin: 0; font-size: 14px">
            {{ authStore.user?.displayName ?? authStore.user?.username }}，祝您工作顺利！
          </p>
        </div>
        <el-tag v-if="allTasks.length > 0" type="danger" size="large" effect="dark" round>
          {{ allTasks.length }} 项待办
        </el-tag>
      </div>
    </el-card>

    <!-- Task tabs -->
    <el-card shadow="never">
      <template #header>
        <div style="display: flex; align-items: center; justify-content: space-between">
          <span style="font-weight: 600; font-size: 16px">待办中心</span>
          <el-button text type="primary" @click="fetchTasks">刷新</el-button>
        </div>
      </template>

      <el-tabs v-model="activeTab">
        <!-- 审核任务 tab -->
        <el-tab-pane :label="`审核任务 (${reviewTasks.length})`" name="review">
          <el-table v-loading="loading" :data="reviewTasks" stripe border style="width: 100%">
            <el-table-column label="业务类型" width="120" align="center">
              <template #default="{ row }">
                <el-tag type="primary" size="small">
                  {{ getTaskTypeLabel(row) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="bizName" label="业务名称" min-width="200" show-overflow-tooltip />
            <el-table-column prop="nodeName" label="审核节点" min-width="140">
              <template #default="{ row }">
                {{ getStatusLabel(row.nodeName) || row.nodeName }}
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100" align="center">
              <template #default="{ row }">
                <el-tag :type="getStatusTagType(row.status)" size="small">
                  {{ getStatusLabel(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="创建时间" min-width="170">
              <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="120" align="center" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" size="small" @click="handleReviewAction(row)">
                  审核
                </el-button>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无审核任务" :image-size="80" />
            </template>
          </el-table>
        </el-tab-pane>

        <!-- 业务提醒 tab -->
        <el-tab-pane :label="`业务提醒 (${businessTasks.length})`" name="business">
          <el-table v-loading="loading" :data="businessTasks" stripe border style="width: 100%">
            <el-table-column label="业务类型" width="120" align="center">
              <template #default="{ row }">
                <el-tag type="primary" size="small">
                  {{ getTaskTypeLabel(row) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="bizName" label="业务名称" min-width="200" show-overflow-tooltip />
            <el-table-column label="待处理事项" min-width="160">
              <template #default="{ row }">
                {{ row.nodeName }}
              </template>
            </el-table-column>
            <el-table-column label="创建时间" min-width="170">
              <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="120" align="center" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" size="small" @click="handleBusinessAction(row)">
                  查看
                </el-button>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无业务提醒" :image-size="80" />
            </template>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>
    </template>
  </div>
</template>
