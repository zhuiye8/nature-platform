<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getReportPage } from '@/api/report'
import { getStatusLabel, getStatusTagType } from '@/utils/status-map'
import type { ReportProject } from '@/api/report'

const router = useRouter()
const tableData = ref<ReportProject[]>([])
const loading = ref(false)

const nodeLabel: Record<string, string> = {
  REPORT_COMPILE: '待编制',
  FINAL_REVIEW: '最终审核中',
  MATERIAL_ARCHIVE: '待归档',
}
const nodeTagType: Record<string, '' | 'success' | 'warning' | 'info' | 'danger'> = {
  REPORT_COMPILE: 'warning',
  FINAL_REVIEW: 'warning',
  MATERIAL_ARCHIVE: 'info',
}
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

async function fetchData() {
  loading.value = true
  try {
    const data = await getReportPage({ page: currentPage.value, pageSize: pageSize.value }) as any
    tableData.value = data.list
    total.value = data.total
  } finally {
    loading.value = false
  }
}

function handleView(row: any) {
  // 优先用编制人自己的任务（可操作），否则用只读任务查看详情
  const taskId = row.currentTaskId || row.viewTaskId
  if (taskId) {
    router.push(`/workflow/task/${taskId}`)
  } else {
    router.push(`/report/${row.id}`)
  }
}

onMounted(() => fetchData())
</script>

<template>
  <div>
    <el-card shadow="never">
      <template #header>
        <span style="font-weight: 600; font-size: 16px">报告管理</span>
      </template>

      <el-empty v-if="!loading && tableData.length === 0" description="暂无报告编制任务" />

      <el-table v-if="tableData.length > 0" v-loading="loading" :data="tableData" stripe border style="width: 100%">
        <el-table-column label="项目名称" min-width="300" show-overflow-tooltip>
          <template #default="{ row }">
            <el-link type="primary" :underline="false" @click="router.push(`/project/${row.id}`)">{{ row.applicationName }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="contractYear" label="服务年份" min-width="100" align="center" />
        <el-table-column prop="compilerName" label="编制人" min-width="100" align="center">
          <template #default="{ row }">{{ row.compilerName || '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" min-width="120" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.needsRevision" type="danger" size="small">待修改</el-tag>
            <el-tag v-else :type="nodeTagType[row.currentNode] || 'info'" size="small">
              {{ nodeLabel[row.currentNode] || getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.currentTaskId" type="primary" link size="small" @click="handleView(row)">
              {{ row.needsRevision ? '去修改' : '编制' }}
            </el-button>
            <el-button v-else type="primary" link size="small" @click="handleView(row)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="total > pageSize" style="display: flex; justify-content: flex-end; margin-top: 16px">
        <el-pagination v-model:current-page="currentPage" v-model:page-size="pageSize" :page-sizes="[10, 20, 50]" :total="total" layout="total, sizes, prev, pager, next" @size-change="() => { currentPage = 1; fetchData() }" @current-change="fetchData" />
      </div>
    </el-card>
  </div>
</template>
