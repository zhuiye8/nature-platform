<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus } from '@element-plus/icons-vue'
import { getProjectPage, deleteProject, submitProject } from '@/api/project'
import type { ProjectItem } from '@/api/project'

const router = useRouter()
const tableData = ref<ProjectItem[]>([])
const loading = ref(false)
const keyword = ref('')
const status = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

const statusOptions = [
  { label: '全部', value: '' },
  { label: '草稿', value: 'DRAFT' },
  { label: '已提交', value: 'SUBMITTED' },
  { label: '已驳回', value: 'REJECTED' },
]

// Display status derived from workflow current_node
const nodeStatusLabel: Record<string, string> = {
  PROJECT_REGISTER: '待提交',
  PROJECT_REVIEW: '审核中',
  POLICE_REGISTER: '公安登记中',
  ON_SITE_ASSESSMENT: '测评中',
  TECH_REVIEW: '技术审核中',
  CONTENT_REVIEW: '内容审核中',
  REPORT_COMPILE: '编制中',
  FINAL_REVIEW: '最终审核中',
  MATERIAL_ARCHIVE: '归档中',
}

const nodeStatusTagType: Record<string, '' | 'info' | 'warning' | 'success' | 'danger' | 'primary'> = {
  PROJECT_REGISTER: 'info',
  PROJECT_REVIEW: 'warning',
  POLICE_REGISTER: '',
  ON_SITE_ASSESSMENT: 'primary',
  TECH_REVIEW: 'warning',
  CONTENT_REVIEW: 'warning',
  REPORT_COMPILE: '',
  FINAL_REVIEW: 'warning',
  MATERIAL_ARCHIVE: '',
}

function getDisplayStatus(row: any): string {
  if (row.status === 'DRAFT') return '草稿'
  if (row.status === 'REJECTED') return '已驳回'
  if (row.wfStatus === 'COMPLETED') return '已归档'
  if (row.currentNode) return nodeStatusLabel[row.currentNode] || row.currentNode
  return row.status || '--'
}

function getDisplayTagType(row: any): string {
  if (row.status === 'DRAFT') return 'info'
  if (row.status === 'REJECTED') return 'danger'
  if (row.wfStatus === 'COMPLETED') return 'success'
  if (row.currentNode) return nodeStatusTagType[row.currentNode] || 'info'
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
    await deleteProject(row.id)
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
      <el-table
        v-loading="loading"
        :data="tableData"
        stripe
        border
        style="width: 100%"
      >
        <el-table-column label="申请单名称" min-width="240">
          <template #default="{ row }">
            <el-link type="primary" :underline="false" style="white-space: normal; word-break: break-all; line-height: 1.5" @click="router.push(`/project/${row.id}`)">{{ row.applicationName }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="applicationNo" label="申请单编号" width="140" show-overflow-tooltip />
        <el-table-column label="合同名称" min-width="200">
          <template #default="{ row }">
            <el-link v-if="row.contractId" type="primary" :underline="false" style="white-space: normal; word-break: break-all; line-height: 1.5" @click="router.push(`/contract/${row.contractId}`)">{{ row.contractName || '--' }}</el-link>
            <span v-else style="white-space: normal; word-break: break-all">{{ row.contractName || '--' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="合同年度" min-width="100" align="center">
          <template #default="{ row }">
            {{ row.contractYear }}年
          </template>
        </el-table-column>
        <el-table-column prop="creatorName" label="签单销售" min-width="100" show-overflow-tooltip>
          <template #default="{ row }">{{ row.creatorName || '--' }}</template>
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
        <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
        <el-table-column label="操作" width="300" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleView(row)">
              查看
            </el-button>
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
            <el-popconfirm
              v-if="isDraft(row)"
              title="确定要删除该项目吗？"
              confirm-button-text="确定"
              cancel-button-text="取消"
              @confirm="handleDelete(row)"
            >
              <template #reference>
                <el-button
                  v-permission="'project:delete'"
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

  </div>
</template>
