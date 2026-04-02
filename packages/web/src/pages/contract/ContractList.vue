<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus, Upload, Download, Paperclip } from '@element-plus/icons-vue'
import { getStatusLabel } from '@/utils/status-map'
import { formatTime } from '@/utils/format'
import { getContractPage, deleteContract, submitContract } from '@/api/contract'
import { getUsersByRole } from '@/api/workflow'
import type { ContractItem } from '@/api/contract'
import { getFileList, getUploadUrl, getDownloadUrl, getPreviewUrl, deleteFile, type FileItem } from '@/api/file'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const router = useRouter()
const tableData = ref<ContractItem[]>([])
const loading = ref(false)
const keyword = ref('')
const reviewStatus = ref('')
const archiveStatusFilter = ref('')
// 销售筛选：销售角色默认选自己，其他角色默认不筛选
const salesFilter = ref<number | ''>(_defaultSalesFilter())
const salesOptions = ref<{ id: number; displayName: string }[]>([])

function _defaultSalesFilter(): number | '' {
  const roles = authStore.user?.roles || []
  if (roles.includes('sales') && !roles.includes('super_admin')) {
    return authStore.user?.id ?? ''
  }
  return ''
}

async function loadSalesUsers() {
  try {
    salesOptions.value = (await getUsersByRole('sales')) as any
  } catch { salesOptions.value = [] }
}
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

const reviewStatusOptions = [
  { label: '全部', value: '' },
  { label: '草稿', value: 'DRAFT' },
  { label: '已提交', value: 'SUBMITTED' },
  { label: '已通过', value: 'APPROVED' },
  { label: '已驳回', value: 'REJECTED' },
]

const reviewStatusTagType: Record<string, 'info' | 'warning' | 'success' | 'danger'> = {
  DRAFT: 'info',
  SUBMITTED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
}

const reviewStatusLabel: Record<string, string> = {
  DRAFT: '草稿',
  SUBMITTED: '已提交',
  APPROVED: '已通过',
  REJECTED: '已驳回',
}

const paymentStatusTagType: Record<string, 'info' | 'warning' | 'success' | 'danger'> = {
  UNPAID: 'danger',
  PARTIAL: 'warning',
  PAID: 'success',
}

async function fetchData() {
  loading.value = true
  try {
    const data = (await getContractPage({
      page: currentPage.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined,
      reviewStatus: reviewStatus.value || undefined,
      archiveStatus: archiveStatusFilter.value || undefined,
      createdByUserId: salesFilter.value || undefined,
    })) as unknown as import('@nature/shared').PageResult<ContractItem>
    tableData.value = data.list
    total.value = data.total
    checkFileStatus()
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
  reviewStatus.value = ''
  archiveStatusFilter.value = ''
  salesFilter.value = _defaultSalesFilter()
  currentPage.value = 1
  fetchData()
}

// ── 合同文件管理 ──
const fileMap = ref<Record<number, FileItem | null>>({})
const uploadHeaders = computed(() => ({ Authorization: `Bearer ${localStorage.getItem('token')}` }))
const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const pdfType = 'application/pdf'

// 文件弹窗状态
const fileDialogVisible = ref(false)
const fileDialogContractId = ref(0)
const fileDialogFile = ref<FileItem | null>(null)
const fileDialogIsOwner = ref(false)
const filePreviewUrl = ref('')
const filePreviewLoading = ref(false)

async function checkFileStatus() {
  for (const row of tableData.value) {
    try {
      const files = (await getFileList('CONTRACT', row.id)) as any as FileItem[]
      fileMap.value[row.id] = files && files.length > 0 ? files[0] : null
    } catch {
      fileMap.value[row.id] = null
    }
  }
}

function isMyContract(row: any) {
  return row.createdBy === authStore.user?.id
}

function isSalesOnly() {
  const roles = authStore.user?.roles || []
  return roles.includes('sales') && !roles.includes('super_admin') && !roles.includes('commercial') && !roles.includes('dept_manager')
}

async function openFileDialog(row: ContractItem) {
  fileDialogContractId.value = row.id
  fileDialogFile.value = fileMap.value[row.id] || null
  fileDialogIsOwner.value = isMyContract(row)
  filePreviewUrl.value = ''
  fileDialogVisible.value = true

  // Load preview URL if file exists and is previewable
  if (fileDialogFile.value && isPreviewable(fileDialogFile.value)) {
    filePreviewLoading.value = true
    try {
      const result = (await getPreviewUrl(fileDialogFile.value.id)) as any
      filePreviewUrl.value = result.url || result
    } catch { /* ignore */ }
    filePreviewLoading.value = false
  }
}

function isPreviewable(file: FileItem) {
  return imageTypes.includes(file.contentType) || file.contentType === pdfType
}

function isImage(file: FileItem) {
  return imageTypes.includes(file.contentType)
}

async function handleFileUploadSuccess() {
  ElMessage.success('上传成功')
  fileDialogVisible.value = false
  await fetchData()
}

async function handleBeforeUpload() {
  // Delete old file before uploading new one
  if (fileDialogFile.value) {
    try { await deleteFile(fileDialogFile.value.id) } catch { /* ignore */ }
  }
  return true
}

async function handleFileDelete() {
  if (!fileDialogFile.value) return
  try {
    await ElMessageBox.confirm('确定要删除合同文件吗？', '确认删除', { type: 'warning' })
    await deleteFile(fileDialogFile.value.id)
    ElMessage.success('已删除')
    fileDialogVisible.value = false
    await fetchData()
  } catch { /* cancelled */ }
}

async function handleFileDownload() {
  if (!fileDialogFile.value) return
  try {
    const result = (await getDownloadUrl(fileDialogFile.value.id)) as any
    const url = result.url || result
    const a = document.createElement('a')
    a.href = url
    a.download = fileDialogFile.value.fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } catch { ElMessage.error('下载失败') }
}

function formatFileSize(size: number) {
  if (!size) return '-'
  if (size < 1024) return size + ' B'
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB'
  return (size / 1024 / 1024).toFixed(1) + ' MB'
}


function handleCreate() {
  router.push('/contract/create')
}

function handleView(row: ContractItem) {
  router.push(`/contract/${row.id}`)
}

function handleEdit(row: ContractItem) {
  router.push(`/contract/${row.id}/edit`)
}

async function handleSubmit(row: ContractItem) {
  try {
    // 检查是否已上传合同文件
    const files = (await getFileList('CONTRACT', row.id)) as any as FileItem[]
    if (!files || files.length === 0) {
      await ElMessageBox.confirm(
        '未上传合同文件，是否直接提交？',
        '提交确认',
        { confirmButtonText: '是', cancelButtonText: '否', type: 'warning' },
      )
    } else {
      await ElMessageBox.confirm('确定要提交该合同进行审核吗？', '提交确认', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      })
    }
    await submitContract(row.id)
    ElMessage.success('提交成功')
    fetchData()
  } catch {
    // cancelled or error handled by request interceptor
  }
}

async function handleDelete(row: ContractItem) {
  try {
    await deleteContract(row.id)
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

function isDraftOrRejected(row: ContractItem) {
  return row.reviewStatus === 'DRAFT' || row.reviewStatus === 'REJECTED'
}

function isDraft(row: ContractItem) {
  return row.reviewStatus === 'DRAFT'
}

function formatAmount(amount: number | null) {
  if (amount == null) return '--'
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
  loadSalesUsers()
  fetchData()
})
</script>

<template>
  <div>
    <el-card shadow="never">
      <template #header>
        <div style="display: flex; align-items: center; justify-content: space-between">
          <span style="font-weight: 600; font-size: 16px">合同管理</span>
          <el-button
            v-permission="'contract:create'"
            type="primary"
            :icon="Plus"
            @click="handleCreate"
          >
            新建合同
          </el-button>
        </div>
      </template>

      <!-- Search bar -->
      <div style="margin-bottom: 16px; display: flex; gap: 12px">
        <el-input
          v-model="keyword"
          placeholder="搜索合同编号 / 合同名称"
          clearable
          style="width: 280px"
          :prefix-icon="Search"
          @keyup.enter="handleSearch"
        />
        <el-select
          v-model="reviewStatus"
          placeholder="审核状态"
          clearable
          style="width: 140px"
          @change="handleSearch"
        >
          <el-option
            v-for="opt in reviewStatusOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
        <el-select
          v-model="archiveStatusFilter"
          placeholder="归档状态"
          clearable
          style="width: 140px"
          @change="handleSearch"
        >
          <el-option label="待归档" value="PENDING_ARCHIVE" />
          <el-option label="未完成归档" value="PARTIAL_ARCHIVE" />
          <el-option label="已归档" value="ARCHIVED" />
        </el-select>
        <el-select
          v-model="salesFilter"
          placeholder="签单销售"
          clearable
          filterable
          style="width: 160px"
          @change="handleSearch"
        >
          <el-option
            v-for="u in salesOptions"
            :key="u.id"
            :label="u.displayName"
            :value="u.id"
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
        <el-table-column label="合同编号" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.contractNo || '--' }}
          </template>
        </el-table-column>
        <el-table-column label="合同名称" min-width="220">
          <template #default="{ row }">
            <el-link type="primary" :underline="false" style="white-space: normal; word-break: break-all; line-height: 1.5" @click="router.push(`/contract/${row.id}`)">{{ row.contractName }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="partnerName" label="合作方" width="120">
          <template #default="{ row }">{{ row.partnerName || '-' }}</template>
        </el-table-column>
        <el-table-column label="系统名称（等级）" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <div v-if="row.systemItemsSummary?.length">
              <div v-for="(item, idx) in row.systemItemsSummary" :key="idx" style="line-height: 1.6">
                {{ item.systemName }}（{{ item.systemLevel }}级）
              </div>
            </div>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="客户名称" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <el-link v-if="row.customerId" type="primary" :underline="false" @click="router.push(`/customer/${row.customerId}`)">{{ row.customerName || '--' }}</el-link>
            <span v-else>{{ row.customerName || '--' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="salesPersonName" label="签单销售" min-width="100" show-overflow-tooltip>
          <template #default="{ row }">{{ row.salesPersonName || '--' }}</template>
        </el-table-column>
        <el-table-column label="合同金额" min-width="130" align="right">
          <template #default="{ row }">
            {{ formatAmount(row.paymentAmount) }}
          </template>
        </el-table-column>
        <el-table-column label="审核状态" min-width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="reviewStatusTagType[row.reviewStatus] || 'info'" size="small">
              {{ reviewStatusLabel[row.reviewStatus] || row.reviewStatus }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="归档状态" min-width="120" align="center">
          <template #default="{ row }">
            <el-tag
              :type="row.archiveStatus === 'ARCHIVED' ? 'success' : row.archiveStatus === 'PARTIAL_ARCHIVE' ? 'warning' : 'info'"
              size="small"
              effect="plain"
            >
              {{ getStatusLabel(row.archiveStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="归档人" min-width="100" align="center">
          <template #default="{ row }">{{ row.archiverName || '-' }}</template>
        </el-table-column>
        <el-table-column label="回款状态" min-width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.paymentStatus" :type="paymentStatusTagType[row.paymentStatus] || 'info'" size="small">
              {{ getStatusLabel(row.paymentStatus) || row.paymentStatus }}
            </el-tag>
            <span v-else style="color: var(--el-text-color-placeholder)">--</span>
          </template>
        </el-table-column>
        <el-table-column label="合同文件" min-width="100" align="center">
          <template #default="{ row }">
            <template v-if="isSalesOnly() && !isMyContract(row)">
              <el-tag type="info" size="small">-</el-tag>
            </template>
            <template v-else>
              <el-button
                :type="fileMap[row.id] ? 'success' : 'info'"
                link
                size="small"
                @click="openFileDialog(row)"
                style="text-decoration: underline; text-underline-offset: 3px"
              >
                <el-icon v-if="fileMap[row.id]" style="margin-right: 2px"><Paperclip /></el-icon>
                {{ fileMap[row.id] ? '已上传' : '上传' }}
              </el-button>
            </template>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" min-width="170" />
        <el-table-column label="操作" width="240">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleView(row)">
              查看
            </el-button>
            <el-button
              v-if="isDraftOrRejected(row) && isMyContract(row)"
              v-permission="'contract:update'"
              type="primary"
              link
              size="small"
              @click="handleEdit(row)"
            >
              编辑
            </el-button>
            <el-button
              v-if="isDraftOrRejected(row) && isMyContract(row)"
              v-permission="'contract:create'"
              type="warning"
              link
              size="small"
              @click="handleSubmit(row)"
            >
              提交审核
            </el-button>
            <el-button
              v-if="row.reviewStatus === 'APPROVED'"
              v-permission="'contract:archive'"
              type="success"
              link
              size="small"
              @click="router.push(`/contract/${row.id}?action=archive`)"
            >
              归档
            </el-button>
            <el-popconfirm
              v-if="isDraft(row) && isMyContract(row)"
              title="确定要删除该合同吗？"
              confirm-button-text="确定"
              cancel-button-text="取消"
              @confirm="handleDelete(row)"
            >
              <template #reference>
                <el-button
                  v-permission="'contract:delete'"
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

    <!-- ── 合同文件弹窗 ── -->
    <el-dialog
      v-model="fileDialogVisible"
      title="合同文件"
      width="600px"
      destroy-on-close
    >
      <!-- 已上传 -->
      <template v-if="fileDialogFile">
        <el-descriptions :column="2" border size="small" style="margin-bottom: 16px">
          <el-descriptions-item label="文件名" :span="2">{{ fileDialogFile.fileName }}</el-descriptions-item>
          <el-descriptions-item label="大小">{{ formatFileSize(fileDialogFile.fileSize) }}</el-descriptions-item>
          <el-descriptions-item label="上传时间">{{ formatTime(fileDialogFile.uploadedAt) }}</el-descriptions-item>
        </el-descriptions>

        <!-- 图片预览 -->
        <div v-if="isImage(fileDialogFile)" style="text-align: center; margin: 16px 0">
          <el-image
            v-if="filePreviewUrl"
            :src="filePreviewUrl"
            :preview-src-list="[filePreviewUrl]"
            fit="contain"
            style="max-width: 100%; max-height: 400px; border-radius: 8px"
          />
          <div v-else-if="filePreviewLoading" v-loading="true" style="height: 200px" />
        </div>

        <!-- PDF 预览 -->
        <div v-else-if="fileDialogFile.contentType === 'application/pdf'" style="margin: 16px 0">
          <iframe
            v-if="filePreviewUrl"
            :src="filePreviewUrl"
            style="width: 100%; height: 400px; border: 1px solid var(--el-border-color); border-radius: 8px"
          />
          <div v-else-if="filePreviewLoading" v-loading="true" style="height: 200px" />
        </div>

        <!-- 非预览文件提示 -->
        <div v-else style="text-align: center; padding: 30px 0; color: var(--el-text-color-secondary)">
          该文件格式不支持在线预览，请下载查看
        </div>

        <!-- 操作按钮 -->
        <div style="display: flex; gap: 8px; justify-content: center; margin-top: 16px">
          <el-button type="primary" :icon="Download" @click="handleFileDownload">下载</el-button>
          <template v-if="fileDialogIsOwner">
            <el-upload
              :action="getUploadUrl('CONTRACT', fileDialogContractId)"
              :headers="uploadHeaders"
              :show-file-list="false"
              :before-upload="handleBeforeUpload"
              :on-success="handleFileUploadSuccess"
              accept=".pdf,.zip,.rar,.doc,.docx,.jpg,.jpeg,.png"
            >
              <el-button type="warning" :icon="Upload">更换</el-button>
            </el-upload>
            <el-button type="danger" plain @click="handleFileDelete">删除</el-button>
          </template>
        </div>
      </template>

      <!-- 未上传 -->
      <template v-else>
        <div style="text-align: center; padding: 40px 0">
          <template v-if="fileDialogIsOwner">
            <p style="color: var(--el-text-color-secondary); margin-bottom: 16px">暂未上传合同文件</p>
            <el-upload
              :action="getUploadUrl('CONTRACT', fileDialogContractId)"
              :headers="uploadHeaders"
              :show-file-list="false"
              :on-success="handleFileUploadSuccess"
              accept=".pdf,.zip,.rar,.doc,.docx,.jpg,.jpeg,.png"
            >
              <el-button type="primary" :icon="Upload">上传合同文件</el-button>
            </el-upload>
          </template>
          <template v-else>
            <el-empty description="暂未上传合同文件" :image-size="80" />
          </template>
        </div>
      </template>
    </el-dialog>
  </div>
</template>
