<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus, Upload, Download, Paperclip, Delete } from '@element-plus/icons-vue'
import { getStatusLabel, getStatusTagType } from '@/utils/status-map'
import { formatTime } from '@/utils/format'
import {
  getContractGroupPage, createContractGroup, deleteContractGroup,
  deleteContract, submitContract,
} from '@/api/contract'
import type { ContractGroupItem, ContractItem } from '@/api/contract'
import { getUsersByRole } from '@/api/workflow'
import { getFileList, getUploadUrl, getFileDownloadPath, deleteFile, type FileItem } from '@/api/file'
import { useAuthStore } from '@/stores/auth'
import ActionButton from '@/components/ActionButton.vue'

const authStore = useAuthStore()
const router = useRouter()
const tableData = ref<ContractGroupItem[]>([])
const loading = ref(false)
const keyword = ref('')
const reviewStatus = ref('')
const archiveStatusFilter = ref('')
const salesFilter = ref<number | ''>('')
const salesOptions = ref<{ id: number; displayName: string }[]>([])
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

const reviewStatusOptions = [
  { label: '全部', value: '' },
  { label: '草稿', value: 'DRAFT' },
  { label: '审核中', value: 'SUBMITTED' },
  { label: '已通过', value: 'APPROVED' },
  { label: '已驳回', value: 'REJECTED' },
]

const archiveStatusOptions = [
  { label: '全部', value: '' },
  { label: '待归档', value: 'PENDING_ARCHIVE' },
  { label: '部分归档', value: 'PARTIAL_ARCHIVE' },
  { label: '已归档', value: 'ARCHIVED' },
]

async function loadSalesUsers() {
  try { salesOptions.value = (await getUsersByRole('sales')) as any } catch { salesOptions.value = [] }
}

const reviewStatusLabel: Record<string, string> = {
  DRAFT: '草稿', SUBMITTED: '审核中', APPROVED: '已通过', REJECTED: '已驳回',
}
const reviewStatusTagType: Record<string, 'info' | 'warning' | 'success' | 'danger'> = {
  DRAFT: 'info', SUBMITTED: 'warning', APPROVED: 'success', REJECTED: 'danger',
}
async function fetchData() {
  loading.value = true
  try {
    const data = (await getContractGroupPage({
      page: currentPage.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined,
      reviewStatus: reviewStatus.value || undefined,
      archiveStatus: archiveStatusFilter.value || undefined,
      salesPersonId: salesFilter.value || undefined,
    } as any)) as any
    tableData.value = data.list
    total.value = data.total
    // Load file status for all contracts
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
  salesFilter.value = ''
  currentPage.value = 1
  fetchData()
}

// ── 合同组操作 ──
const groupDialogVisible = ref(false)
const groupForm = ref({ groupName: '', remark: '' })
const groupSaving = ref(false)

function openCreateGroupDialog() {
  groupForm.value = { groupName: '', remark: '' }
  groupDialogVisible.value = true
}

async function handleCreateGroup() {
  if (!groupForm.value.groupName.trim()) {
    ElMessage.warning('请输入合同组名称')
    return
  }
  groupSaving.value = true
  try {
    await createContractGroup(groupForm.value)
    ElMessage.success('合同组创建成功')
    groupDialogVisible.value = false
    fetchData()
  } finally {
    groupSaving.value = false
  }
}

async function handleDeleteGroup(groupId: number) {
  try {
    await ElMessageBox.confirm('确定删除该合同组？（组内无合同时才可删除）', '确认', { type: 'warning' })
    await deleteContractGroup(groupId)
    ElMessage.success('已删除')
    fetchData()
  } catch { /* cancelled */ }
}

function handleAddContract(groupId: number) {
  router.push(`/contract/create?groupId=${groupId}`)
}

// ── 合同操作 ──
function isMyContract(row: any) {
  const uid = Number(authStore.user?.id)
  return Number(row.createdBy) === uid || Number(row.salesPersonId) === uid
}

function isDraftOrRejected(row: any) {
  return row.reviewStatus === 'DRAFT' || row.reviewStatus === 'REJECTED'
}


// ── 文件管理 ──
const fileMap = ref<Record<number, boolean>>({})
const descFileMap = ref<Record<number, boolean>>({})
const uploadHeaders = computed(() => ({ Authorization: `Bearer ${localStorage.getItem('token')}` }))

const fileDialogVisible = ref(false)
const fileDialogContractId = ref(0)
const fileDialogFiles = ref<FileItem[]>([])
const fileDialogDescFile = ref<FileItem | null>(null)
const fileDialogIsOwner = ref(false)

async function checkFileStatus() {
  for (const group of tableData.value) {
    for (const c of group.contracts) {
      try {
        const files = (await getFileList('CONTRACT', c.id)) as any as FileItem[]
        fileMap.value[c.id] = files && files.length > 0
      } catch { fileMap.value[c.id] = false }
      try {
        const descFiles = (await getFileList('CONTRACT_DESC', c.id)) as any as FileItem[]
        descFileMap.value[c.id] = descFiles && descFiles.length > 0
      } catch { descFileMap.value[c.id] = false }
    }
  }
}

async function openFileDialog(row: ContractItem) {
  fileDialogContractId.value = row.id
  fileDialogIsOwner.value = isMyContract(row)
  fileDialogVisible.value = true
  await loadDialogFiles()
}

async function loadDialogFiles() {
  try {
    fileDialogFiles.value = (await getFileList('CONTRACT', fileDialogContractId.value)) as any as FileItem[]
  } catch { fileDialogFiles.value = [] }
  try {
    const descFiles = (await getFileList('CONTRACT_DESC', fileDialogContractId.value)) as any as FileItem[]
    fileDialogDescFile.value = descFiles && descFiles.length > 0 ? descFiles[0] : null
  } catch { fileDialogDescFile.value = null }
}

async function handleFileUploadSuccess() {
  ElMessage.success('上传成功')
  await loadDialogFiles()
  await checkFileStatus()
}

async function handleDialogFileDelete(fileId: number) {
  try {
    await ElMessageBox.confirm('确定删除？', '确认', { type: 'warning' })
    await deleteFile(fileId)
    ElMessage.success('已删除')
    await loadDialogFiles()
    await checkFileStatus()
  } catch { /* cancelled */ }
}

async function handleDescBeforeUpload() {
  if (fileDialogDescFile.value) {
    try { await deleteFile(fileDialogDescFile.value.id) } catch {}
  }
  return true
}

function openDownload(fileId: number) {
  window.open(getFileDownloadPath(fileId), '_blank')
}

function formatFileSize(size: number) {
  if (!size) return '-'
  if (size < 1024) return size + ' B'
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB'
  return (size / 1024 / 1024).toFixed(1) + ' MB'
}

async function handleSubmit(row: ContractItem) {
  try {
    const files = (await getFileList('CONTRACT', row.id)) as any as FileItem[]
    const descFiles = (await getFileList('CONTRACT_DESC', row.id)) as any as FileItem[]
    const missingItems: string[] = []
    if (!files || files.length === 0) missingItems.push('合同文件')
    if (!descFiles || descFiles.length === 0) missingItems.push('合同文件说明')
    if (missingItems.length > 0) {
      ElMessage.warning(`请先上传${missingItems.join('和')}`)
      return
    }
    await ElMessageBox.confirm('确定要提交该合同进行审核吗？', '提交确认', { type: 'warning' })
    await submitContract(row.id)
    ElMessage.success('提交成功')
    fetchData()
  } catch { /* cancelled */ }
}

async function handleDelete(row: ContractItem) {
  try {
    await ElMessageBox.confirm('确定删除？', '确认', { type: 'warning' })
    await deleteContract(row.id)
    ElMessage.success('删除成功')
    fetchData()
  } catch { /* cancelled */ }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null
watch(keyword, () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => handleSearch(), 300)
})

onMounted(() => {
  fetchData()
  loadSalesUsers()
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
            @click="openCreateGroupDialog"
          >
            新建合同组
          </el-button>
        </div>
      </template>

      <!-- 搜索 -->
      <div style="margin-bottom: 16px; display: flex; gap: 12px; flex-wrap: wrap">
        <el-input
          v-model="keyword"
          placeholder="搜索合同组 / 合同名称 / 合同编号"
          clearable
          style="width: 320px"
          :prefix-icon="Search"
          @keyup.enter="handleSearch"
        />
        <el-select v-model="reviewStatus" placeholder="审核状态" clearable style="width: 130px" @change="handleSearch">
          <el-option v-for="opt in reviewStatusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
        <el-select v-model="archiveStatusFilter" placeholder="归档状态" clearable style="width: 130px" @change="handleSearch">
          <el-option v-for="opt in archiveStatusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
        <el-select v-model="salesFilter" placeholder="签单销售" filterable clearable style="width: 140px" @change="handleSearch">
          <el-option v-for="u in salesOptions" :key="u.id" :label="u.displayName" :value="u.id" />
        </el-select>
        <el-button :icon="Search" type="primary" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="handleReset">重置</el-button>
      </div>

      <!-- 合同组列表 -->
      <el-table
        v-loading="loading"
        :data="tableData"
        stripe
        border
        style="width: 100%"
        row-key="id"
      >
        <el-table-column type="expand">
          <template #default="{ row: group }">
            <div style="padding: 12px 24px">
              <el-table v-if="group.contracts.length > 0" :data="group.contracts" border size="small" style="width: 100%">
                <el-table-column label="合同名称" min-width="200" show-overflow-tooltip>
                  <template #default="{ row }">
                    <el-link type="primary" underline="never" style="white-space: normal; word-break: break-all; line-height: 1.5" @click="router.push(`/contract/${row.id}`)">{{ row.contractName || '--' }}</el-link>
                  </template>
                </el-table-column>
                <el-table-column prop="contractNo" label="合同编号" min-width="180" show-overflow-tooltip />
                <el-table-column label="合同分类" min-width="100" align="center">
                  <template #default="{ row }">
                    <el-tag v-if="row.contractCategory" size="small">{{ row.contractCategory }}</el-tag>
                    <span v-else>--</span>
                  </template>
                </el-table-column>
                <el-table-column label="合同金额" min-width="120" align="right">
                  <template #default="{ row }">
                    {{ row.paymentAmount ? `¥${Number(row.paymentAmount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '--' }}
                  </template>
                </el-table-column>
                <el-table-column label="签单销售" min-width="100">
                  <template #default="{ row }">{{ row.salesPersonName || '--' }}</template>
                </el-table-column>
                <el-table-column label="审核状态" min-width="100" align="center">
                  <template #default="{ row }">
                    <el-tag :type="reviewStatusTagType[row.reviewStatus] || 'info'" size="small">
                      {{ reviewStatusLabel[row.reviewStatus] || row.reviewStatus }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="归档状态" min-width="100" align="center">
                  <template #default="{ row }">
                    <template v-if="row.reviewStatus === 'APPROVED'">
                      <el-tag v-if="row.archiveStatus === 'ARCHIVED'" type="success" size="small">已归档</el-tag>
                      <el-tag v-else-if="row.archiveStatus === 'PARTIAL_ARCHIVE'" type="warning" size="small">部分归档</el-tag>
                      <el-tag v-else type="info" size="small">待归档</el-tag>
                    </template>
                    <span v-else>--</span>
                  </template>
                </el-table-column>
                <el-table-column label="归档人" min-width="90">
                  <template #default="{ row }">{{ row.archiverName || '--' }}</template>
                </el-table-column>
                <el-table-column label="合同文件" min-width="80" align="center">
                  <template #default="{ row }">
                    <el-button
                      :type="fileMap[row.id] ? 'success' : 'info'"
                      link size="small"
                      @click="openFileDialog(row)"
                    >
                      {{ fileMap[row.id] ? '已上传' : '上传' }}
                    </el-button>
                  </template>
                </el-table-column>
                <el-table-column label="文件说明" min-width="80" align="center">
                  <template #default="{ row }">
                    <el-button
                      :type="descFileMap[row.id] ? 'success' : 'info'"
                      link size="small"
                      @click="openFileDialog(row)"
                    >
                      {{ descFileMap[row.id] ? '已上传' : '上传' }}
                    </el-button>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="260" fixed="right">
                  <template #default="{ row }">
                    <el-button type="primary" link size="small" @click="router.push(`/contract/${row.id}`)">查看</el-button>
                    <!-- 统一操作按钮(审核 / 归档): 按 my-tasks 判断可见性和文案 -->
                    <ActionButton biz-type="CONTRACT" :biz-id="row.id" />
                    <el-button
                      v-if="isDraftOrRejected(row) && isMyContract(row)"
                      type="primary" link size="small"
                      @click="router.push(`/contract/${row.id}/edit`)"
                    >编辑</el-button>
                    <el-button
                      v-if="isDraftOrRejected(row) && isMyContract(row)"
                      type="warning" link size="small"
                      @click="handleSubmit(row)"
                    >提交审核</el-button>
                    <el-button
                      v-if="row.reviewStatus === 'DRAFT' && isMyContract(row)"
                      type="danger" link size="small"
                      @click="handleDelete(row)"
                    >删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
              <div v-else style="color: #909399; text-align: center; padding: 16px 0">暂无合同</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="合同组名称" min-width="250" show-overflow-tooltip>
          <template #default="{ row }">
            <span style="font-weight: 500">{{ row.groupName }}</span>
          </template>
        </el-table-column>
        <el-table-column label="合同数" width="80" align="center">
          <template #default="{ row }">{{ row.contracts?.length ?? 0 }}</template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="200" show-overflow-tooltip />
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button
              v-permission="'contract:create'"
              type="primary" link size="small"
              @click="handleAddContract(row.id)"
            >新增合同</el-button>
            <el-button
              v-permission="'contract:delete'"
              type="danger" link size="small"
              @click="handleDeleteGroup(row.id)"
            >删除</el-button>
          </template>
        </el-table-column>
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

    <!-- 新建合同组弹窗 -->
    <el-dialog v-model="groupDialogVisible" title="新建合同组" width="480px" :close-on-click-modal="false">
      <el-form label-width="100px">
        <el-form-item label="合同组名称" required>
          <el-input v-model="groupForm.groupName" placeholder="请输入合同组名称" @keyup.enter="handleCreateGroup" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="groupForm.remark" type="textarea" :rows="2" placeholder="备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="groupDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="groupSaving" @click="handleCreateGroup">创建</el-button>
      </template>
    </el-dialog>

    <!-- 合同文件管理弹窗 -->
    <el-dialog v-model="fileDialogVisible" title="合同文件管理" width="680px" destroy-on-close>
      <div style="margin-bottom: 20px">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px">
          <span style="font-weight: 600; font-size: 14px">合同文件</span>
          <el-upload
            v-if="fileDialogIsOwner"
            :action="getUploadUrl('CONTRACT', fileDialogContractId)"
            :headers="uploadHeaders"
            :show-file-list="false"
            :on-success="handleFileUploadSuccess"
            accept=".pdf,.zip,.rar,.doc,.docx,.jpg,.jpeg,.png"
          >
            <el-button type="primary" :icon="Upload" size="small">上传</el-button>
          </el-upload>
        </div>
        <el-table v-if="fileDialogFiles.length > 0" :data="fileDialogFiles" border size="small">
          <el-table-column prop="fileName" label="文件名" min-width="200" show-overflow-tooltip />
          <el-table-column label="大小" width="90">
            <template #default="{ row }">{{ formatFileSize(row.fileSize) }}</template>
          </el-table-column>
          <el-table-column label="上传时间" width="160">
            <template #default="{ row }">{{ formatTime(row.uploadedAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="120" align="center">
            <template #default="{ row }">
              <el-button type="primary" link size="small" :icon="Download" @click="openDownload(row.id)">下载</el-button>
              <el-button v-if="fileDialogIsOwner" type="danger" link size="small" :icon="Delete" @click="handleDialogFileDelete(row.id)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div v-else style="color: var(--el-text-color-placeholder); text-align: center; padding: 16px 0; font-size: 13px">暂无合同文件</div>
      </div>

      <div>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px">
          <span style="font-weight: 600; font-size: 14px">合同文件说明</span>
          <template v-if="fileDialogIsOwner && !fileDialogDescFile">
            <el-upload
              :action="getUploadUrl('CONTRACT_DESC', fileDialogContractId)"
              :headers="uploadHeaders"
              :show-file-list="false"
              :on-success="handleFileUploadSuccess"
              accept=".pdf,.zip,.rar,.doc,.docx,.jpg,.jpeg,.png"
            >
              <el-button type="primary" :icon="Upload" size="small">上传</el-button>
            </el-upload>
          </template>
        </div>
        <template v-if="fileDialogDescFile">
          <div style="display: flex; align-items: center; justify-content: space-between; border: 1px solid var(--el-border-color-lighter); border-radius: 6px; padding: 10px 14px; background: var(--el-fill-color-lighter)">
            <div>
              <el-icon style="vertical-align: -2px; margin-right: 4px"><Paperclip /></el-icon>
              <span>{{ fileDialogDescFile.fileName }}</span>
              <span style="font-size: 12px; color: var(--el-text-color-secondary); margin-left: 12px">{{ formatFileSize(fileDialogDescFile.fileSize) }}</span>
            </div>
            <div style="display: flex; gap: 6px">
              <el-button size="small" link type="primary" :icon="Download" @click="openDownload(fileDialogDescFile.id)">下载</el-button>
              <template v-if="fileDialogIsOwner">
                <el-upload
                  :action="getUploadUrl('CONTRACT_DESC', fileDialogContractId)"
                  :headers="uploadHeaders"
                  :show-file-list="false"
                  :before-upload="handleDescBeforeUpload"
                  :on-success="handleFileUploadSuccess"
                  accept=".pdf,.zip,.rar,.doc,.docx,.jpg,.jpeg,.png"
                >
                  <el-button size="small" link type="warning">替换</el-button>
                </el-upload>
                <el-button size="small" link type="danger" @click="handleDialogFileDelete(fileDialogDescFile.id)">删除</el-button>
              </template>
            </div>
          </div>
        </template>
        <div v-else style="color: var(--el-text-color-placeholder); text-align: center; padding: 16px 0; font-size: 13px">暂无文件说明</div>
      </div>
    </el-dialog>
  </div>
</template>
