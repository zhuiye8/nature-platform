<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Download, Upload, Delete, Paperclip } from '@element-plus/icons-vue'
import { getPoliceRegisterDetail, exportPoliceExcel } from '@/api/police'
import { getStatusLabel, getStatusTagType } from '@/utils/status-map'
import { formatTime } from '@/utils/format'
import { getFileList, getFileDownloadPath, getFilePreviewPath, getUploadUrl, deleteFile, type FileItem } from '@/api/file'
import { getSystemItems } from '@/api/project'
import SystemItemDetailDialog from '@/components/SystemItemDetailDialog.vue'

const route = useRoute()
const router = useRouter()
const policeId = computed(() => Number(route.params.id))
const loading = ref(false)
const detail = ref<any>(null)

// ── 系统明细详情弹窗 ──
const siDialogVisible = ref(false)
const siDialogItem = ref<any>(null)
const systemItemsWithFiles = ref<any[]>([])

async function loadSystemItemsWithFiles() {
  if (!detail.value?.projectRegisterId) return
  try {
    systemItemsWithFiles.value = (await getSystemItems(detail.value.projectRegisterId)) as any[]
  } catch { systemItemsWithFiles.value = [] }
}

function showSiDetail(row: any) {
  const enriched = systemItemsWithFiles.value.find((i: any) => i.id === row.id) || row
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

const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
function isImage(file: FileItem) {
  return imageTypes.includes((file as any).contentType || '')
}
function isPdf(file: FileItem) {
  return (file as any).contentType === 'application/pdf'
}

// ── File preview dialog ──
const previewVisible = ref(false)
const previewUrl = ref('')
const previewFileName = ref('')
const previewFileId = ref(0)
const previewType = ref<'image' | 'pdf' | 'none'>('none')

const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
function getPreviewType(fileName: string): 'image' | 'pdf' | 'none' {
  const lower = fileName.toLowerCase()
  if (imageExts.some((e) => lower.endsWith(e))) return 'image'
  if (lower.endsWith('.pdf')) return 'pdf'
  return 'none'
}

function openFilePreview(fileId: number, fileName: string) {
  const type = getPreviewType(fileName)
  if (type === 'none') {
    openFileDownload(fileId)
    return
  }
  previewType.value = type
  previewUrl.value = getFilePreviewPath(fileId)
  previewFileName.value = fileName
  previewFileId.value = fileId
  previewVisible.value = true
}

function openFileDownload(id: number) {
  window.open(getFileDownloadPath(id), '_blank')
}

// ── 项目成员分组 ──
const roleTypeLabel: Record<string, string> = { PM: '项目经理', ASSESSOR: '测评师', REPORT_WRITER: '报告编制人' }
const roleTypeTagType: Record<string, 'primary' | 'success' | 'warning' | 'info'> = { PM: 'primary', ASSESSOR: 'success', REPORT_WRITER: 'warning' }

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
        <el-card
          v-for="(si, idx) in (systemItemsWithFiles.length ? systemItemsWithFiles : detail.projectDetail.systemItems)"
          :key="si.id || idx"
          shadow="never"
          style="margin-bottom: 12px; border: 1px solid var(--el-border-color-lighter)"
        >
          <template #header>
            <span style="font-weight: 600">{{ si.systemName }}{{ si.securityLevel ? '（' + si.securityLevel + '）' : '' }}</span>
          </template>

          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="备案机关">{{ si.filingAgency || '--' }}</el-descriptions-item>
            <el-descriptions-item label="安全等级">{{ si.securityLevel || '--' }}</el-descriptions-item>
            <el-descriptions-item label="是否复评">{{ si.isReassessment ? '是' : '否' }}</el-descriptions-item>
            <el-descriptions-item label="要求录入日期">{{ si.requiredEntryDate || '--' }}</el-descriptions-item>
            <el-descriptions-item label="要求出报告日期">{{ si.requiredReportDeliveryDate || '--' }}</el-descriptions-item>
          </el-descriptions>

          <h5 style="margin: 12px 0 8px; color: #606266">被测单位信息</h5>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="单位名称">{{ si.assessedUnitName || '--' }}</el-descriptions-item>
            <el-descriptions-item label="所属行业">{{ si.assessedUnitIndustry || '--' }}</el-descriptions-item>
            <el-descriptions-item label="联系人">{{ si.assessedUnitContact || '--' }}</el-descriptions-item>
            <el-descriptions-item label="联系电话">{{ si.assessedUnitMobile || '--' }}</el-descriptions-item>
            <el-descriptions-item label="地址" :span="2">{{ si.assessedUnitAddress || '--' }}</el-descriptions-item>
          </el-descriptions>

          <h5 style="margin: 12px 0 8px; color: #606266">备案信息</h5>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="备案证明">
              <template v-if="si.filingCertificateFile">
                <el-link type="primary" underline="never" @click="openFilePreview(si.filingCertificateFile.id, si.filingCertificateFile.fileName)">
                  {{ si.filingCertificateFile.fileName }}
                </el-link>
                <span style="color: #999; font-size: 12px; margin-left: 8px">({{ formatFileSize(si.filingCertificateFile.fileSize) }})</span>
                <el-button type="primary" link size="small" :icon="Download" style="margin-left: 8px" @click.stop="openFileDownload(si.filingCertificateFile.id)">下载</el-button>
              </template>
              <span v-else style="color: #999">未上传</span>
            </el-descriptions-item>
            <el-descriptions-item label="证明编号">{{ si.filingCertificateNo || '--' }}</el-descriptions-item>
            <el-descriptions-item label="出具时间">{{ si.filingCertificateIssuedAt || '--' }}</el-descriptions-item>
            <el-descriptions-item label="备案表">
              <template v-if="si.hasFilingForm && si.filingFormFile">
                <el-link type="primary" underline="never" @click="openFilePreview(si.filingFormFile.id, si.filingFormFile.fileName)">
                  {{ si.filingFormFile.fileName }}
                </el-link>
                <el-button type="primary" link size="small" :icon="Download" style="margin-left: 8px" @click.stop="openFileDownload(si.filingFormFile.id)">下载</el-button>
              </template>
              <span v-else-if="si.hasFilingForm" style="color: #e6a23c">有（未上传）</span>
              <span v-else style="color: #999">无</span>
            </el-descriptions-item>
            <el-descriptions-item label="定级报告">
              <template v-if="si.hasClassificationReport && si.classificationReportFile">
                <el-link type="primary" underline="never" @click="openFilePreview(si.classificationReportFile.id, si.classificationReportFile.fileName)">
                  {{ si.classificationReportFile.fileName }}
                </el-link>
                <el-button type="primary" link size="small" :icon="Download" style="margin-left: 8px" @click.stop="openFileDownload(si.classificationReportFile.id)">下载</el-button>
              </template>
              <span v-else-if="si.hasClassificationReport" style="color: #e6a23c">有（未上传）</span>
              <span v-else style="color: #999">无</span>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </div>

      <!-- ── 项目成员 ── -->
      <el-card shadow="never" style="margin-bottom: 16px">
        <template #header>
          <span style="font-weight: 600">项目成员</span>
        </template>
        <el-table
          v-if="detail.projectDetail?.members?.length"
          :data="detail.projectDetail.members"
          stripe border style="width: 100%"
        >
          <el-table-column prop="displayName" label="姓名" min-width="120" />
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

    <!-- 文件预览弹窗 -->
    <el-dialog v-model="previewVisible" :title="previewFileName" width="80%" top="5vh" destroy-on-close>
      <div v-if="previewType === 'image'" style="text-align: center">
        <el-image :src="previewUrl" fit="contain" style="max-width: 100%; max-height: 70vh" />
      </div>
      <iframe v-else-if="previewType === 'pdf'" :src="previewUrl" style="width: 100%; height: 70vh; border: none" />
      <template #footer>
        <el-button :icon="Download" @click="handleFileDownload(previewFileId)">下载</el-button>
      </template>
    </el-dialog>
  </div>
</template>
