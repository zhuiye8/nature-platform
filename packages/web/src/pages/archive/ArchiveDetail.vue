<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Upload, Download, Delete } from '@element-plus/icons-vue'
import { getArchiveByProject, submitArchive } from '@/api/archive'
import { getSystemItems, type EnrichedSystemItem } from '@/api/project'
import { getFileList, getFileDownloadPath, deleteFile, uploadFileToPool, type FileItem } from '@/api/file'
import { getStatusLabel, getStatusTagType } from '@/utils/status-map'
import { formatTime } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import FilePoolPanel from '@/components/FilePoolPanel.vue'
import SystemItemDetailDialog from '@/components/SystemItemDetailDialog.vue'
import AssessorLevelTag from '@/components/AssessorLevelTag.vue'
import ReportWriterCard from '@/components/ReportWriterCard.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const projectRegisterId = Number(route.params.projectRegisterId)

// ── Role detection ──
const userRoles = computed(() => authStore.user?.roles || [])
const isArchiver = computed(() => userRoles.value.includes('archiver') || userRoles.value.includes('super_admin'))
const canUploadPool = computed(() =>
  userRoles.value.includes('sales') || userRoles.value.includes('project_manager') || userRoles.value.includes('super_admin'),
)

const data = ref<any>(null)
const loading = ref(true)
const submitting = ref(false)

// ════════════════════════════════════════════════════════════
// 文件池（销售/PM 上传原始材料）
// ════════════════════════════════════════════════════════════
const poolFiles = ref<FileItem[]>([])
const poolUploadDialogVisible = ref(false)
const poolUploadFile = ref<File | null>(null)
const poolUploadRemark = ref('')
const poolUploading = ref(false)

async function fetchPoolFiles() {
  try {
    const allFiles = (await getFileList('ARCHIVE', projectRegisterId)) as any as FileItem[]
    poolFiles.value = allFiles || []
  } catch { poolFiles.value = [] }
}

function openPoolUploadDialog() {
  poolUploadFile.value = null
  poolUploadRemark.value = ''
  poolUploadDialogVisible.value = true
}

function handlePoolFileChange(rawFile: any) {
  poolUploadFile.value = rawFile.raw || rawFile
  return false
}

async function handlePoolUploadConfirm() {
  if (!poolUploadFile.value) {
    ElMessage.warning('请选择文件')
    return
  }
  poolUploading.value = true
  try {
    await uploadFileToPool('ARCHIVE', projectRegisterId, poolUploadFile.value, poolUploadRemark.value.trim() || undefined)
    ElMessage.success('上传成功')
    poolUploadDialogVisible.value = false
    fetchPoolFiles()
  } catch { /* interceptor */ }
  finally { poolUploading.value = false }
}

function handlePoolFileDownload(fileId: number) {
  window.open(getFileDownloadPath(fileId), '_blank')
}

async function handlePoolFileDelete(fileId: number) {
  try {
    await deleteFile(fileId)
    ElMessage.success('已删除')
    fetchPoolFiles()
  } catch { /* interceptor */ }
}

function formatFileSize(bytes: number) {
  if (!bytes) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// ════════════════════════════════════════════════════════════
// 归档附件（归档员上传最终版，bizType='ARCHIVE_FINAL'）
// ════════════════════════════════════════════════════════════
const finalFiles = ref<FileItem[]>([])
const finalUploadDialogVisible = ref(false)
const finalUploadFile = ref<File | null>(null)
const finalUploadRemark = ref('')
const finalUploading = ref(false)

async function fetchFinalFiles() {
  try {
    const files = (await getFileList('ARCHIVE_FINAL', projectRegisterId)) as any as FileItem[]
    finalFiles.value = files || []
  } catch { finalFiles.value = [] }
}

function openFinalUploadDialog() {
  finalUploadFile.value = null
  finalUploadRemark.value = ''
  finalUploadDialogVisible.value = true
}

function handleFinalFileChange(rawFile: any) {
  finalUploadFile.value = rawFile.raw || rawFile
  return false
}

async function handleFinalUploadConfirm() {
  if (!finalUploadFile.value) {
    ElMessage.warning('请选择文件')
    return
  }
  finalUploading.value = true
  try {
    await uploadFileToPool('ARCHIVE_FINAL', projectRegisterId, finalUploadFile.value, finalUploadRemark.value.trim() || undefined)
    ElMessage.success('上传成功')
    finalUploadDialogVisible.value = false
    fetchFinalFiles()
  } catch { /* interceptor */ }
  finally { finalUploading.value = false }
}

async function handleFinalFileDelete(fileId: number) {
  try {
    await deleteFile(fileId)
    ElMessage.success('已删除')
    fetchFinalFiles()
  } catch { /* interceptor */ }
}

// ════════════════════════════════════════════════════════════
// 卷内清单（18项勾选确认）
// ════════════════════════════════════════════════════════════
interface MaterialItem {
  code: string
  label: string
  docNo: string
  checked: boolean
}

const materialChecklist = ref<MaterialItem[]>([
  { code: 'CX18-01', label: '测评项目计划书', docNo: 'YZDZR/CX18-01', checked: false },
  { code: 'CX18-02', label: '基本情况调查表', docNo: 'YZDZR/CX18-02', checked: false },
  { code: 'CX18-03', label: '网络安全等级保护测评方案', docNo: 'YZDZR/CX18-03', checked: false },
  { code: 'CX18-05', label: '测评方案评审记录表', docNo: 'YZDZR/CX18-05', checked: false },
  { code: 'CX18-06', label: '风险告知书', docNo: 'YZDZR/CX18-06', checked: false },
  { code: 'CX18-07', label: '现场测评首次会议签到及记录表', docNo: 'YZDZR/CX18-07', checked: false },
  { code: 'CX18-09', label: '现场测评授权书', docNo: 'YZDZR/CX18-09', checked: false },
  { code: 'CX18-10', label: '安全测试授权书', docNo: 'YZDZR/CX18-10', checked: false },
  { code: 'CX18-11', label: '系统状态确认书', docNo: 'YZDZR/CX18-11', checked: false },
  { code: 'CX18-12', label: '网络安全等级保护测评结果记录', docNo: 'YZDZR/CX18-12', checked: false },
  { code: 'CX18-14', label: '现场测评末次会议签到及记录表', docNo: 'YZDZR/CX18-14', checked: false },
  { code: 'CX18-17', label: '现场测评文档接收/归还记录表', docNo: 'YZDZR/CX18-17', checked: false },
  { code: 'CX17-01', label: '测评设备使用申请表', docNo: 'YZDZR/CX17-01', checked: false },
  { code: 'CX17-02', label: '测评设备（工具）使用表', docNo: 'YZDZR/CX17-02', checked: false },
  { code: 'CX22-02', label: '测评报告评审记录表', docNo: 'YZDZR/CX22-02', checked: false },
  { code: 'CX22-03', label: '测评资料签收单', docNo: 'YZDZR/CX22-03', checked: false },
  { code: 'CX07-01', label: '网络安全等级保护测评服务情况评价表', docNo: 'YZDZR/CX07-01', checked: false },
  { code: 'REPORT', label: '测评报告', docNo: '/', checked: false },
])

const allChecked = computed(() => materialChecklist.value.every((i) => i.checked))
const noneChecked = computed(() => materialChecklist.value.every((i) => !i.checked))
const checkedCount = computed(() => materialChecklist.value.filter((i) => i.checked).length)

function toggleAll(val: boolean) {
  materialChecklist.value.forEach((i) => { i.checked = val })
}

// 全局存放位置 + 备注
const globalStorageLocation = ref('')
const globalRemark = ref('')

// ════════════════════════════════════════════════════════════
// System item detail
// ════════════════════════════════════════════════════════════
const siDialogVisible = ref(false)
const siDialogItem = ref<EnrichedSystemItem | null>(null)
const systemItemsWithFiles = ref<EnrichedSystemItem[]>([])

async function loadSystemItemsWithFiles() {
  try { systemItemsWithFiles.value = await getSystemItems(projectRegisterId) }
  catch { systemItemsWithFiles.value = [] }
}

function showSiDetail(row: EnrichedSystemItem) {
  const enriched = systemItemsWithFiles.value.find((i) => i.id === row.id) || row
  siDialogItem.value = enriched
  siDialogVisible.value = true
}

// ════════════════════════════════════════════════════════════
// Computed helpers
// ════════════════════════════════════════════════════════════
const project = computed(() => data.value?.project)
const contractInfo = computed(() => project.value?.contractInfo)
const archive = computed(() => data.value?.archive)
// 成员分组（REPORT_WRITER 已拆到独立"报告编制" card）
// 后端已按 PM 第一 / 等级降序 / assignedAt 升序排序
const pmMember = computed(() => project.value?.members?.find((m: any) => m.roleType === 'PM'))
const assessors = computed(() => project.value?.members?.filter((m: any) => m.roleType === 'ASSESSOR') ?? [])
const reportWriter = computed(() => project.value?.reportWriter ?? null)

const isSubmitted = computed(() => archive.value?.status === 'SUBMITTED')
const archiveStatusLabel = computed(() => {
  if (!isSubmitted.value) return '待归档'
  return checkedCount.value >= materialChecklist.value.length ? '已归档' : '未完全归档'
})
const archiveTagType = computed(() => {
  if (!isSubmitted.value) return 'info'
  return checkedCount.value >= materialChecklist.value.length ? 'success' : 'warning'
})

// ════════════════════════════════════════════════════════════
// Data loading
// ════════════════════════════════════════════════════════════
async function fetchData() {
  loading.value = true
  try {
    data.value = await getArchiveByProject(projectRegisterId)
    if (data.value?.archive) {
      const a = data.value.archive
      globalStorageLocation.value = a.storageLocation ?? ''
      globalRemark.value = a.remark ?? ''
      const savedItems = (a.materialStatusCodes ?? []) as any[]
      for (const saved of savedItems) {
        if (typeof saved === 'object' && saved.code) {
          const item = materialChecklist.value.find((i) => i.code === saved.code)
          if (item) item.checked = saved.checked ?? false
        } else if (typeof saved === 'string') {
          const item = materialChecklist.value.find((i) => i.code === saved)
          if (item) item.checked = true
        }
      }
    }
  } finally { loading.value = false }
  loadSystemItemsWithFiles()
  fetchPoolFiles()
  fetchFinalFiles()
}

// ════════════════════════════════════════════════════════════
// Submit
// ════════════════════════════════════════════════════════════
async function handleSubmit() {
  if (finalFiles.value.length === 0) {
    ElMessage.warning('请上传至少一个归档附件（最终版）')
    return
  }
  if (!globalStorageLocation.value.trim()) {
    ElMessage.warning('请填写存放位置')
    return
  }

  const materialData = materialChecklist.value.map((item) => ({
    code: item.code,
    checked: item.checked,
  }))

  submitting.value = true
  try {
    await submitArchive({
      projectRegisterId,
      materialStatusCodes: materialData as any,
      storageLocation: globalStorageLocation.value.trim() || undefined,
      remark: globalRemark.value.trim() || undefined,
    })
    ElMessage.success(isSubmitted.value ? '归档已更新' : '归档已提交')
    fetchData()
  } finally { submitting.value = false }
}

onMounted(fetchData)
</script>

<template>
  <div v-loading="loading">
    <!-- 页头 -->
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px">
      <el-button :icon="ArrowLeft" @click="router.push('/archive')">返回</el-button>
      <h2 style="margin: 0; font-size: 18px; color: #303133">材料归档详情</h2>
      <el-tag :type="archiveTagType" size="large">{{ archiveStatusLabel }}</el-tag>
    </div>

    <template v-if="project">
      <!-- ── 项目信息 ── -->
      <el-card shadow="never" style="margin-bottom: 16px">
        <template #header><span style="font-weight: 600">项目信息</span></template>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="项目名称">{{ project.applicationName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="合同年度">{{ project.contractYear ? project.contractYear + '年' : '--' }}</el-descriptions-item>
          <el-descriptions-item label="项目状态">
            <el-tag :type="getStatusTagType(project.status)" size="small">{{ getStatusLabel(project.status) }}</el-tag>
          </el-descriptions-item>
        </el-descriptions>
        <div v-if="project.systemItems?.length" style="margin-top: 16px">
          <h4 style="margin: 0 0 8px; font-size: 14px; color: #606266">系统明细（{{ project.systemItems.length }} 个）</h4>
          <el-table :data="project.systemItems" border size="small" stripe>
            <el-table-column type="index" label="#" width="50" align="center" />
            <el-table-column prop="systemNo" label="项目编号" min-width="180" show-overflow-tooltip>
              <template #default="{ row }">{{ row.systemNo || '--' }}</template>
            </el-table-column>
            <el-table-column prop="systemName" label="系统名称" min-width="150" show-overflow-tooltip />
            <el-table-column label="安全等级" width="90" align="center">
              <template #default="{ row }">{{ row.securityLevel || '--' }}</template>
            </el-table-column>
            <el-table-column prop="assessedUnitName" label="被测单位" min-width="120" show-overflow-tooltip />
            <el-table-column label="操作" width="80" align="center">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="showSiDetail(row)">详情</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-card>

      <!-- ── 关联合同信息 ── -->
      <el-card v-if="contractInfo" shadow="never" style="margin-bottom: 16px">
        <template #header><span style="font-weight: 600">关联合同信息</span></template>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="合同编号">{{ contractInfo.contractNo || '--' }}</el-descriptions-item>
          <el-descriptions-item label="项目名称">{{ contractInfo.projectName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="客户名称">{{ contractInfo.customerName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="合同类型">{{ getStatusLabel(contractInfo.contractType) || '--' }}</el-descriptions-item>
          <el-descriptions-item label="合同金额">{{ contractInfo.paymentAmount ?? '--' }}</el-descriptions-item>
          <el-descriptions-item label="付款方式">{{ contractInfo.paymentMethod || '--' }}</el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- ── 项目成员 ── -->
      <el-card shadow="never" style="margin-bottom: 16px">
        <template #header><span style="font-weight: 600">项目成员</span></template>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="项目经理">
            <template v-if="pmMember">
              {{ pmMember.displayName }}
              <AssessorLevelTag v-if="pmMember.level" :level="pmMember.level" />
            </template>
            <span v-else>-</span>
          </el-descriptions-item>
          <el-descriptions-item label="测评师">
            <template v-if="assessors.length > 0">
              <span
                v-for="a in assessors"
                :key="a.userId"
                style="display: inline-flex; align-items: center; margin-right: 16px; margin-bottom: 4px"
              >
                {{ a.displayName }}
                <AssessorLevelTag :level="a.level" />
              </span>
            </template>
            <span v-else>-</span>
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- ── 报告编制（编制人单独展示） ── -->
      <ReportWriterCard
        v-if="reportWriter"
        :report-writer="reportWriter"
      />

      <!-- ── 测评成果 ── -->
      <el-card shadow="never" style="margin-bottom: 16px">
        <template #header><span style="font-weight: 600">测评成果</span></template>
        <FilePoolPanel api-type="assessment" :project-register-id="projectRegisterId" file-pool="ASSESSMENT_RESULT" :readonly="true" />
      </el-card>

      <!-- ── 编制报告 ── -->
      <el-card shadow="never" style="margin-bottom: 16px">
        <template #header><span style="font-weight: 600">编制报告</span></template>
        <FilePoolPanel api-type="compile" :project-register-id="projectRegisterId" :readonly="true" />
      </el-card>

      <!-- ═══════════════════════════════════════════════════════ -->
      <!-- 归档材料（销售/PM 上传原始材料）                         -->
      <!-- ═══════════════════════════════════════════════════════ -->
      <el-card shadow="never" style="margin-bottom: 16px">
        <template #header>
          <div style="display: flex; align-items: center; justify-content: space-between">
            <span style="font-weight: 600">归档材料（销售/项目经理上传）</span>
            <el-button v-if="canUploadPool" type="primary" size="small" :icon="Upload" @click="openPoolUploadDialog">上传材料</el-button>
          </div>
        </template>

        <el-table v-if="poolFiles.length > 0" :data="poolFiles" stripe border size="small">
          <el-table-column prop="fileName" label="文件名" min-width="200" show-overflow-tooltip />
          <el-table-column label="大小" width="100">
            <template #default="{ row }">{{ formatFileSize(row.fileSize) }}</template>
          </el-table-column>
          <el-table-column label="备注" min-width="150" show-overflow-tooltip>
            <template #default="{ row }">{{ row.remark || '-' }}</template>
          </el-table-column>
          <el-table-column label="上传人" width="100">
            <template #default="{ row }">{{ row.uploaderName || '-' }}</template>
          </el-table-column>
          <el-table-column label="上传时间" width="170">
            <template #default="{ row }">{{ formatTime(row.uploadedAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="140" align="center">
            <template #default="{ row }">
              <el-button type="primary" link :icon="Download" @click="handlePoolFileDownload(row.id)">下载</el-button>
              <el-button v-if="row.uploaderId === authStore.user?.id" type="danger" link :icon="Delete" @click="handlePoolFileDelete(row.id)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="暂无上传材料" :image-size="60" />
      </el-card>

      <!-- ═══════════════════════════════════════════════════════ -->
      <!-- 卷内清单（归档员操作区）                                 -->
      <!-- ═══════════════════════════════════════════════════════ -->
      <el-card shadow="never" style="margin-bottom: 16px">
        <template #header>
          <div style="display: flex; align-items: center; justify-content: space-between">
            <span style="font-weight: 600">卷内清单（{{ checkedCount }}/{{ materialChecklist.length }}）</span>
            <div style="display: flex; align-items: center; gap: 8px">
              <template v-if="isArchiver">
                <el-button size="small" :disabled="allChecked" @click="toggleAll(true)">全选</el-button>
                <el-button size="small" :disabled="noneChecked" @click="toggleAll(false)">全不选</el-button>
              </template>
              <el-tag :type="archiveTagType" size="small">{{ archiveStatusLabel }}</el-tag>
            </div>
          </div>
        </template>

        <!-- 18项勾选表 -->
        <el-table :data="materialChecklist" border size="small" stripe row-key="code">
          <el-table-column label="" width="50" align="center">
            <template #default="{ row }">
              <el-checkbox v-if="isArchiver" v-model="row.checked" />
              <el-icon v-else-if="row.checked" style="color: #67c23a"><svg viewBox="0 0 1024 1024" width="14" height="14"><path d="M432 726.4L192 486.4l45.6-45.6L432 635.2l354.4-354.4L832 326.4z" fill="currentColor"/></svg></el-icon>
              <span v-else style="color: #dcdfe6">—</span>
            </template>
          </el-table-column>
          <el-table-column type="index" label="#" width="50" align="center" />
          <el-table-column prop="label" label="记录名称" min-width="300" />
          <el-table-column prop="docNo" label="文档编号" width="160" />
          <el-table-column label="期限" width="80" align="center">
            <template #default>永久</template>
          </el-table-column>
        </el-table>

        <!-- 归档附件（归档员上传最终版）-->
        <div style="margin-top: 20px">
          <h4 style="margin: 0 0 12px; font-size: 14px; color: #606266">
            归档附件（最终版）
            <el-button v-if="isArchiver" type="primary" size="small" :icon="Upload" style="margin-left: 12px" @click="openFinalUploadDialog">上传</el-button>
          </h4>
          <el-table v-if="finalFiles.length > 0" :data="finalFiles" stripe border size="small">
            <el-table-column prop="fileName" label="文件名" min-width="200" show-overflow-tooltip />
            <el-table-column label="大小" width="100">
              <template #default="{ row }">{{ formatFileSize(row.fileSize) }}</template>
            </el-table-column>
            <el-table-column label="备注" min-width="150" show-overflow-tooltip>
              <template #default="{ row }">{{ row.remark || '-' }}</template>
            </el-table-column>
            <el-table-column label="上传时间" width="170">
              <template #default="{ row }">{{ formatTime(row.uploadedAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="140" align="center">
              <template #default="{ row }">
                <el-button type="primary" link :icon="Download" @click="handlePoolFileDownload(row.id)">下载</el-button>
                <el-button v-if="isArchiver" type="danger" link :icon="Delete" @click="handleFinalFileDelete(row.id)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="暂无归档附件" :image-size="40" />
        </div>

        <!-- 全局存放位置 + 备注 -->
        <el-divider />
        <el-form label-width="100px" style="max-width: 600px">
          <el-form-item label="存放位置" required>
            <el-input v-if="isArchiver" v-model="globalStorageLocation" placeholder="如：A柜-001" />
            <span v-else>{{ globalStorageLocation || '--' }}</span>
          </el-form-item>
          <el-form-item label="备注">
            <el-input v-if="isArchiver" v-model="globalRemark" type="textarea" :rows="2" maxlength="500" show-word-limit placeholder="归档备注（选填）" />
            <span v-else style="white-space: pre-wrap">{{ globalRemark || '--' }}</span>
          </el-form-item>
        </el-form>

        <!-- 操作 -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 8px">
          <div v-if="archive?.submittedAt" style="color: #909399; font-size: 13px">
            上次归档时间：{{ formatTime(archive.submittedAt) }}
          </div>
          <div v-else></div>
          <el-button v-if="isArchiver" type="primary" :loading="submitting" @click="handleSubmit">
            {{ isSubmitted ? '更新归档' : '提交归档' }}
          </el-button>
        </div>
      </el-card>
    </template>

    <!-- 文件池上传弹窗 -->
    <el-dialog v-model="poolUploadDialogVisible" title="上传归档材料" width="480px" :close-on-click-modal="false">
      <el-form label-width="80px">
        <el-form-item label="选择文件">
          <el-upload :auto-upload="false" :show-file-list="true" :limit="1" :on-change="handlePoolFileChange" accept=".zip,.rar,.7z,.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg">
            <el-button type="primary" size="small">选择文件</el-button>
          </el-upload>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="poolUploadRemark" type="textarea" :rows="2" maxlength="200" show-word-limit placeholder="说明文件内容，如：测评项目计划书 + 基本情况调查表" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="poolUploadDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="poolUploading" @click="handlePoolUploadConfirm">确认上传</el-button>
      </template>
    </el-dialog>

    <!-- 归档附件上传弹窗 -->
    <el-dialog v-model="finalUploadDialogVisible" title="上传归档附件（最终版）" width="480px" :close-on-click-modal="false">
      <el-form label-width="80px">
        <el-form-item label="选择文件">
          <el-upload :auto-upload="false" :show-file-list="true" :limit="1" :on-change="handleFinalFileChange" accept=".zip,.rar,.7z,.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg">
            <el-button type="primary" size="small">选择文件</el-button>
          </el-upload>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="finalUploadRemark" type="textarea" :rows="2" maxlength="200" show-word-limit placeholder="文件说明（选填）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="finalUploadDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="finalUploading" @click="handleFinalUploadConfirm">确认上传</el-button>
      </template>
    </el-dialog>

    <SystemItemDetailDialog v-model:visible="siDialogVisible" :item="siDialogItem" />
  </div>
</template>
