<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Download, Delete, Upload } from '@element-plus/icons-vue'
import {
  getAssessmentFiles,
  uploadAssessmentFile,
  getAssessmentFileDownloadUrl,
  deleteAssessmentFile,
  type AssessmentFileItem,
} from '@/api/assessment-file'
import {
  getCompileFiles,
  uploadCompileFile,
  getCompileFileDownloadUrl,
  deleteCompileFile,
  type CompileFileItem,
} from '@/api/compile-file'
import { formatTime } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'

type FileRow = (AssessmentFileItem | CompileFileItem) & { uploaderName?: string | null; compilerName?: string | null }

const props = withDefaults(defineProps<{
  /** 'assessment' uses assessment-file API; 'compile' uses compile-file API */
  apiType: 'assessment' | 'compile'
  projectRegisterId: number
  /** Only for assessment: ASSESSMENT_FILE or ASSESSMENT_RESULT */
  filePool?: string
  readonly?: boolean
  accept?: string
}>(), {
  readonly: false,
  accept: '.zip,.rar,.7z,.tar.gz,.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg',
})

const emit = defineEmits<{ uploaded: [] }>()
const authStore = useAuthStore()
const files = ref<FileRow[]>([])
const loading = ref(false)

// Upload dialog
const uploadDialogVisible = ref(false)
const uploadFile = ref<File | null>(null)
const uploadRemark = ref('')
const uploading = ref(false)

function getUploaderName(row: FileRow): string {
  return (row as any).uploaderName || (row as any).compilerName || '-'
}

function getUploaderId(row: FileRow): number {
  return (row as any).uploadedBy || (row as any).compiledBy || 0
}

async function fetchFiles() {
  if (!props.projectRegisterId) return
  loading.value = true
  try {
    if (props.apiType === 'assessment') {
      files.value = (await getAssessmentFiles(props.projectRegisterId, props.filePool)) as any
    } else {
      files.value = (await getCompileFiles(props.projectRegisterId)) as any
    }
  } catch {
    files.value = []
  } finally {
    loading.value = false
  }
}

function openUploadDialog() {
  uploadFile.value = null
  uploadRemark.value = ''
  uploadDialogVisible.value = true
}

function handleFileChange(rawFile: any) {
  uploadFile.value = rawFile.raw || rawFile
  return false // prevent auto upload
}

async function handleUploadConfirm() {
  if (!uploadFile.value) {
    ElMessage.warning('请选择文件')
    return
  }
  uploading.value = true
  try {
    if (props.apiType === 'assessment') {
      await uploadAssessmentFile(
        props.projectRegisterId,
        props.filePool || 'ASSESSMENT_FILE',
        uploadFile.value,
        uploadRemark.value.trim() || undefined,
      )
    } else {
      await uploadCompileFile(
        props.projectRegisterId,
        uploadFile.value,
        uploadRemark.value.trim() || undefined,
      )
    }
    ElMessage.success('上传成功')
    uploadDialogVisible.value = false
    fetchFiles()
    emit('uploaded')
  } catch {
    // interceptor handles
  } finally {
    uploading.value = false
  }
}

async function handleDownload(fileId: number) {
  try {
    let result: any
    if (props.apiType === 'assessment') {
      result = await getAssessmentFileDownloadUrl(fileId)
    } else {
      result = await getCompileFileDownloadUrl(fileId)
    }
    window.open((result as any).url, '_blank')
  } catch {
    ElMessage.error('下载失败')
  }
}

async function handleDelete(fileId: number) {
  try {
    if (props.apiType === 'assessment') {
      await deleteAssessmentFile(fileId)
    } else {
      await deleteCompileFile(fileId)
    }
    ElMessage.success('已删除')
    fetchFiles()
  } catch { /* interceptor */ }
}

function formatFileSize(bytes: number) {
  if (!bytes) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

onMounted(fetchFiles)
watch(() => [props.apiType, props.projectRegisterId, props.filePool], fetchFiles)

defineExpose({ refresh: fetchFiles })
</script>

<template>
  <div v-loading="loading">
    <div v-if="!readonly" style="margin-bottom: 12px; text-align: right">
      <el-button type="primary" size="small" :icon="Upload" @click="openUploadDialog">上传文件</el-button>
    </div>

    <el-table v-if="files.length > 0" :data="files" stripe border size="small">
      <el-table-column prop="fileName" label="文件名" min-width="200" show-overflow-tooltip />
      <el-table-column label="大小" width="100">
        <template #default="{ row }">{{ formatFileSize(row.fileSize) }}</template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip>
        <template #default="{ row }">{{ row.remark || '-' }}</template>
      </el-table-column>
      <el-table-column label="上传人" width="100">
        <template #default="{ row }">{{ getUploaderName(row) }}</template>
      </el-table-column>
      <el-table-column label="上传时间" width="170">
        <template #default="{ row }">{{ formatTime(row.uploadedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="140" align="center">
        <template #default="{ row }">
          <el-button type="primary" link :icon="Download" @click="handleDownload(row.id)">下载</el-button>
          <el-popconfirm v-if="!readonly && getUploaderId(row) === authStore.user?.id" title="确定删除？" @confirm="handleDelete(row.id)">
            <template #reference>
              <el-button type="danger" link :icon="Delete">删除</el-button>
            </template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-else description="暂无文件" :image-size="60" />

    <!-- 上传弹窗 -->
    <el-dialog v-model="uploadDialogVisible" title="上传文件" width="480px" :close-on-click-modal="false">
      <el-form label-width="80px">
        <el-form-item label="选择文件">
          <el-upload
            :auto-upload="false"
            :show-file-list="true"
            :limit="1"
            :on-change="handleFileChange"
            :accept="accept"
          >
            <el-button type="primary" size="small">选择文件</el-button>
          </el-upload>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="uploadRemark" type="textarea" :rows="2" maxlength="500" show-word-limit placeholder="请输入备注（选填）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="uploadDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="uploading" @click="handleUploadConfirm">确认上传</el-button>
      </template>
    </el-dialog>
  </div>
</template>
