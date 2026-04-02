<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search, Refresh, Plus } from '@element-plus/icons-vue'
import { getCustomerPage, deleteCustomer } from '@/api/customer'
import type { CustomerItem } from '@/api/customer'
import CustomerForm from './CustomerForm.vue'

const router = useRouter()
const tableData = ref<CustomerItem[]>([])
const loading = ref(false)
const keyword = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

// Dialog state
const formVisible = ref(false)
const editCustomerId = ref<number | null>(null)

async function fetchData() {
  loading.value = true
  try {
    const data = (await getCustomerPage({
      page: currentPage.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined,
    })) as unknown as import('@nature/shared').PageResult<CustomerItem>
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
  currentPage.value = 1
  fetchData()
}

function handleCreate() {
  editCustomerId.value = null
  formVisible.value = true
}

function handleEdit(row: CustomerItem) {
  editCustomerId.value = row.id
  formVisible.value = true
}

async function handleDelete(row: CustomerItem) {
  try {
    await deleteCustomer(row.id)
    ElMessage.success('删除成功')
    fetchData()
  } catch {
    // error handled by request interceptor
  }
}

function handleSizeChange(val: number) {
  pageSize.value = val
  currentPage.value = 1
  fetchData()
}

function handleCurrentChange(val: number) {
  currentPage.value = val
  fetchData()
}

function handleSaved() {
  fetchData()
}

// Debounced keyword watch
let debounceTimer: ReturnType<typeof setTimeout> | null = null
watch(keyword, () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    handleSearch()
  }, 300)
})

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div>
    <el-card shadow="never">
      <template #header>
        <div style="display: flex; align-items: center; justify-content: space-between">
          <span style="font-weight: 600; font-size: 16px">客户管理</span>
          <el-button
            v-permission="'customer:create'"
            type="primary"
            :icon="Plus"
            @click="handleCreate"
          >
            新建客户
          </el-button>
        </div>
      </template>

      <!-- Search bar -->
      <div style="margin-bottom: 16px; display: flex; gap: 12px">
        <el-input
          v-model="keyword"
          placeholder="搜索客户名称 / 联系人 / 手机号"
          clearable
          style="width: 320px"
          :prefix-icon="Search"
          @keyup.enter="handleSearch"
        />
        <el-button :icon="Search" type="primary" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="handleReset">重置</el-button>
      </div>

      <!-- Table -->
      <el-table
        v-loading="loading"
        :data="tableData"
        stripe
        border
        style="width: 100%"
      >
        <el-table-column label="客户名称" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <el-link type="primary" :underline="false" @click="router.push(`/customer/${row.id}`)">{{ row.fullName }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="industry" label="行业" min-width="120" show-overflow-tooltip />
        <el-table-column prop="contactName" label="联系人" min-width="100" />
        <el-table-column prop="mobilePhone" label="手机号" min-width="130" />
        <el-table-column label="是否政府单位" min-width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="row.isGovernment ? 'success' : 'info'" size="small">
              {{ row.isGovernment ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" min-width="170" />
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="router.push(`/customer/${row.id}`)">
              查看
            </el-button>
            <el-button
              v-permission="'customer:update'"
              type="primary"
              link
              size="small"
              @click="handleEdit(row)"
            >
              编辑
            </el-button>
            <el-popconfirm
              title="确定要删除该客户吗？"
              confirm-button-text="确定"
              cancel-button-text="取消"
              @confirm="handleDelete(row)"
            >
              <template #reference>
                <el-button
                  v-permission="'customer:delete'"
                  type="danger"
                  link
                  size="small"
                >
                  删除
                </el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <!-- Pagination -->
      <div style="display: flex; justify-content: flex-end; margin-top: 16px">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>

    <!-- Form Dialog -->
    <CustomerForm
      v-model:visible="formVisible"
      :customer-id="editCustomerId"
      @saved="handleSaved"
    />
  </div>
</template>
