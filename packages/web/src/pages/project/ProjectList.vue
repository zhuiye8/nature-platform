<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus } from '@element-plus/icons-vue'
import { getProjectPage, getProjectDetail, deleteProject, submitProject } from '@/api/project'
import type { ProjectItem } from '@/api/project'
import ActionButton from '@/components/ActionButton.vue'

const router = useRouter()
const tableData = ref<ProjectItem[]>([])
const loading = ref(false)
const keyword = ref('')
const status = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)

const statusOptions = [
  { label: '全部', value: '' },
  { label: '草稿', value: 'DRAFT' },
  { label: '审核中', value: 'SUBMITTED' },
  { label: '已通过', value: 'APPROVED' },
  { label: '已驳回', value: 'REJECTED' },
]

// SUBMITTED 状态下细分展示：部门经理确认中 / 项目主管审核中
const submittedSubLabel: Record<string, string> = {
  DEPT_REVIEW: '部门经理确认中',
  DIRECTOR_REVIEW: '项目主管审核中',
}

// 项目登记列表只展示 4 种状态（SUBMITTED 下细分 2 种审核阶段）
function getDisplayStatus(row: any): string {
  if (row.status === 'DRAFT') return '草稿'
  if (row.status === 'REJECTED') return '已驳回'
  if (row.status === 'APPROVED') return '已通过'
  if (row.status === 'SUBMITTED') {
    return submittedSubLabel[row.currentNode] || '审核中'
  }
  return row.status || '--'
}

function getDisplayTagType(row: any): 'primary' | 'success' | 'info' | 'warning' | 'danger' {
  if (row.status === 'DRAFT') return 'info'
  if (row.status === 'REJECTED') return 'danger'
  if (row.status === 'APPROVED') return 'success'
  if (row.status === 'SUBMITTED') return 'warning'
  return 'info'
}

async function fetchData() {
  loading.value = true
  try {
    const data = (await getProjectPage({
      page: currentPage.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined,
      status: status.value || undefined,
    })) as unknown as import('@nature/shared').PageResult<ProjectItem>
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
  status.value = ''
  currentPage.value = 1
  fetchData()
}

function handleCreate() {
  router.push('/project/create')
}

function handleView(row: ProjectItem) {
  router.push(`/project/${row.id}`)
}

function handleEdit(row: ProjectItem) {
  router.push(`/project/${row.id}/edit`)
}

async function handleSubmit(row: ProjectItem) {
  try {
    // 验证系统明细是否完整
    const detail = (await getProjectDetail(row.id)) as any
    const items = detail?.systemItems || []
    if (items.length === 0) {
      ElMessage.warning('请先添加系统明细后再提交审核')
      return
    }
    for (let i = 0; i < items.length; i++) {
      const si = items[i]
      const missing: string[] = []
      if (!si.systemName) missing.push('系统名称')
      if (!si.filingAgency) missing.push('备案机关')
      if (!si.securityLevel) missing.push('安全等级')
      if (!si.requiredEntryDate) missing.push('要求录入日期')
      if (!si.requiredReportDeliveryDate) missing.push('要求出报告日期')
      if (!si.assessedUnitName) missing.push('被测单位名称')
      if (!si.assessedUnitContact) missing.push('联系人')
      if (!si.assessedUnitMobile) missing.push('联系电话')
      if (!si.assessedUnitAddress) missing.push('地址')
      if (!si.filingCertificateNo) missing.push('备案证明编号')
      if (!si.filingCertificateIssuedAt) missing.push('备案证明出具时间')
      if (missing.length > 0) {
        ElMessage.warning(`系统「${si.systemName || '未命名'}」缺少：${missing.join('、')}，请编辑完善后再提交`)
        return
      }
    }

    await ElMessageBox.confirm('确定要提交该项目进行审核吗？', '提交确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await submitProject(row.id)
    ElMessage.success('提交成功')
    fetchData()
  } catch {
    // cancelled or error handled by request interceptor
  }
}

async function handleDelete(row: ProjectItem) {
  try {
    await ElMessageBox.confirm('确定要删除该项目吗？', '确认', { type: 'warning' })
    await deleteProject(row.id)
    ElMessage.success('删除成功')
    fetchData()
  } catch {
    // cancelled or error handled by request interceptor
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

function isDraftOrRejected(row: ProjectItem) {
  return row.status === 'DRAFT' || row.status === 'REJECTED'
}

function isDraft(row: ProjectItem) {
  return row.status === 'DRAFT'
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
          <span style="font-weight: 600; font-size: 16px">项目登记</span>
          <el-button
            v-permission="'project:create'"
            type="primary"
            :icon="Plus"
            @click="handleCreate"
          >
            新建项目登记
          </el-button>
        </div>
      </template>

      <!-- Search bar -->
      <div style="margin-bottom: 16px; display: flex; gap: 12px">
        <el-input
          v-model="keyword"
          placeholder="搜索项目名称"
          clearable
          style="width: 280px"
          :prefix-icon="Search"
          @keyup.enter="handleSearch"
        />
        <el-select
          v-model="status"
          placeholder="状态"
          clearable
          style="width: 140px"
          @change="handleSearch"
        >
          <el-option
            v-for="opt in statusOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
        <el-button :icon="Search" type="primary" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="handleReset">重置</el-button>
      </div>

      <!-- Table -->
      <div style="text-align: right; color: #909399; font-size: 12px; margin-bottom: 6px">&larr; 可左右滑动查看更多信息 &rarr;</div>
      <el-table
        v-loading="loading"
        :data="tableData"
        stripe
        border
        style="width: 100%"
      >
        <el-table-column label="申请单名称" min-width="240">
          <template #default="{ row }">
            <el-link type="primary" underline="never" style="white-space: normal; word-break: break-all; line-height: 1.5" @click="router.push(`/project/${row.id}`)">{{ row.applicationName }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="applicationNo" label="申请单编号" width="140" show-overflow-tooltip />
        <el-table-column label="合同名称" min-width="200">
          <template #default="{ row }">
            <el-link v-if="row.contractId" type="primary" underline="never" style="white-space: normal; word-break: break-all; line-height: 1.5" @click="router.push(`/contract/${row.contractId}`)">{{ row.contractName || '--' }}</el-link>
            <span v-else style="white-space: normal; word-break: break-all">{{ row.contractName || '--' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="合同年度" min-width="100" align="center">
          <template #default="{ row }">
            {{ row.contractYear }}年
          </template>
        </el-table-column>
        <el-table-column label="系统数量" min-width="90" align="center">
          <template #default="{ row }">{{ row.systemItemCount ?? 0 }}</template>
        </el-table-column>
        <el-table-column prop="salesPersonName" label="签单销售" min-width="100" show-overflow-tooltip>
          <template #default="{ row }">{{ row.salesPersonName || '--' }}</template>
        </el-table-column>
        <el-table-column label="状态" min-width="120" align="center">
          <template #default="{ row }">
            <el-tooltip v-if="row.status === 'REJECTED' && row.rejectRemark" :content="'驳回原因：' + row.rejectRemark" placement="top">
              <el-tag type="danger" size="small" style="cursor: pointer">
                {{ getDisplayStatus(row) }}
              </el-tag>
            </el-tooltip>
            <el-tag v-else :type="getDisplayTagType(row)" size="small">
              {{ getDisplayStatus(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" min-width="170" />
        <el-table-column label="操作" width="330" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleView(row)">
              查看
            </el-button>
            <ActionButton biz-type="PROJECT_REGISTER" :biz-id="row.id" />
            <el-button
              v-permission="'project:update'"
              type="success"
              link
              size="small"
              @click="isDraftOrRejected(row) ? router.push(`/project/${row.id}/edit?scrollTo=systemItems`) : router.push(`/project/${row.id}`)"
            >
              系统明细
            </el-button>
            <el-button
              v-if="isDraftOrRejected(row)"
              v-permission="'project:update'"
              type="primary"
              link
              size="small"
              @click="handleEdit(row)"
            >
              编辑
            </el-button>
            <el-button
              v-if="isDraftOrRejected(row)"
              v-permission="'project:create'"
              type="warning"
              link
              size="small"
              @click="handleSubmit(row)"
            >
              提交
            </el-button>
            <el-button
              v-if="isDraft(row)"
              v-permission="'project:delete'"
              type="danger"
              link
              size="small"
              @click="handleDelete(row)"
            >
              删除
            </el-button>
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

  </div>
</template>
