<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search, Refresh, Plus } from '@element-plus/icons-vue'
import { getPoliceRegisterPage, completePoliceRegister } from '@/api/police'
import type { PoliceItem } from '@/api/police'
import PoliceForm from './PoliceForm.vue'

const router = useRouter()
const tableData = ref<PoliceItem[]>([])
const loading = ref(false)
const keyword = ref('')
const statusFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const formVisible = ref(false)
const editId = ref<number | null>(null)

async function fetchData() {
  loading.value = true
  try {
    const data = await getPoliceRegisterPage({
      page: currentPage.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined,
      status: statusFilter.value || undefined,
    }) as any
    tableData.value = data.list
    total.value = data.total
  } finally {
    loading.value = false
  }
}

function handleSearch() { currentPage.value = 1; fetchData() }
function handleReset() { keyword.value = ''; statusFilter.value = ''; currentPage.value = 1; fetchData() }
function handleCreate() { editId.value = null; formVisible.value = true }
function handleEdit(row: PoliceItem) { editId.value = row.id; formVisible.value = true }

async function handleComplete(row: PoliceItem) {
  try {
    await completePoliceRegister(row.id)
    ElMessage.success('登记完成')
    fetchData()
  } catch { /* handled */ }
}

function handleViewFile(url: string) {
  window.open(url, '_blank')
}

onMounted(() => fetchData())
</script>

<template>
  <div>
    <el-card shadow="never">
      <template #header>
        <div style="display: flex; align-items: center; justify-content: space-between">
          <span style="font-weight: 600; font-size: 16px">公安登记</span>
          <el-button v-permission="'police:create'" type="primary" :icon="Plus" @click="handleCreate">新建登记</el-button>
        </div>
      </template>

      <div style="margin-bottom: 16px; display: flex; gap: 12px">
        <el-input v-model="keyword" placeholder="搜索登记编号/项目名称" clearable style="width: 280px" :prefix-icon="Search" @keyup.enter="handleSearch" />
        <el-select v-model="statusFilter" placeholder="状态" clearable style="width: 120px" @change="handleSearch">
          <el-option label="草稿" value="DRAFT" />
          <el-option label="已完成" value="COMPLETED" />
        </el-select>
        <el-button :icon="Search" type="primary" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="handleReset">重置</el-button>
      </div>

      <div style="text-align: right; color: #909399; font-size: 12px; margin-bottom: 6px">&larr; 可左右滑动查看更多信息 &rarr;</div>
      <el-table v-loading="loading" :data="tableData" stripe border style="width: 100%">
        <el-table-column label="项目名称" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <el-link v-if="row.projectRegisterId" type="primary" underline="never" style="white-space: normal; word-break: break-all; line-height: 1.5" @click="router.push(`/project/${row.projectRegisterId}`)">{{ row.applicationName }}</el-link>
            <span v-else style="white-space: normal; word-break: break-all">{{ row.applicationName || '--' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="registerNo" label="登记编号" min-width="140" show-overflow-tooltip />
        <el-table-column prop="registrantName" label="登记人" min-width="100" />
        <el-table-column prop="projectManagerName" label="项目经理" min-width="100" />
        <el-table-column label="电子扫描件" min-width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.hasFile" type="success" size="small">已上传</el-tag>
            <span v-else style="color: #909399">无</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" min-width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'COMPLETED' ? 'success' : 'info'" size="small">
              {{ row.status === 'COMPLETED' ? '已完成' : '草稿' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" min-width="170" />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="router.push(`/police/${row.id}`)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div style="display: flex; justify-content: flex-end; margin-top: 16px">
        <el-pagination v-model:current-page="currentPage" v-model:page-size="pageSize" :page-sizes="[10, 20, 50]" :total="total" layout="total, sizes, prev, pager, next" @size-change="() => { currentPage = 1; fetchData() }" @current-change="fetchData" />
      </div>
    </el-card>

    <PoliceForm v-model:visible="formVisible" @saved="fetchData" />
  </div>
</template>
