<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getReportPage } from '@/api/report'
import type { ReportProject, ReportStatus } from '@/api/report'
import ActionButton from '@/components/ActionButton.vue'

const router = useRouter()
const tableData = ref<ReportProject[]>([])
const loading = ref(false)

// 业务状态到文案 / tag 的映射（与 ReportStatus 对齐）
const statusLabel: Record<ReportStatus, string> = {
  PENDING: '待编制',
  REVIEWING: '审核中',
  REVISION: '待修改',
  APPROVED: '已通过',
}
const statusTagType: Record<ReportStatus, 'warning' | 'primary' | 'danger' | 'success'> = {
  PENDING: 'warning',
  REVIEWING: 'primary',
  REVISION: 'danger',
  APPROVED: 'success',
}

// ── 筛选条件 ──
const filters = ref<{
  keyword: string
  status: ReportStatus | ''
}>({
  keyword: '',
  status: '',
})

// ── 分页 ──
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)

async function fetchData() {
  loading.value = true
  try {
    const params: Record<string, unknown> = {
      page: currentPage.value,
      pageSize: pageSize.value,
    }
    if (filters.value.keyword.trim()) params.keyword = filters.value.keyword.trim()
    if (filters.value.status) params.status = filters.value.status
    const data = await getReportPage(params as Parameters<typeof getReportPage>[0])
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
  filters.value.keyword = ''
  filters.value.status = ''
  currentPage.value = 1
  fetchData()
}

function handleView(row: ReportProject) {
  // 严格按"列表一致性": 查看永远跳本业务详情页(只读)
  // 编制/审核等操作由 ActionButton 按 my-tasks 权限控制,跳对应目标
  router.push(`/report/${row.id}`)
}

onMounted(() => fetchData())
</script>

<template>
  <div>
    <el-card shadow="never">
      <template #header>
        <span style="font-weight: 600; font-size: 16px">报告管理</span>
      </template>

      <!-- ── 筛选栏 ── -->
      <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px">
        <el-input
          v-model="filters.keyword"
          placeholder="按项目名称搜索"
          clearable
          style="width: 260px"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        />
        <el-select
          v-model="filters.status"
          placeholder="状态"
          clearable
          style="width: 140px"
          @change="handleSearch"
          @clear="handleSearch"
        >
          <el-option label="待编制" value="PENDING" />
          <el-option label="审核中" value="REVIEWING" />
          <el-option label="待修改" value="REVISION" />
          <el-option label="已通过" value="APPROVED" />
        </el-select>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>

      <el-empty v-if="!loading && tableData.length === 0" description="暂无报告编制记录" />

      <div
        v-if="tableData.length > 0"
        style="text-align: right; color: #909399; font-size: 12px; margin-bottom: 6px"
      >
        &larr; 可左右滑动查看更多信息 &rarr;
      </div>
      <el-table v-if="tableData.length > 0" v-loading="loading" :data="tableData" stripe border style="width: 100%">
        <el-table-column label="项目名称" min-width="300" show-overflow-tooltip>
          <template #default="{ row }">
            <el-link type="primary" underline="never" @click="router.push(`/project/${row.id}`)">{{ row.applicationName }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="contractYear" label="服务年份" min-width="100" align="center" />
        <el-table-column prop="compilerName" label="编制人" min-width="100" align="center">
          <template #default="{ row }">{{ row.compilerName || '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" min-width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType[row.businessStatus as ReportStatus] || 'info'" size="small">
              {{ statusLabel[row.businessStatus as ReportStatus] || row.businessStatus }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleView(row)">查看</el-button>
            <!-- 编制 / 分配 / 最终审核 等操作按 my-tasks 判定,跳对应目标 -->
            <ActionButton biz-type="PROJECT_REGISTER" :biz-id="row.id" />
          </template>
        </el-table-column>
      </el-table>

      <div v-if="total > pageSize" style="display: flex; justify-content: flex-end; margin-top: 16px">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50]"
          :total="total"
          layout="total, sizes, prev, pager, next"
          @size-change="() => { currentPage = 1; fetchData() }"
          @current-change="fetchData"
        />
      </div>
    </el-card>
  </div>
</template>
