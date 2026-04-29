<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus } from '@element-plus/icons-vue'
import { getExpensePage, deleteExpense, type ExpenseListItem } from '@/api/expense'
import { SERVICE_CONTENT_OPTIONS, SERVICE_CONTENT_TAG_TYPE, EXPENSE_TYPE_OPTIONS } from '@/utils/enums'
import { getExpenseStatusLabel, getExpenseStatusTagType } from '@/utils/status-map'
import { formatAmount, formatTime } from '@/utils/format'
import { usePermission } from '@/composables/usePermission'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const { hasPermission } = usePermission()
const authStore = useAuthStore()

const tableData = ref<ExpenseListItem[]>([])
const loading = ref(false)
const keyword = ref('')
const statusFilter = ref('')
const serviceContentFilter = ref('')
const expenseTypeFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)

const statusOptions = [
  { label: '草稿', value: 'DRAFT' },
  { label: '部门审核中', value: 'SUBMITTED' },
  { label: '财务审核中', value: 'DEPT_APPROVED' },
  { label: '已通过', value: 'APPROVED' },
  { label: '需修改', value: 'REJECTED' },
]

// status 映射统一走 status-map.ts (getExpenseStatusLabel / getExpenseStatusTagType)

const currentUserId = computed(() => authStore.user?.id)
const isReviewer = computed(() =>
  hasPermission('expense:dept_approve') ||
  hasPermission('expense:fin_approve') ||
  authStore.user?.roles?.includes('super_admin'),
)

async function fetchData() {
  loading.value = true
  try {
    const data = (await getExpensePage({
      page: currentPage.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined,
      status: statusFilter.value || undefined,
      serviceContent: serviceContentFilter.value || undefined,
      expenseType: expenseTypeFilter.value || undefined,
    })) as any
    tableData.value = data.list
    total.value = data.total
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  currentPage.value = 1
  fetchData()
}

function handleReset() {
  keyword.value = ''
  statusFilter.value = ''
  serviceContentFilter.value = ''
  expenseTypeFilter.value = ''
  currentPage.value = 1
  fetchData()
}

function handleCreate() {
  router.push('/finance/expense/create')
}

function handleView(row: ExpenseListItem) {
  router.push(`/finance/expense/${row.id}`)
}

function handleEdit(row: ExpenseListItem) {
  router.push(`/finance/expense/${row.id}/edit`)
}

async function handleDelete(row: ExpenseListItem) {
  try {
    await ElMessageBox.confirm('确认删除该费用请款？', '确认', { type: 'warning' })
    await deleteExpense(row.id)
    ElMessage.success('已删除')
    fetchData()
  } catch { /* cancelled */ }
}

function isMine(row: ExpenseListItem) {
  return row.createdBy === currentUserId.value
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null
watch(keyword, () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => handleSearch(), 300)
})

onMounted(fetchData)
</script>

<template>
  <div>
    <el-card shadow="never">
      <template #header>
        <div style="display: flex; align-items: center; justify-content: space-between">
          <span style="font-weight: 600; font-size: 16px">费用请款</span>
          <el-button type="primary" :icon="Plus" @click="handleCreate">新建费用请款</el-button>
        </div>
      </template>

      <!-- 筛选 -->
      <div style="margin-bottom: 16px; display: flex; gap: 12px; flex-wrap: wrap">
        <el-input
          v-model="keyword"
          placeholder="搜索合同名称 / 合同编号"
          clearable
          style="width: 280px"
          :prefix-icon="Search"
          @keyup.enter="handleSearch"
        />
        <el-select v-model="statusFilter" placeholder="状态" clearable style="width: 140px" @change="handleSearch">
          <el-option v-for="opt in statusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
        <el-select v-model="expenseTypeFilter" placeholder="费用类型" clearable style="width: 140px" @change="handleSearch">
          <el-option v-for="t in EXPENSE_TYPE_OPTIONS" :key="t" :label="t" :value="t" />
        </el-select>
        <el-select v-model="serviceContentFilter" placeholder="服务内容" clearable style="width: 140px" @change="handleSearch">
          <el-option v-for="sc in SERVICE_CONTENT_OPTIONS" :key="sc" :label="sc" :value="sc" />
        </el-select>
        <el-button :icon="Search" type="primary" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="handleReset">重置</el-button>
      </div>

      <!-- 表格 -->
      <el-table v-loading="loading" :data="tableData" stripe border style="width: 100%">
        <el-table-column label="合同编号" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.contractNo || '--' }}</template>
        </el-table-column>
        <el-table-column label="合同名称" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <el-link type="primary" underline="never" @click="handleView(row)">{{ row.contractName || '--' }}</el-link>
          </template>
        </el-table-column>
        <el-table-column label="服务内容" min-width="120" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.serviceContent" :type="SERVICE_CONTENT_TAG_TYPE[row.serviceContent] || 'info'" size="small">
              {{ row.serviceContent }}
            </el-tag>
            <span v-else>--</span>
          </template>
        </el-table-column>
        <el-table-column label="费用类型" min-width="100" align="center">
          <template #default="{ row }">
            <el-tag size="small">{{ row.expenseType }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="请款金额" min-width="130" align="right">
          <template #default="{ row }">{{ formatAmount(row.requestAmount) }}</template>
        </el-table-column>
        <el-table-column label="发票金额" min-width="130" align="right">
          <template #default="{ row }">{{ formatAmount(row.invoiceAmount) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="getExpenseStatusTagType(row.status)" size="small">
              {{ getExpenseStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="申请人" min-width="100">
          <template #default="{ row }">{{ row.creatorName || '--' }}</template>
        </el-table-column>
        <el-table-column label="申请时间" min-width="160">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleView(row)">查看</el-button>
            <el-button
              v-if="isMine(row) && (row.status === 'DRAFT' || row.status === 'REJECTED')"
              type="primary"
              link
              size="small"
              @click="handleEdit(row)"
            >编辑</el-button>
            <el-button
              v-if="isReviewer && (row.status === 'SUBMITTED' || row.status === 'DEPT_APPROVED')"
              type="warning"
              link
              size="small"
              @click="handleView(row)"
            >审核</el-button>
            <el-button
              v-if="isMine(row) && row.status === 'DRAFT'"
              type="danger"
              link
              size="small"
              @click="handleDelete(row)"
            >删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无费用请款" :image-size="80" />
        </template>
      </el-table>

      <!-- 分页 -->
      <div style="display: flex; justify-content: flex-end; margin-top: 16px">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="() => { currentPage = 1; fetchData() }"
          @current-change="fetchData"
        />
      </div>
    </el-card>
  </div>
</template>
