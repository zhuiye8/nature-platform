<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Edit, Download, Delete, Paperclip, Upload } from '@element-plus/icons-vue'
import { getContractDetail, archiveContract, updateContractFinancial } from '@/api/contract'
import type { ContractItem, ArchiveContractData, UpdateFinancialData } from '@/api/contract'
import { getFileList, getDownloadUrl, getPreviewUrl, deleteFile, getUploadUrl, type FileItem } from '@/api/file'
import { ElMessage } from 'element-plus'
import { getInstanceByBiz } from '@/api/workflow'
import { getCustomerPage, type CustomerItem } from '@/api/customer'
import { getPartnerList, type PartnerItem } from '@/api/partner'
import RejectReasonPanel from '@/components/RejectReasonPanel.vue'
import { getStatusLabel, getStatusTagType } from '@/utils/status-map'
import { formatTime } from '@/utils/format'
import { usePermission } from '@/composables/usePermission'
import { useAuthStore } from '@/stores/auth'

const { hasPermission } = usePermission()
const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()
const loading = ref(false)
const contract = ref<any>(null)
const workflowData = ref<any>(null)

// Contract file
const contractFile = ref<FileItem | null>(null)
const filePreviewUrl = ref('')
const contractId = computed(() => Number(route.params.id))
const isCreator = computed(() => contract.value?.createdBy === authStore.user?.id)
const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

async function fetchFiles() {
  try {
    const files = (await getFileList('CONTRACT', contractId.value)) as any as FileItem[]
    contractFile.value = files && files.length > 0 ? files[0] : null
    if (contractFile.value && (imageTypes.includes(contractFile.value.contentType) || contractFile.value.contentType === 'application/pdf')) {
      const result = (await getPreviewUrl(contractFile.value.id)) as any
      filePreviewUrl.value = result.url || result
    } else {
      filePreviewUrl.value = ''
    }
  } catch { contractFile.value = null }
}

async function handleFileDownload() {
  if (!contractFile.value) return
  try {
    const result = (await getDownloadUrl(contractFile.value.id)) as any
    const a = document.createElement('a')
    a.href = result.url || result
    a.download = contractFile.value.fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } catch { ElMessage.error('下载失败') }
}

function formatFileSize(bytes: number) {
  if (!bytes) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// Whether financial data is restricted
const isRestricted = computed(() => contract.value?._restricted === true)

// Archive form
const archiveForm = ref<any>({
  signedAt: '',
  storageLocation: '',
  fileCount: undefined,
  archiveRemark: '',
  isComplete: false,
})
const archiving = ref(false)
const scanFiles = ref<FileItem[]>([])
const scanUploadHeaders = computed(() => ({ Authorization: `Bearer ${localStorage.getItem('token')}` }))

async function fetchScanFiles() {
  try {
    scanFiles.value = (await getFileList('CONTRACT_SCAN', contractId.value)) as any as FileItem[]
  } catch { scanFiles.value = [] }
}

async function handleScanUploadSuccess() {
  ElMessage.success('扫描件上传成功')
  await fetchScanFiles()
}

async function handleScanDelete(fileId: number) {
  try {
    await deleteFile(fileId)
    ElMessage.success('已删除')
    await fetchScanFiles()
  } catch { /* ignore */ }
}

const previewableContentTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']

async function handleScanPreview(file: FileItem) {
  if (!previewableContentTypes.includes(file.contentType)) {
    ElMessage.info('该文件格式不支持在线预览')
    return
  }
  try {
    const result = (await getPreviewUrl(file.id)) as any
    const url = result.url || result
    window.open(url, '_blank')
  } catch { ElMessage.error('获取预览链接失败') }
}

async function handleScanDownload(file: FileItem) {
  try {
    const result = (await getDownloadUrl(file.id)) as any
    const a = document.createElement('a')
    a.href = result.url || result
    a.download = file.fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } catch { ElMessage.error('下载失败') }
}

const canArchive = computed(() =>
  contract.value?.reviewStatus === 'APPROVED' &&
  (contract.value?.archiveStatus === 'PENDING_ARCHIVE' || contract.value?.archiveStatus === 'PARTIAL_ARCHIVE') &&
  hasPermission('contract:archive'),
)

const canEdit = computed(() => {
  if (!contract.value) return false
  return contract.value.reviewStatus === 'DRAFT' || contract.value.reviewStatus === 'REJECTED'
})

function initArchiveForm() {
  if (contract.value && canArchive.value) {
    archiveForm.value = {
      signedAt: contract.value.signedAt ?? '',
      storageLocation: contract.value.storageLocation ?? '',
      fileCount: contract.value.fileCount ?? undefined,
      archiveRemark: contract.value.archiveRemark ?? '',
      isComplete: false,
    }
    fetchScanFiles()
  }
}

async function handleArchive() {
  archiving.value = true
  try {
    const { isComplete, ...data } = archiveForm.value
    await archiveContract(Number(route.params.id), { ...data, isComplete })
    ElMessage.success(isComplete ? '归档完成' : '已保存（未完成归档）')
    fetchDetail()
  } catch {
    // handled by interceptor
  } finally {
    archiving.value = false
  }
}

async function fetchDetail() {
  const id = Number(route.params.id)
  if (!id) return
  loading.value = true
  try {
    contract.value = await getContractDetail(id)
    try {
      workflowData.value = await getInstanceByBiz('CONTRACT', id)
    } catch {
      workflowData.value = null
    }
  } finally {
    loading.value = false
    initArchiveForm()
    fetchScanFiles()
    fetchFiles()
  }
}


function formatAmount(amount: any) {
  if (amount == null || amount === '') return '--'
  return '¥ ' + Number(amount).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const actionLogs = computed(() => {
  const logs = workflowData.value?.actionLogs || workflowData.value?.logs || []
  return logs
})

// ── 财务信息编辑弹窗 ──
const canEditFinancial = computed(() => hasPermission('contract:update_financial'))
const financialDialogVisible = ref(false)
const financialSaving = ref(false)
const financialForm = ref<UpdateFinancialData>({})
const paymentMethodOptions = ['结项', '分期', '月结', '预付']
const payerCustomerOptions = ref<CustomerItem[]>([])
const payerPartnerOptions = ref<PartnerItem[]>([])

async function loadPayerOptions() {
  try {
    const [custRes, partRes] = await Promise.all([
      getCustomerPage({ page: 1, pageSize: 200 }),
      getPartnerList(),
    ])
    payerCustomerOptions.value = ((custRes as any)?.list ?? custRes) as CustomerItem[]
    payerPartnerOptions.value = (partRes as any) ?? []
  } catch { /* ignore */ }
}

function openFinancialDialog() {
  financialForm.value = {
    paymentAmount: contract.value?.paymentAmount ?? undefined,
    paymentMethod: contract.value?.paymentMethod ?? '',
    paymentCompany: contract.value?.paymentCompany ?? '',
    performanceCity: contract.value?.performanceCity ?? '',
    paymentStatus: contract.value?.paymentStatus ?? '',
    paymentRemark: contract.value?.paymentRemark ?? '',
  }
  loadPayerOptions()
  financialDialogVisible.value = true
}

async function saveFinancial() {
  financialSaving.value = true
  try {
    await updateContractFinancial(contractId.value, financialForm.value)
    ElMessage.success('财务信息更新成功')
    financialDialogVisible.value = false
    await fetchDetail()
  } finally {
    financialSaving.value = false
  }
}

const paymentStatusOptions = [
  { label: '未回款', value: 'UNPAID' },
  { label: '部分回款', value: 'PARTIAL' },
  { label: '已回款', value: 'PAID' },
]

const archiveRef = ref<HTMLElement>()

onMounted(async () => {
  await fetchDetail()
  // If action=archive, scroll to archive section
  if (route.query.action === 'archive') {
    await nextTick()
    archiveRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
})
</script>

<template>
  <div class="n-page-container" v-loading="loading">
    <!-- ── 页头 ──────────────────────────────────────────────── -->
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px">
      <div style="display: flex; align-items: center; gap: 12px">
        <el-button :icon="ArrowLeft" @click="router.back()">返回</el-button>
        <h2 style="margin: 0; font-size: 18px; color: var(--el-text-color-primary)">合同详情</h2>
        <el-tag v-if="contract" :type="getStatusTagType(contract.reviewStatus)" size="large">
          {{ getStatusLabel(contract.reviewStatus) }}
        </el-tag>
        <el-tag v-if="contract && contract.archiveStatus !== 'PENDING_ARCHIVE'" :type="getStatusTagType(contract.archiveStatus)" size="large">
          {{ getStatusLabel(contract.archiveStatus) }}
        </el-tag>
      </div>
      <el-button
        v-if="canEdit && hasPermission('contract:update')"
        type="primary"
        :icon="Edit"
        @click="router.push(`/contract/${contract?.id}/edit`)"
      >编辑</el-button>
    </div>

    <template v-if="contract">
      <!-- 驳回意见醒目提示 -->
      <RejectReasonPanel v-if="contract.reviewStatus === 'REJECTED'" biz-type="CONTRACT" :biz-id="contract.id" />

      <!-- ── 基本信息 ────────────────────────────────────────── -->
      <!-- ── 1. 基本信息 ──────────────────────────────────────── -->
      <el-card shadow="never" style="margin-bottom: 16px">
        <template #header>
          <span style="font-weight: 600; font-size: 15px">基本信息</span>
        </template>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="合同编号">
            <span v-if="contract.contractNo" style="font-weight: 600; color: var(--el-color-primary)">{{ contract.contractNo }}</span>
            <span v-else style="color: var(--el-text-color-placeholder)">审核通过后自动生成</span>
          </el-descriptions-item>
          <el-descriptions-item label="合同名称" :span="2">
            <span v-if="contract.contractName" style="font-weight: 500">{{ contract.contractName }}</span>
            <span v-else style="color: var(--el-text-color-placeholder)">审核通过后自动生成</span>
          </el-descriptions-item>
          <el-descriptions-item label="客户名称">{{ contract.customerName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="联系人">{{ contract.contactName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="联系电话">{{ contract.contactPhone || '--' }}</el-descriptions-item>
          <el-descriptions-item label="合同类型">{{ getStatusLabel(contract.contractType) || contract.contractType || '--' }}</el-descriptions-item>
          <el-descriptions-item label="成交情况">{{ getStatusLabel(contract.dealStatus) || contract.dealStatus || '--' }}</el-descriptions-item>
          <el-descriptions-item label="签单销售">{{ contract.salesPersonName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="合作方">{{ contract.partnerName || '--' }}</el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- ── 2. 财务信息（受限用户不可见） ──────────────────── -->
      <el-card v-if="!isRestricted" shadow="never" style="margin-bottom: 16px">
        <template #header>
          <div style="display: flex; align-items: center; justify-content: space-between">
            <span style="font-weight: 600; font-size: 15px">财务信息</span>
            <el-button v-if="canEditFinancial" type="primary" size="small" :icon="Edit" @click="openFinancialDialog">编辑</el-button>
          </div>
        </template>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="合同金额">
            <span v-if="contract.paymentAmount" style="font-weight: 600; color: #e6a23c">{{ formatAmount(contract.paymentAmount) }}</span>
            <span v-else>--</span>
          </el-descriptions-item>
          <el-descriptions-item label="付款方式">{{ contract.paymentMethod || '--' }}</el-descriptions-item>
          <el-descriptions-item label="付款单位">{{ contract.paymentCompany || '--' }}</el-descriptions-item>
          <el-descriptions-item label="合作方">{{ contract.partnerName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="业绩归属城市">{{ contract.performanceCity || '--' }}</el-descriptions-item>
          <el-descriptions-item label="回款状态">
            <el-tag v-if="contract.paymentStatus" :type="getStatusTagType(contract.paymentStatus)" size="small">
              {{ getStatusLabel(contract.paymentStatus) }}
            </el-tag>
            <span v-else>--</span>
          </el-descriptions-item>
          <el-descriptions-item label="回款备注" :span="2">{{ contract.paymentRemark || '--' }}</el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- ── 3. 服务信息 ────────────────────────────────────── -->
      <el-card shadow="never" style="margin-bottom: 16px">
        <template #header>
          <span style="font-weight: 600; font-size: 15px">服务信息</span>
        </template>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="服务年份">
            <template v-if="Array.isArray(contract.serviceYears) && contract.serviceYears.length">
              <el-tag v-for="y in contract.serviceYears" :key="y" size="small" style="margin-right: 6px">{{ y }}年</el-tag>
            </template>
            <span v-else>--</span>
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- ── 4. 系统明细 ────────────────────────────────────── -->
      <el-card v-if="contract.systemItems?.length" shadow="never" style="margin-bottom: 16px">
        <template #header>
          <span style="font-weight: 600; font-size: 15px">系统明细（{{ contract.systemItems.length }} 个）</span>
        </template>
        <el-table :data="contract.systemItems" border size="small" stripe>
          <el-table-column type="index" label="#" width="50" align="center" />
          <el-table-column prop="systemName" label="系统名称" min-width="200" show-overflow-tooltip />
          <el-table-column label="系统等级" width="100" align="center">
            <template #default="{ row }">{{ row.systemLevel || '--' }}</template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- ── 5. 合同文件（非创建人销售不可见） ────────────── -->
      <el-card v-if="!isRestricted" shadow="never" style="margin-bottom: 16px">
        <template #header>
          <span style="font-weight: 600; font-size: 15px">合同文件</span>
        </template>
        <template v-if="contractFile">
          <div style="border: 1px solid var(--el-border-color-lighter); border-radius: 8px; padding: 16px; background: var(--el-fill-color-lighter)">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px">
              <div>
                <div style="font-weight: 500; margin-bottom: 4px">
                  <el-icon style="vertical-align: -2px; margin-right: 4px"><Paperclip /></el-icon>{{ contractFile.fileName }}
                </div>
                <div style="font-size: 12px; color: var(--el-text-color-secondary)">
                  {{ formatFileSize(contractFile.fileSize) }} · {{ formatTime(contractFile.uploadedAt) }}
                </div>
              </div>
              <el-button size="small" :icon="Download" @click="handleFileDownload">下载</el-button>
            </div>
            <div v-if="imageTypes.includes(contractFile.contentType) && filePreviewUrl" style="text-align: center; border-top: 1px solid var(--el-border-color-lighter); padding-top: 12px">
              <el-image :src="filePreviewUrl" :preview-src-list="[filePreviewUrl]" fit="contain" style="max-width: 100%; max-height: 400px; border-radius: 6px" />
            </div>
            <div v-else-if="contractFile.contentType === 'application/pdf' && filePreviewUrl" style="border-top: 1px solid var(--el-border-color-lighter); padding-top: 12px">
              <iframe :src="filePreviewUrl" style="width: 100%; height: 400px; border: none; border-radius: 6px" />
            </div>
            <div v-else style="text-align: center; padding: 20px 0; color: var(--el-text-color-placeholder); border-top: 1px solid var(--el-border-color-lighter); padding-top: 12px; font-size: 13px">
              该格式不支持在线预览，请下载查看
            </div>
          </div>
        </template>
        <el-empty v-else description="暂无合同文件" :image-size="60" />
      </el-card>

      <!-- ── 6. 其他信息 ────────────────────────────────────── -->
      <el-card shadow="never" style="margin-bottom: 16px">
        <template #header>
          <span style="font-weight: 600; font-size: 15px">其他</span>
        </template>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="备注" :span="2">{{ contract.remark || '--' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatTime(contract.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="更新时间">{{ formatTime(contract.updatedAt) }}</el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- ── 7. 归档信息（仅可归档时或已归档时显示） ────────── -->
      <el-card v-if="canArchive || (contract.archiveStatus && contract.archiveStatus !== 'PENDING_ARCHIVE')" ref="archiveRef" shadow="never" style="margin-bottom: 16px">
        <template #header>
          <div style="display: flex; align-items: center; justify-content: space-between">
            <span style="font-weight: 600; font-size: 15px">归档信息</span>
            <el-tag :type="getStatusTagType(contract.archiveStatus)" size="small">
              {{ getStatusLabel(contract.archiveStatus) }}
            </el-tag>
          </div>
        </template>
        <div v-if="canArchive">
          <el-form label-width="100px" style="max-width: 700px">
            <el-form-item label="签订时间">
              <el-date-picker v-model="archiveForm.signedAt" type="date" placeholder="请选择签订日期" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
            <el-form-item label="文件份数">
              <el-input-number v-model="archiveForm.fileCount" :min="0" :controls="false" placeholder="文件份数" style="width: 200px" />
            </el-form-item>
            <el-form-item label="存放位置">
              <el-input v-model="archiveForm.storageLocation" placeholder="请输入档案存放位置" />
            </el-form-item>
            <el-form-item label="电子扫描件">
              <div style="width: 100%">
                <el-upload
                  :action="getUploadUrl('CONTRACT_SCAN', contractId)"
                  :headers="scanUploadHeaders"
                  :show-file-list="false"
                  :on-success="handleScanUploadSuccess"
                  accept=".pdf,.jpg,.jpeg,.png,.tiff,.bmp"
                  multiple
                  style="margin-bottom: 8px"
                >
                  <el-button type="primary" size="small" :icon="Upload">上传扫描件</el-button>
                </el-upload>
                <el-table v-if="scanFiles.length > 0" :data="scanFiles" border size="small" stripe>
                  <el-table-column label="文件名" min-width="200" show-overflow-tooltip>
                    <template #default="{ row }">
                      <el-button type="primary" link @click="handleScanPreview(row)" style="text-decoration: underline; text-underline-offset: 3px">{{ row.fileName }}</el-button>
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
                      <el-button type="primary" link size="small" @click="handleScanDownload(row)">下载</el-button>
                      <el-button type="danger" link size="small" @click="handleScanDelete(row.id)">删除</el-button>
                    </template>
                  </el-table-column>
                </el-table>
                <div v-else style="color: var(--el-text-color-placeholder); font-size: 13px">暂无扫描件</div>
              </div>
            </el-form-item>
            <el-form-item label="归档备注">
              <el-input v-model="archiveForm.archiveRemark" type="textarea" :rows="2" placeholder="归档备注" />
            </el-form-item>
            <el-form-item label="归档状态">
              <el-checkbox v-model="archiveForm.isComplete">资料已全部齐全，确认完成归档</el-checkbox>
            </el-form-item>
            <el-form-item>
              <el-button
                :type="archiveForm.isComplete ? 'primary' : 'warning'"
                :loading="archiving"
                @click="handleArchive"
              >
                {{ archiveForm.isComplete ? '确认完成归档' : '保存（未完成归档）' }}
              </el-button>
            </el-form-item>
          </el-form>
        </div>
        <template v-else>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="签订时间">{{ contract.signedAt ? new Date(contract.signedAt).toLocaleDateString('zh-CN') : '--' }}</el-descriptions-item>
            <el-descriptions-item label="归档人">{{ contract.archivedByName || '--' }}</el-descriptions-item>
            <el-descriptions-item label="文件份数">{{ contract.fileCount ?? '--' }}</el-descriptions-item>
            <el-descriptions-item label="存放位置">{{ contract.storageLocation || '--' }}</el-descriptions-item>
            <el-descriptions-item label="归档备注">{{ contract.archiveRemark || '--' }}</el-descriptions-item>
          </el-descriptions>
          <!-- 只读扫描件列表 -->
          <div v-if="scanFiles.length > 0" style="margin-top: 12px">
            <h4 style="margin: 0 0 8px; font-size: 14px">电子扫描件</h4>
            <el-table :data="scanFiles" border size="small" stripe>
              <el-table-column prop="fileName" label="文件名" min-width="200" show-overflow-tooltip />
              <el-table-column label="大小" width="90">
                <template #default="{ row }">{{ formatFileSize(row.fileSize) }}</template>
              </el-table-column>
              <el-table-column label="上传时间" width="160">
                <template #default="{ row }">{{ formatTime(row.uploadedAt) }}</template>
              </el-table-column>
              <el-table-column label="操作" width="80" align="center">
                <template #default="{ row }">
                  <el-button type="primary" link size="small" @click="handleScanDownload(row)">下载</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </template>
      </el-card>

      <!-- ── 审批流程（可折叠，默认收起） ──────────────────── -->
      <el-collapse v-if="actionLogs.length > 0" style="margin-bottom: 16px">
        <el-collapse-item name="timeline">
          <template #title>
            <span style="font-weight: 600; font-size: 14px">审批流程（{{ actionLogs.length }} 条记录）</span>
          </template>
          <el-timeline style="padding-top: 12px">
            <el-timeline-item
              v-for="log in actionLogs"
              :key="log.id"
              :timestamp="formatTime(log.createdAt)"
              placement="top"
            >
              <div style="display: flex; align-items: center; gap: 8px">
                <span>{{ log.operatorName || '系统' }}</span>
                <el-tag :type="getStatusTagType(log.action)" size="small">
                  {{ getStatusLabel(log.action) }}
                </el-tag>
                <span v-if="log.nodeKey" style="font-size: 12px; color: var(--el-text-color-secondary)">
                  {{ getStatusLabel(log.nodeKey) || log.nodeKey }}
                </span>
              </div>
              <p v-if="log.remark" style="color: var(--el-text-color-secondary); margin: 4px 0 0; font-size: 13px">
                {{ log.remark }}
              </p>
            </el-timeline-item>
          </el-timeline>
        </el-collapse-item>
      </el-collapse>
    </template>

    <!-- ── 财务信息编辑弹窗 ── -->
    <el-dialog v-model="financialDialogVisible" title="编辑财务信息" width="520px" :close-on-click-modal="false">
      <el-form label-width="110px">
        <el-form-item label="合同金额（元）">
          <el-input-number v-model="financialForm.paymentAmount" :precision="2" :min="0" :controls="false" style="width: 100%" placeholder="请输入合同金额" />
        </el-form-item>
        <el-form-item label="付款方式">
          <el-select v-model="financialForm.paymentMethod" filterable allow-create clearable placeholder="请选择付款方式" style="width: 100%">
            <el-option v-for="m in paymentMethodOptions" :key="m" :label="m" :value="m" />
          </el-select>
        </el-form-item>
        <el-form-item label="付款单位">
          <el-select v-model="financialForm.paymentCompany" filterable allow-create clearable placeholder="请选择付款单位" style="width: 100%">
            <el-option-group label="客户">
              <el-option v-for="c in payerCustomerOptions" :key="'c-' + c.id" :label="c.fullName" :value="c.fullName" />
            </el-option-group>
            <el-option-group label="合作方">
              <el-option v-for="p in payerPartnerOptions" :key="'p-' + p.id" :label="p.name" :value="p.name" />
            </el-option-group>
          </el-select>
        </el-form-item>
        <el-form-item label="业绩归属城市">
          <el-input v-model="financialForm.performanceCity" placeholder="请输入业绩归属城市" />
        </el-form-item>
        <el-form-item label="回款状态">
          <el-select v-model="financialForm.paymentStatus" placeholder="请选择回款状态" clearable style="width: 100%">
            <el-option v-for="opt in paymentStatusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="回款备注">
          <el-input v-model="financialForm.paymentRemark" type="textarea" :rows="3" placeholder="如：首付30%已到账，尾款待验收后支付" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="financialDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="financialSaving" @click="saveFinancial">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
