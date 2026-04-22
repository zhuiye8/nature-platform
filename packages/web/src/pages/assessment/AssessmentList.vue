<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getAssessmentPage, type AssessmentSystemItem } from '@/api/assessment'
import { formatTime } from '@/utils/format'
import ActionButton from '@/components/ActionButton.vue'

const router = useRouter()
const loading = ref(false)
const list = ref<AssessmentSystemItem[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)

// Filters
const keyword = ref('')
const assessmentStatus = ref('')
const contractYear = ref<number | undefined>(undefined)

async function fetchData() {
  loading.value = true
  try {
    const data = (await getAssessmentPage({
      page: currentPage.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined,
      contractYear: contractYear.value || undefined,
      assessmentStatus: assessmentStatus.value || undefined,
    })) as any
    list.value = data.list
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
  contractYear.value = undefined
  assessmentStatus.value = ''
  currentPage.value = 1
  fetchData()
}

// Map workflow node to Chinese status
function getAssessmentStatusLabel(row: any): string {
  if (row.wfStatus === 'COMPLETED') return '已完成'
  if (row.pendingRectification) return '待整改'
  // Rejected back to ON_SITE_ASSESSMENT (roundNo > 1)
  if (row.currentNode === 'ON_SITE_ASSESSMENT' && row.roundNo > 1) return '待整改'
  const nodeMap: Record<string, string> = {
    ON_SITE_ASSESSMENT: '测评中',
    TECH_REVIEW: '技术审核中',
    CONTENT_REVIEW: '内容审核中',
    REPORT_ASSIGN: '编制分配中',
    REPORT_COMPILE: '报告编制中',
    FINAL_REVIEW: '最终审核中',
    MATERIAL_ARCHIVE: '归档中',
  }
  return nodeMap[row.currentNode] || row.currentNode || '-'
}

function getAssessmentStatusType(row: any): 'primary' | 'success' | 'info' | 'warning' | 'danger' {
  if (row.wfStatus === 'COMPLETED') return 'success'
  if (row.pendingRectification) return 'danger'
  if (row.currentNode === 'ON_SITE_ASSESSMENT' && row.roundNo > 1) return 'danger'
  const typeMap: Record<string, 'primary' | 'success' | 'info' | 'warning' | 'danger'> = {
    ON_SITE_ASSESSMENT: 'primary',
    TECH_REVIEW: 'warning',
    CONTENT_REVIEW: 'warning',
    REPORT_ASSIGN: 'warning',
    REPORT_COMPILE: 'info',
    FINAL_REVIEW: 'warning',
    MATERIAL_ARCHIVE: 'info',
  }
  return typeMap[row.currentNode] || 'info'
}

function viewDetail(projectRegisterId: number) {
  router.push(`/assessment/${projectRegisterId}`)
}


const currentYearNum = new Date().getFullYear()
const yearOptions = Array.from({ length: 7 }, (_, i) => currentYearNum - 3 + i)

watch([currentPage, pageSize], fetchData)
onMounted(fetchData)
</script>

<template>
  <div class="n-page-container">
    <div class="n-page-header">
      <h2 class="n-page-title">现场测评实施</h2>
    </div>

    <el-card shadow="never">
      <!-- Search bar -->
      <div style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; align-items: center">
        <el-input
          v-model="keyword"
          placeholder="搜索项目名称"
          clearable
          style="width: 260px"
          @keyup.enter="handleSearch"
        />
        <el-select v-model="contractYear" placeholder="服务年度" clearable style="width: 140px">
          <el-option v-for="y in yearOptions" :key="y" :label="y + '年'" :value="y" />
        </el-select>
        <el-select v-model="assessmentStatus" placeholder="测评状态" clearable style="width: 150px">
          <el-option label="测评中" value="ASSESSING" />
          <el-option label="审核中" value="REVIEWING" />
          <el-option label="报告编制中" value="COMPILING" />
          <el-option label="最终审核中" value="FINAL_REVIEWING" />
          <el-option label="归档中" value="ARCHIVING" />
        </el-select>
        <el-button type="primary" @click="handleSearch">搜索</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>

      <!-- Table — one row per project -->
      <div style="text-align: right; color: #909399; font-size: 12px; margin-bottom: 6px">&larr; 可左右滑动查看更多信息 &rarr;</div>
      <el-table :data="list" v-loading="loading" stripe border style="width: 100%">
        <el-table-column label="项目名称" min-width="250">
          <template #default="{ row }">
            <span style="white-space: normal; word-break: break-all; line-height: 1.5">{{ row.applicationName }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="projectManagerName" label="项目经理" width="120">
          <template #default="{ row }">{{ row.projectManagerName || '-' }}</template>
        </el-table-column>
        <el-table-column label="服务年度" width="100" align="center">
          <template #default="{ row }">{{ row.contractYear }}年</template>
        </el-table-column>
        <el-table-column label="测评状态" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="getAssessmentStatusType(row)" size="small">
              {{ getAssessmentStatusLabel(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="viewDetail(row.id)">查看</el-button>
            <ActionButton biz-type="PROJECT_REGISTER" :biz-id="row.id" />
          </template>
        </el-table-column>
      </el-table>

      <!-- Pagination -->
      <div style="display: flex; justify-content: flex-end; margin-top: 16px">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          background
        />
      </div>
    </el-card>
  </div>
</template>
