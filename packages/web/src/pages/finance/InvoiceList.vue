<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus } from '@element-plus/icons-vue'
import { getInvoicePage, deleteInvoice, type InvoiceListItem } from '@/api/invoice'
import { SERVICE_CONTENT_OPTIONS, SERVICE_CONTENT_TAG_TYPE } from '@/utils/enums'
import { formatTime } from '@/utils/format'
import { usePermission } from '@/composables/usePermission'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const { hasPermission } = usePermission()
const authStore = useAuthStore()

const tableData = ref<InvoiceListItem[]>([])
const loading = ref(false)
const keyword = ref('')
const statusFilter = ref('')
const serviceContentFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

const statusOptions = [
  { label: '草稿', value: 'DRAFT' },
  { label: '审核中', value: 'SUBMITTED' },
  { label: '已开票', value: 'APPROVED' },
  { label: '需修改', value: 'REJECTED' },
]

const statusLabel: Record<string, string> = {
  DRAFT: '草稿', SUBMITTED: '审核中', APPROVED: '已开票', REJECTED: '需修改',
}
const statusTagType: Record<string, 'info' | 'warning' | 'success' | 'danger'> = {
  DRAFT: 'info', SUBMITTED: 'warning', APPROVED: 'success', REJECTED: 'danger',
}

const currentUserId = computed(() => authStore.user?.id)
const isFinanceOrAdmin = computed(() =>
  hasPermission('invoice:review') || authStore.user?.roles?.includes('super_admin'),
)

async function fetchData() {
  loading.value = true
  try {
    const data = (await getInvoicePage({
      page: currentPage.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined,
      status: statusFilter.value || undefined,
      serviceContent: serviceContentFilter.value || undefined,
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
  currentPage.value = 1
  fetchData()
}

function handleCreate() {
  router.push('/finance/invoice/create')
}

function handleView(row: InvoiceListItem) {
  router.push(`/finance/invoice/${row.id}`)
}

function handleEdit(row: InvoiceListItem) {
  router.push(`/finance/invoice/${row.id}/edit`)
}

async function handleDelete(row: InvoiceListItem) {
  try {
    await ElMessageBox.confirm('确认删除该开票申请？', '确认', { type: 'warning' })
    await deleteInvoice(row.id)
    ElMessage.success('已删除')
    fetchData()
  } catch { /* cancelled */ }
}

function isMine(row: InvoiceListItem) {
  return row.createdBy === currentUserId.value
}

function formatAmount(val: any) {
  if (val == null || val === '') return '--'
  return `¥${Number(val).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`
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
          <span style="font-weight: 600; font-size: 16px">开票申请</span>
          <el-button type="primary" :icon="Plus" @click="handleCreate">新建开票申请</el-button>
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
        <el-select v-model="statusFilter" placeholder="状态" clearable style="width: 130px" @change="handleSearch">
          <el-option v-for="opt in statusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
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
        <el-table-column label="申请金额" min-width="130" align="right">
          <template #default="{ row }">{{ formatAmount(row.applyAmount) }}</template>
        </el-table-column>
        <el-table-column label="发票类型" min-width="90" align="center">
          <template #default="{ row }">{{ row.invoiceType }}</template>
        </el-table-column>
        <el-table-column label="税率" width="70" align="center">
          <template #default="{ row }">{{ row.taxRate }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType[row.status] || 'info'" size="small">
              {{ statusLabel[row.status] || row.status }}
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
              v-if="isFinanceOrAdmin && row.status === 'SUBMITTED'"
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
          <el-empty description="暂无开票申请" :image-size="80" />
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
