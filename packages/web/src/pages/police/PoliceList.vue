<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Download, Upload, Delete } from '@element-plus/icons-vue'
import { getPoliceRegisterPage, exportPoliceExcel } from '@/api/police'
import type { PoliceItem } from '@/api/police'
import { getFileList, getUploadUrl, getFileDownloadPath, getFilePreviewPath, deleteFile, type FileItem } from '@/api/file'
import { formatTime } from '@/utils/format'

const router = useRouter()
const tableData = ref<PoliceItem[]>([])
const loading = ref(false)
const keyword = ref('')
const statusFilter = ref('PENDING')  // 默认筛选"待登记"
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)

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
function handleReset() { keyword.value = ''; statusFilter.value = 'PENDING'; currentPage.value = 1; fetchData() }

// ── 文件管理弹窗 ──
const fileDialogVisible = ref(false)
const fileDialogPoliceId = ref(0)
const fileDialogFiles = ref<FileItem[]>([])
const uploadHeaders = computed(() => ({ Authorization: `Bearer ${localStorage.getItem('token')}` }))

async function openFileDialog(row: PoliceItem) {
  fileDialogPoliceId.value = row.id
  fileDialogVisible.value = true
  await refreshFileList()
}

async function refreshFileList() {
  try {
    fileDialogFiles.value = (await getFileList('POLICE', fileDialogPoliceId.value)) as any as FileItem[]
  } catch {
    fileDialogFiles.value = []
  }
}

function handleFileUploadSuccess() {
  ElMessage.success('上传成功')
  refreshFileList()
  fetchData()
}

async function handleFileDelete(fileId: number) {
  try {
    await ElMessageBox.confirm('确定删除该文件？', '确认', { type: 'warning' })
    await deleteFile(fileId)
    ElMessage.success('已删除')
    refreshFileList()
    fetchData()
  } catch { /* cancelled */ }
}

function openDownload(fileId: number) {
  window.open(getFileDownloadPath(fileId), '_blank')
}

function formatFileSize(bytes: number) {
  if (!bytes) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// ── File preview (opens in new tab; backend applies watermark) ──
const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
function canPreviewByName(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return imageExts.some((e) => lower.endsWith(e)) || lower.endsWith('.pdf')
}

function openFilePreview(fileId: number, fileName: string) {
  if (!canPreviewByName(fileName)) {
    openDownload(fileId)
    return
  }
  window.open(getFilePreviewPath(fileId), '_blank')
}

onMounted(() => fetchData())
</script>

<template>
  <div>
    <el-card shadow="never">
      <template #header>
        <div style="display: flex; align-items: center; justify-content: space-between">
          <span style="font-weight: 600; font-size: 16px">公安登记</span>
        </div>
      </template>

      <div style="margin-bottom: 16px; display: flex; gap: 12px">
        <el-input v-model="keyword" placeholder="搜索项目名称" clearable style="width: 280px" :prefix-icon="Search" @keyup.enter="handleSearch" />
        <el-select v-model="statusFilter" placeholder="状态" clearable style="width: 120px" @change="handleSearch">
          <el-option label="待登记" value="PENDING" />
          <el-option label="已登记" value="COMPLETED" />
        </el-select>
        <el-button :icon="Search" type="primary" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="handleReset">重置</el-button>
      </div>

      <el-table v-loading="loading" :data="tableData" stripe border style="width: 100%">
        <el-table-column label="项目名称" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <el-link type="primary" underline="never" style="white-space: normal; word-break: break-all; line-height: 1.5" @click="router.push(`/police/${row.id}`)">
              {{ row.applicationName || '--' }}
            </el-link>
          </template>
        </el-table-column>
        <el-table-column label="系统数量" min-width="90" align="center">
          <template #default="{ row }">{{ row.systemItemCount ?? 0 }}</template>
        </el-table-column>
        <el-table-column prop="pmName" label="项目经理" min-width="100" show-overflow-tooltip>
          <template #default="{ row }">{{ row.pmName || '--' }}</template>
        </el-table-column>
        <el-table-column prop="pmMobile" label="手机号" min-width="130">
          <template #default="{ row }">{{ row.pmMobile || '--' }}</template>
        </el-table-column>
        <el-table-column label="电子扫描件" min-width="100" align="center">
          <template #default="{ row }">
            <el-button
              :type="row.hasFile ? 'success' : 'info'"
              link size="small"
              @click="openFileDialog(row)"
            >
              {{ row.hasFile ? '已上传' : '上传' }}
            </el-button>
          </template>
        </el-table-column>
        <el-table-column label="状态" min-width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'COMPLETED' ? 'success' : 'info'" size="small">
              {{ row.status === 'COMPLETED' ? '已登记' : '待登记' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="router.push(`/police/${row.id}`)">查看</el-button>
            <el-button type="success" link size="small" :icon="Download" @click="exportPoliceExcel(row.id)">导出</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div style="display: flex; justify-content: flex-end; margin-top: 16px">
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

    <!-- 电子扫描件管理弹窗 -->
    <el-dialog v-model="fileDialogVisible" title="电子扫描件管理" width="640px" destroy-on-close>
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px">
        <span style="font-weight: 600; font-size: 14px">扫描件列表</span>
        <el-upload
          :action="getUploadUrl('POLICE', fileDialogPoliceId)"
          :headers="uploadHeaders"
          :show-file-list="false"
          :on-success="handleFileUploadSuccess"
          accept=".pdf,.jpg,.jpeg,.png,.zip"
        >
          <el-button type="primary" :icon="Upload" size="small">上传</el-button>
        </el-upload>
      </div>
      <el-table v-if="fileDialogFiles.length > 0" :data="fileDialogFiles" border size="small">
        <el-table-column prop="fileName" label="文件名" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <el-link type="primary" underline="never" @click="openFilePreview(row.id, row.fileName)">
              {{ row.fileName }}
            </el-link>
          </template>
        </el-table-column>
        <el-table-column label="大小" width="90">
          <template #default="{ row }">{{ formatFileSize(row.fileSize) }}</template>
        </el-table-column>
        <el-table-column label="上传时间" width="160">
          <template #default="{ row }">{{ formatTime(row.uploadedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" :icon="Download" @click="openDownload(row.id)">下载</el-button>
            <el-button type="danger" link size="small" :icon="Delete" @click="handleFileDelete(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div v-else style="color: var(--el-text-color-placeholder); text-align: center; padding: 24px 0; font-size: 13px">
        暂无扫描件，请点击上方按钮上传
      </div>
    </el-dialog>
  </div>
</template>
