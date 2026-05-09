<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Edit, Download, Delete, Paperclip, Upload, QuestionFilled } from '@element-plus/icons-vue'
import { getContractDetail, archiveContract } from '@/api/contract'
import type { ContractItem, ArchiveContractData } from '@/api/contract'
import { getFileList, getFileDownloadPath, getFilePreviewPath, deleteFile, getUploadUrl, type FileItem } from '@/api/file'
import { getSystemItems, type EnrichedSystemItem } from '@/api/project'
import { ElMessage } from 'element-plus'
import { getInstanceByBiz } from '@/api/workflow'
import ReviewOpinionPanel from "@/components/ReviewOpinionPanel.vue"
import SystemItemDetailDialog from '@/components/SystemItemDetailDialog.vue'
import { getStatusLabel, getStatusTagType } from '@/utils/status-map'
import { formatTime } from '@/utils/format'
import { SERVICE_CONTENT_TAG_TYPE } from '@/utils/enums'
import { getPaymentRecords, type PaymentRecord } from '@/api/payment-record'
import { usePermission } from '@/composables/usePermission'
import { useAuthStore } from '@/stores/auth'
import { useOperableTasks } from '@/composables/useOperableTasks'

const { hasPermission } = usePermission()
const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()
const loading = ref(false)
const contract = ref<any>(null)
const workflowData = ref<any>(null)

// Contract files (multi)
const contractFiles = ref<FileItem[]>([])
const contractDescFile = ref<FileItem | null>(null)
const contractId = computed(() => Number(route.params.id))
const isOwner = computed(() => {
  const uid = Number(authStore.user?.id)
  return Number(contract.value?.createdBy) === uid || Number(contract.value?.salesPersonId) === uid
})


async function fetchFiles() {
  try {
    contractFiles.value = (await getFileList('CONTRACT', contractId.value)) as any as FileItem[]
  } catch { contractFiles.value = [] }
  try {
    const descFiles = (await getFileList('CONTRACT_DESC', contractId.value)) as any as FileItem[]
    contractDescFile.value = descFiles && descFiles.length > 0 ? descFiles[0] : null
  } catch { contractDescFile.value = null }
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

// Whether financial data is restricted

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

// ── 系统明细详情弹窗（按需调 getSystemItems 拿 enriched，含文件对象）──
// row 来自 ContractItem.projectSystemItems 的扁平投影（仅含 projectId/systemItemId
// 等关键字段），与 EnrichedSystemItem 的 DB 行模型不同。
type ProjectSystemItemFlat = NonNullable<ContractItem['projectSystemItems']>[number]
const siDialogVisible = ref(false)
const siDialogItem = ref<EnrichedSystemItem | null>(null)
const enrichedItemsCache = new Map<number, EnrichedSystemItem[]>() // projectId → enriched items

async function showSystemItemDetail(row: ProjectSystemItemFlat) {
  let items = enrichedItemsCache.get(row.projectId)
  if (!items) {
    try {
      items = await getSystemItems(row.projectId)
      enrichedItemsCache.set(row.projectId, items)
    } catch {
      items = []
    }
  }
  const enriched = items.find((i) => i.id === row.systemItemId) ?? null
  // 若服务端 getSystemItems 取不到对应行（理论上不应发生，DB 一致性保证），
  // 则用扁平 row 构造最小 EnrichedSystemItem 兜底展示。
  siDialogItem.value = enriched ?? {
    id: row.systemItemId,
    projectRegisterId: row.projectId,
    systemNo: row.systemNo,
    systemName: row.systemName,
    filingAgency: row.filingAgency,
    filingRegion: null,
    securityLevel: row.securityLevel,
    isReassessment: false,
    requiredEntryDate: null,
    requiredReportDeliveryDate: null,
    assessedUnitName: row.assessedUnitName,
    assessedUnitIndustry: null,
    assessedUnitContact: null,
    assessedUnitMobile: null,
    assessedUnitAddress: null,
    hasFilingCertificate: !!row.filingCertificateNo,
    filingCertificateNo: row.filingCertificateNo,
    filingCertificateIssuedAt: null,
    hasFilingForm: false,
    hasClassificationReport: false,
    sortOrder: 0,
    createdAt: '',
    updatedAt: '',
    filingCertificateFile: null,
    filingFormFile: null,
    classificationReportFile: null,
  }
  siDialogVisible.value = true
}

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

function handleScanPreview(file: FileItem) {
  if (!previewableContentTypes.includes(file.contentType)) {
    ElMessage.info('该文件格式不支持在线预览')
    return
  }
  window.open(getFilePreviewPath(file.id), '_blank')
}

function handleScanDownload(file: FileItem) {
  window.open(getFileDownloadPath(file.id), '_blank')
}

// 归档权限严格按 my-tasks: 只有被分配到本合同 CONTRACT_ARCHIVE 任务的池成员能归档
// (合同审核未通过 / 已完全归档 时 my-tasks 自然无此任务,判断等价于旧的状态检查)
const { hasTaskFor: _hasTaskFor, refresh: _refreshMyTasks } = useOperableTasks()
const canArchive = computed(() =>
  _hasTaskFor('CONTRACT', Number(route.params.id), 'CONTRACT_ARCHIVE'),
)

const canEdit = computed(() => {
  if (!contract.value) return false
  if (contract.value.reviewStatus !== 'DRAFT' && contract.value.reviewStatus !== 'REJECTED') return false
  return isOwner.value
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
  // 完成归档时签订时间必填（保存未完成时可以为空，事后补充）
  if (archiveForm.value.isComplete && !archiveForm.value.signedAt) {
    ElMessage.warning('完成归档时必须填写签订时间')
    return
  }

  archiving.value = true
  try {
    const { isComplete, ...data } = archiveForm.value
    await archiveContract(Number(route.params.id), { ...data, isComplete })
    ElMessage.success(isComplete ? '归档完成' : '已保存（未完成归档）')
    // 归档完成后 my-tasks 里该任务消失,刷新缓存让 canArchive 立即更新
    if (isComplete) await _refreshMyTasks()
    fetchDetail()
  } catch {
    // handled by interceptor
  } finally {
    archiving.value = false
  }
}

// 回款明细 (只读, 任何能看到合同的人都能看)
const paymentRecords = ref<PaymentRecord[]>([])
const paymentSummary = ref({ contractAmount: 0, totalPaid: 0, remaining: 0 })

async function fetchPaymentRecords(contractId: number) {
  try {
    const data = await getPaymentRecords(contractId)
    paymentRecords.value = data.list ?? []
    paymentSummary.value = data.summary ?? { contractAmount: 0, totalPaid: 0, remaining: 0 }
  } catch {
    paymentRecords.value = []
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
    fetchPaymentRecords(id)
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
      <!-- 审核意见展示（通过/驳回/复核都展示，组件内部对无意见自动隐藏）-->
      <ReviewOpinionPanel biz-type="CONTRACT" :biz-id="contract.id" />

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
          <el-descriptions-item label="合同组">{{ contract.groupName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="合同分类">{{ contract.contractCategory || '--' }}</el-descriptions-item>
          <el-descriptions-item label="客户名称">{{ contract.customerName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="统一信用代码">{{ contract.customerUscc || '--' }}</el-descriptions-item>
          <el-descriptions-item label="联系人">{{ contract.contactName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="联系电话">{{ contract.contactPhone || '--' }}</el-descriptions-item>
          <el-descriptions-item label="服务内容">
            <el-tag v-if="contract.serviceContent" :type="SERVICE_CONTENT_TAG_TYPE[contract.serviceContent] || 'info'" size="small">
              {{ contract.serviceContent }}
            </el-tag>
            <span v-else>--</span>
          </el-descriptions-item>
          <el-descriptions-item>
            <template #label>
              <span style="display: inline-flex; align-items: center; gap: 4px">
                合同类型
                <el-tooltip placement="top">
                  <template #content>
                    <div style="line-height: 1.7">
                      <div><b>自主</b>：无第三方</div>
                      <div><b>直接合作</b>：第三方为付款方</div>
                      <div><b>间接合作</b>：本公司为付款方</div>
                    </div>
                  </template>
                  <el-icon style="color: var(--el-text-color-placeholder); cursor: help; font-size: 14px">
                    <QuestionFilled />
                  </el-icon>
                </el-tooltip>
              </span>
            </template>
            {{ contract.contractType || '--' }}
          </el-descriptions-item>
          <el-descriptions-item label="成交情况">{{ getStatusLabel(contract.dealStatus) || contract.dealStatus || '--' }}</el-descriptions-item>
          <el-descriptions-item label="签单销售">{{ contract.salesPersonName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="合作方">{{ contract.partnerName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="业绩归属城市">{{ contract.performanceCity || '--' }}</el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- ── 1b. 合同组关联合同 ──────────────────────────────── -->
      <el-card v-if="contract.groupContracts && contract.groupContracts.length > 1" shadow="never" style="margin-bottom: 16px">
        <template #header>
          <span style="font-weight: 600; font-size: 15px">合同组关联合同</span>
        </template>
        <el-table :data="contract.groupContracts" border size="small">
          <el-table-column prop="contractNo" label="合同编号" min-width="180" show-overflow-tooltip />
          <el-table-column prop="contractName" label="合同名称" min-width="200" show-overflow-tooltip />
          <el-table-column prop="contractCategory" label="分类" width="100" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.contractCategory" size="small">{{ row.contractCategory }}</el-tag>
              <span v-else>--</span>
            </template>
          </el-table-column>
          <el-table-column label="审核状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="getStatusTagType(row.reviewStatus)" size="small">{{ getStatusLabel(row.reviewStatus) || row.reviewStatus }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="" width="60" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.id === contract.id" type="primary" size="small" effect="dark">当前</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- ── 2. 财务信息 ──────────────────────────────────────── -->
      <el-card shadow="never" style="margin-bottom: 16px">
        <template #header>
          <div style="display: flex; align-items: center; justify-content: space-between">
            <span style="font-weight: 600; font-size: 15px">财务信息</span>
          </div>
        </template>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="付款金额">
            <span v-if="contract.paymentAmount" style="font-weight: 600; color: #e6a23c">{{ formatAmount(contract.paymentAmount) }}</span>
            <span v-else>--</span>
          </el-descriptions-item>
          <el-descriptions-item label="付款单位">{{ contract.paymentCompany || '--' }}</el-descriptions-item>
          <el-descriptions-item label="发票类型">{{ contract.invoiceType || '--' }}</el-descriptions-item>
          <el-descriptions-item label="税率">{{ contract.taxRate ? contract.taxRate + '%' : '--' }}</el-descriptions-item>
          <el-descriptions-item label="付款方式">{{ contract.paymentMethod || '--' }}</el-descriptions-item>
          <el-descriptions-item label="回款状态">
            <el-tag v-if="contract.paymentStatus" :type="getStatusTagType(contract.paymentStatus)" size="small">
              {{ getStatusLabel(contract.paymentStatus) }}
            </el-tag>
            <span v-else>--</span>
          </el-descriptions-item>
        </el-descriptions>
        <el-descriptions :column="1" border style="margin-top: 12px">
          <el-descriptions-item label="付款信息">
            <div style="white-space: pre-wrap">{{ contract.paymentInfo || '--' }}</div>
          </el-descriptions-item>
          <el-descriptions-item label="回款备注">{{ contract.paymentRemark || '--' }}</el-descriptions-item>
          <el-descriptions-item label="财务">{{ contract.financialHandlerName || '--' }}</el-descriptions-item>
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

      <!-- ── 4. 系统明细（来自已通过项目登记的实际执行清单）───── -->
      <!-- 此卡片展示的是 project_system_item (含 systemNo) 的整合视图，
           取代了原合同签约约定清单 (contract_system_item)。
           合同签约清单仍保留在合同编辑页 ContractForm 用于审核后生成合同名称，
           不再在详情页展示。 -->
      <el-card shadow="never" style="margin-bottom: 16px">
        <template #header>
          <div style="display: flex; align-items: center; gap: 6px">
            <span style="font-weight: 600; font-size: 15px">
              系统明细（{{ contract.projectSystemItems?.length ?? 0 }} 个）
            </span>
            <el-tooltip
              placement="top"
              content="此列表仅展示已通过项目登记申请的实际执行系统清单（含项目编号），不含合同签约时的粗粒度约定"
            >
              <el-icon style="color: var(--el-text-color-placeholder); cursor: help; font-size: 14px">
                <QuestionFilled />
              </el-icon>
            </el-tooltip>
          </div>
        </template>
        <el-table
          v-if="contract.projectSystemItems?.length"
          :data="contract.projectSystemItems"
          border
          size="small"
          stripe
        >
          <el-table-column type="index" label="#" width="50" align="center" />
          <el-table-column prop="applicationName" label="所属项目" min-width="280" show-overflow-tooltip>
            <template #default="{ row }">
              <span>{{ row.applicationName }}</span>
            </template>
          </el-table-column>
          <el-table-column label="年度" width="80" align="center">
            <template #default="{ row }">
              <el-tag size="small" type="info">{{ row.contractYear }}年</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="systemNo" label="项目编号" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">{{ row.systemNo || '--' }}</template>
          </el-table-column>
          <el-table-column prop="systemName" label="系统名称" min-width="200" show-overflow-tooltip />
          <el-table-column label="安全等级" width="100" align="center">
            <template #default="{ row }">{{ row.securityLevel || '--' }}</template>
          </el-table-column>
          <el-table-column prop="filingAgency" label="备案机关" min-width="150" show-overflow-tooltip>
            <template #default="{ row }">{{ row.filingAgency || '--' }}</template>
          </el-table-column>
          <el-table-column prop="assessedUnitName" label="被测单位" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">{{ row.assessedUnitName || '--' }}</template>
          </el-table-column>
          <el-table-column label="操作" width="80" align="center" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="showSystemItemDetail(row)">详情</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty
          v-else
          description="该合同暂无已通过的项目登记系统明细，请在项目登记审批通过后查看"
          :image-size="80"
        />
      </el-card>

      <!-- 系统明细详情弹窗（展示完整字段 + 文件） -->
      <SystemItemDetailDialog v-model:visible="siDialogVisible" :item="siDialogItem" />

      <!-- ── 5. 合同文件 ────────────────────────────────────── -->
      <el-card shadow="never" style="margin-bottom: 16px">
        <template #header>
          <span style="font-weight: 600; font-size: 15px">合同文件</span>
        </template>
        <el-table v-if="contractFiles.length > 0" :data="contractFiles" border size="small" style="width: 100%">
          <el-table-column prop="fileName" label="文件名" min-width="200" show-overflow-tooltip />
          <el-table-column label="大小" width="100">
            <template #default="{ row }">{{ formatFileSize(row.fileSize) }}</template>
          </el-table-column>
          <el-table-column label="上传时间" width="170">
            <template #default="{ row }">{{ formatTime(row.uploadedAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="80" align="center">
            <template #default="{ row }">
              <el-button type="primary" link size="small" :icon="Download" @click="openDownload(row.id)">下载</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div v-else style="color: var(--el-text-color-placeholder); text-align: center; padding: 16px 0">暂无合同文件</div>
      </el-card>

      <!-- ── 5b. 合同文件说明 ──────────────────────────────── -->
      <el-card shadow="never" style="margin-bottom: 16px">
        <template #header>
          <span style="font-weight: 600; font-size: 15px">合同文件说明</span>
        </template>
        <template v-if="contractDescFile">
          <div style="display: flex; align-items: center; justify-content: space-between; border: 1px solid var(--el-border-color-lighter); border-radius: 6px; padding: 10px 14px; background: var(--el-fill-color-lighter)">
            <div>
              <el-icon style="vertical-align: -2px; margin-right: 4px"><Paperclip /></el-icon>
              <span>{{ contractDescFile.fileName }}</span>
              <span style="font-size: 12px; color: var(--el-text-color-secondary); margin-left: 12px">{{ formatFileSize(contractDescFile.fileSize) }}</span>
            </div>
            <el-button size="small" :icon="Download" @click="openDownload(contractDescFile.id)">下载</el-button>
          </div>
        </template>
        <div v-else style="color: var(--el-text-color-placeholder); text-align: center; padding: 16px 0">暂无文件说明</div>
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
            <el-form-item label="签订时间" :required="archiveForm.isComplete">
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
            <el-descriptions-item label="归档时间">{{ contract.archivedAt ? formatTime(contract.archivedAt) : '--' }}</el-descriptions-item>
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

      <!-- ── 8. 回款明细（只读，所有合同可见者都能看；编辑入口在合同财务详情页）──────── -->
      <el-card v-if="contract.reviewStatus === 'APPROVED'" shadow="never" style="margin-bottom: 16px">
        <template #header>
          <div style="display: flex; align-items: center; justify-content: space-between">
            <span style="font-weight: 600; font-size: 15px">回款明细</span>
            <el-tag :type="getStatusTagType(contract.paymentStatus)" size="small">
              {{ getStatusLabel(contract.paymentStatus) || contract.paymentStatus }}
            </el-tag>
          </div>
        </template>
        <el-row :gutter="16" style="margin-bottom: 12px">
          <el-col :span="8">
            <el-statistic title="合同金额" :value="paymentSummary.contractAmount" :precision="2" prefix="¥ " />
          </el-col>
          <el-col :span="8">
            <el-statistic title="累计回款" :value="paymentSummary.totalPaid" :precision="2" prefix="¥ " value-style="color: #67C23A" />
          </el-col>
          <el-col :span="8">
            <el-statistic title="剩余" :value="paymentSummary.remaining" :precision="2" prefix="¥ " value-style="color: #E6A23C" />
          </el-col>
        </el-row>
        <el-table v-if="paymentRecords.length > 0" :data="paymentRecords" border stripe size="small" style="width: 100%">
          <el-table-column label="金额" min-width="130" align="right">
            <template #default="{ row }">{{ formatAmount(row.amount) }}</template>
          </el-table-column>
          <el-table-column label="回款日期" min-width="120" align="center">
            <template #default="{ row }">{{ row.paidAt }}</template>
          </el-table-column>
          <el-table-column label="付款方" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">{{ row.payer || '--' }}</template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">{{ row.remark || '--' }}</template>
          </el-table-column>
          <el-table-column label="操作人" min-width="100">
            <template #default="{ row }">{{ row.creatorName || '--' }}</template>
          </el-table-column>
          <el-table-column label="操作时间" min-width="160">
            <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="暂无回款记录" :image-size="80" />
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

  </div>
</template>
