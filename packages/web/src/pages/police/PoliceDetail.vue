<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Download, Upload, Delete, Paperclip } from '@element-plus/icons-vue'
import { getPoliceRegisterDetail, exportPoliceExcel } from '@/api/police'
import { getStatusLabel, getStatusTagType } from '@/utils/status-map'
import { formatTime } from '@/utils/format'
import { getFileList, getFileDownloadPath, getFilePreviewPath, getUploadUrl, deleteFile, type FileItem } from '@/api/file'
import { getSystemItems, type EnrichedSystemItem } from '@/api/project'
import SystemItemDetailDialog from '@/components/SystemItemDetailDialog.vue'
import AssessorLevelTag from '@/components/AssessorLevelTag.vue'
import ReportWriterCard from '@/components/ReportWriterCard.vue'

const route = useRoute()
const router = useRouter()
const policeId = computed(() => Number(route.params.id))
const loading = ref(false)
const detail = ref<any>(null)

// ── 系统明细详情弹窗 ──
const siDialogVisible = ref(false)
const siDialogItem = ref<EnrichedSystemItem | null>(null)
const systemItemsWithFiles = ref<EnrichedSystemItem[]>([])

async function loadSystemItemsWithFiles() {
  if (!detail.value?.projectRegisterId) return
  try {
    systemItemsWithFiles.value = await getSystemItems(detail.value.projectRegisterId)
  } catch { systemItemsWithFiles.value = [] }
}

function showSiDetail(row: EnrichedSystemItem) {
  const enriched = systemItemsWithFiles.value.find((i) => i.id === row.id) || row
  siDialogItem.value = enriched
  siDialogVisible.value = true
}

// ── 电子扫描件 ──
const scanFiles = ref<FileItem[]>([])
const uploadHeaders = computed(() => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
}))

async function fetchScanFiles() {
  try {
    scanFiles.value = (await getFileList('POLICE', policeId.value)) as any as FileItem[]
  } catch { scanFiles.value = [] }
}

function handleFileDownload(fileId: number) {
  window.open(getFileDownloadPath(fileId), '_blank')
}

function handleUploadSuccess() {
  ElMessage.success('上传成功')
  fetchScanFiles()
  fetchDetail()
}

async function handleDeleteFile(fileId: number) {
  try {
    await ElMessageBox.confirm('确定删除该文件？', '确认', { type: 'warning' })
    await deleteFile(fileId)
    ElMessage.success('已删除')
    fetchScanFiles()
  } catch { /* cancelled */ }
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
    openFileDownload(fileId)
    return
  }
  window.open(getFilePreviewPath(fileId), '_blank')
}

function openFileDownload(id: number) {
  window.open(getFileDownloadPath(id), '_blank')
}

// ── 项目成员分组（REPORT_WRITER 已拆到独立"报告编制" card） ──
const roleTypeLabel: Record<string, string> = { PM: '项目经理', ASSESSOR: '测评师' }
const roleTypeTagType: Record<string, 'primary' | 'success' | 'warning' | 'info'> = { PM: 'primary', ASSESSOR: 'success' }

// 后端已按 PM 第一 / 等级降序 / assignedAt 升序排序；这里仅过滤编制人
const visibleMembers = computed(() =>
  (detail.value?.projectDetail?.members ?? []).filter((m: { roleType: string }) => m.roleType !== 'REPORT_WRITER'),
)

// ── 状态映射 ──
function policeStatusLabel(s: string) {
  return s === 'COMPLETED' ? '已登记' : '待登记'
}
function policeStatusTagType(s: string) {
  return s === 'COMPLETED' ? 'success' : 'info'
}

// ── 加载数据 ──
async function fetchDetail() {
  loading.value = true
  try {
    detail.value = (await getPoliceRegisterDetail(policeId.value)) as any
  } finally {
    loading.value = false
  }
  fetchScanFiles()
  loadSystemItemsWithFiles()
}

onMounted(fetchDetail)
</script>

<template>
  <div v-loading="loading">
    <!-- 页头 -->
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px">
      <el-button :icon="ArrowLeft" @click="router.back()">返回</el-button>
      <h2 style="margin: 0; font-size: 18px; color: #303133">公安登记详情</h2>
      <el-tag v-if="detail" :type="policeStatusTagType(detail.status)" size="large">
        {{ policeStatusLabel(detail.status) }}
      </el-tag>
      <div style="flex: 1" />
      <el-button v-if="detail" type="success" :icon="Download" @click="exportPoliceExcel(policeId)">
        导出 Excel
      </el-button>
    </div>

    <template v-if="detail">
      <!-- ── 项目信息 ── -->
      <el-card v-if="detail.projectDetail" shadow="never" style="margin-bottom: 16px">
        <template #header>
          <span style="font-weight: 600">项目信息</span>
        </template>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="申请单名称">{{ detail.projectDetail.applicationName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="申请单编号">{{ detail.projectDetail.applicationNo || '--' }}</el-descriptions-item>
          <el-descriptions-item label="合同编号">{{ detail.projectDetail.contractNo || '--' }}</el-descriptions-item>
          <el-descriptions-item label="合同名称">{{ detail.projectDetail.contractName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="客户名称">{{ detail.projectDetail.customerName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="统一信用代码">{{ detail.projectDetail.customerUscc || '--' }}</el-descriptions-item>
          <el-descriptions-item label="联系人">{{ detail.projectDetail.contactName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="联系电话">{{ detail.projectDetail.contactPhone || '--' }}</el-descriptions-item>
          <el-descriptions-item label="合同年度">{{ detail.projectDetail.contractYear ? detail.projectDetail.contractYear + '年' : '--' }}</el-descriptions-item>
          <el-descriptions-item label="服务内容">{{ detail.projectDetail.serviceContent || '--' }}</el-descriptions-item>
          <el-descriptions-item label="合同类型">{{ detail.projectDetail.contractType || '--' }}</el-descriptions-item>
          <el-descriptions-item label="签单销售">{{ detail.projectDetail.salesPersonName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="合作方">{{ detail.projectDetail.partnerName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="服务年份">{{ (detail.projectDetail.serviceYears || []).map((y: number) => y + '年').join('、') || '--' }}</el-descriptions-item>
          <el-descriptions-item label="合同金额">{{ detail.projectDetail.paymentAmount ? `¥${Number(detail.projectDetail.paymentAmount).toLocaleString()}` : '--' }}</el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- ── 系统明细 ── -->
      <div v-if="detail.projectDetail?.systemItems?.length" style="margin-bottom: 16px">
        <h3 style="margin: 0 0 12px; font-size: 15px; font-weight: 600">
          系统明细（{{ detail.projectDetail.systemItems.length }} 个）
        </h3>
        <el-table :data="(systemItemsWithFiles.length ? systemItemsWithFiles : detail.projectDetail.systemItems)" stripe border size="small" style="width: 100%">
          <el-table-column prop="systemNo" label="项目编号" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">{{ row.systemNo || '--' }}</template>
          </el-table-column>
          <el-table-column prop="systemName" label="被测评系统名称" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">
              <el-link type="primary" underline="never" @click="showSiDetail(row)">{{ row.systemName }}</el-link>
            </template>
          </el-table-column>
          <el-table-column prop="filingCertificateNo" label="备案证明编号" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">{{ row.filingCertificateNo || '--' }}</template>
          </el-table-column>
          <el-table-column prop="securityLevel" label="安全保护等级" min-width="110" align="center">
            <template #default="{ row }">{{ row.securityLevel || '--' }}</template>
          </el-table-column>
          <el-table-column prop="filingAgency" label="备案机关" min-width="150" show-overflow-tooltip>
            <template #default="{ row }">{{ row.filingAgency || '--' }}</template>
          </el-table-column>
          <el-table-column prop="assessedUnitName" label="被测评系统单位名称" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">{{ row.assessedUnitName || '--' }}</template>
          </el-table-column>
          <el-table-column label="备案证明" width="100" align="center">
            <template #default="{ row }">
              <el-link v-if="row.filingCertificateFile" type="primary" :underline="false" @click="openFilePreview(row.filingCertificateFile.id, row.filingCertificateFile.fileName)">
                <el-icon><Paperclip /></el-icon>
              </el-link>
              <span v-else style="color: #999">--</span>
            </template>
          </el-table-column>
          <el-table-column label="备案表" width="80" align="center">
            <template #default="{ row }">
              <el-link v-if="row.hasFilingForm && row.filingFormFile" type="primary" :underline="false" @click="openFilePreview(row.filingFormFile.id, row.filingFormFile.fileName)">
                <el-icon><Paperclip /></el-icon>
              </el-link>
              <span v-else-if="row.hasFilingForm" style="color: #e6a23c">有</span>
              <span v-else style="color: #999">--</span>
            </template>
          </el-table-column>
          <el-table-column label="定级报告" width="80" align="center">
            <template #default="{ row }">
              <el-link v-if="row.hasClassificationReport && row.classificationReportFile" type="primary" :underline="false" @click="openFilePreview(row.classificationReportFile.id, row.classificationReportFile.fileName)">
                <el-icon><Paperclip /></el-icon>
              </el-link>
              <span v-else-if="row.hasClassificationReport" style="color: #e6a23c">有</span>
              <span v-else style="color: #999">--</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" fixed="right" align="center">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="showSiDetail(row)">详情</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- ── 项目成员 ── -->
      <el-card shadow="never" style="margin-bottom: 16px">
        <template #header>
          <span style="font-weight: 600">项目成员</span>
        </template>
        <el-table
          v-if="visibleMembers.length"
          :data="visibleMembers"
          stripe border style="width: 100%"
        >
          <el-table-column label="姓名" min-width="160">
            <template #default="{ row }">
              <span>{{ row.displayName }}</span>
              <AssessorLevelTag v-if="row.level" :level="row.level" />
            </template>
          </el-table-column>
          <el-table-column label="角色" min-width="120" align="center">
            <template #default="{ row }">
              <el-tag :type="roleTypeTagType[row.roleType] || 'info'" size="small">
                {{ roleTypeLabel[row.roleType] || row.roleType }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="状态" min-width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="getStatusTagType(row.status)" size="small">{{ getStatusLabel(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="分配时间" min-width="170">
            <template #default="{ row }">{{ formatTime(row.assignedAt) || '--' }}</template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="暂无项目成员" :image-size="60" />
      </el-card>

      <!-- ── 报告编制（编制人单独展示） ── -->
      <ReportWriterCard
        v-if="detail.projectDetail?.reportWriter"
        :report-writer="detail.projectDetail.reportWriter"
      />

      <!-- ── 电子扫描件 ── -->
      <el-card shadow="never" style="margin-bottom: 16px">
        <template #header>
          <div style="display: flex; align-items: center; justify-content: space-between">
            <span style="font-weight: 600">电子扫描件</span>
            <el-upload
              :action="getUploadUrl('POLICE', policeId)"
              :headers="uploadHeaders"
              :show-file-list="false"
              :on-success="handleUploadSuccess"
              accept=".pdf,.jpg,.jpeg,.png,.zip"
            >
              <el-button type="primary" :icon="Upload" size="small">上传</el-button>
            </el-upload>
          </div>
        </template>

        <el-table v-if="scanFiles.length > 0" :data="scanFiles" border size="small">
          <el-table-column label="#" type="index" width="50" align="center" />
          <el-table-column prop="fileName" label="文件名" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">
              <el-link type="primary" underline="never" @click="openFilePreview(row.id, row.fileName)">
                <el-icon style="vertical-align: -2px; margin-right: 4px"><Paperclip /></el-icon>{{ row.fileName }}
              </el-link>
            </template>
          </el-table-column>
          <el-table-column label="大小" width="100">
            <template #default="{ row }">{{ formatFileSize(row.fileSize) }}</template>
          </el-table-column>
          <el-table-column label="上传时间" width="170">
            <template #default="{ row }">{{ formatTime(row.uploadedAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="120" align="center">
            <template #default="{ row }">
              <el-button type="primary" link size="small" :icon="Download" @click="handleFileDownload(row.id)">下载</el-button>
              <el-button type="danger" link size="small" :icon="Delete" @click="handleDeleteFile(row.id)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-upload
          v-else
          :action="getUploadUrl('POLICE', policeId)"
          :headers="uploadHeaders"
          :show-file-list="false"
          :on-success="handleUploadSuccess"
          drag
          accept=".pdf,.jpg,.jpeg,.png,.zip"
          style="width: 100%"
        >
          <el-icon style="font-size: 40px; color: var(--el-text-color-placeholder); margin-bottom: 8px"><Upload /></el-icon>
          <div style="color: var(--el-text-color-regular); font-size: 14px">将文件拖到此处，或<em style="color: var(--el-color-primary)">点击上传</em></div>
          <div style="color: var(--el-text-color-placeholder); font-size: 12px; margin-top: 4px">支持 PDF、JPG、PNG、ZIP 格式</div>
        </el-upload>
      </el-card>
    </template>

    <SystemItemDetailDialog
      v-model:visible="siDialogVisible"
      :item="siDialogItem"
    />
  </div>
</template>
