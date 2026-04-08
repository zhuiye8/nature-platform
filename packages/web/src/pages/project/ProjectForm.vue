<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElLoading } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { createProject, updateProject, getProjectDetail, getAvailableYears, getSystemItems } from '@/api/project'
import type { ProjectForm as ProjectFormData, ProjectSystemItem } from '@/api/project'
import { useAuthStore } from '@/stores/auth'
import { getContractPage } from '@/api/contract'
import { regionData } from '@/utils/region-data'
import type { ContractItem } from '@/api/contract'
import RejectReasonPanel from '@/components/RejectReasonPanel.vue'
import { getUploadUrl, deleteFile, uploadFileRaw } from '@/api/file'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const projectId = computed(() => {
  const id = route.params.id
  return id ? Number(id) : null
})
const isEdit = computed(() => !!projectId.value)
const pageTitle = computed(() => (isEdit.value ? '编辑项目登记' : '新建项目登记'))

const formRef = ref<FormInstance>()
const loading = ref(false)
const submitLoading = ref(false)

// ── 文件缓存：clientKey → { nodeKey → File | null(删除) } ──
interface PendingFileMap {
  filingCertificate?: File | null
  filingForm?: File | null
  classificationReport?: File | null
}
const pendingFiles = ref<Map<string, PendingFileMap>>(new Map())

let clientKeyCounter = 0
function generateClientKey() {
  return `ck_${Date.now()}_${++clientKeyCounter}`
}

// 选择文件（不上传，存到 pendingFiles）
function handleFileSelect(clientKey: string, nodeKey: string, file: File) {
  if (!pendingFiles.value.has(clientKey)) {
    pendingFiles.value.set(clientKey, {})
  }
  const map = pendingFiles.value.get(clientKey)!
  if (nodeKey === 'FILING_CERTIFICATE') map.filingCertificate = file
  else if (nodeKey === 'FILING_FORM') map.filingForm = file
  else if (nodeKey === 'CLASSIFICATION_REPORT') map.classificationReport = file

  // 更新 UI 显示待上传文件名
  const item = formData.value.systemItems.find((si: any) => si.clientKey === clientKey) as any
  if (item) {
    const displayKey = nodeKey === 'FILING_CERTIFICATE' ? 'pendingCertName'
      : nodeKey === 'FILING_FORM' ? 'pendingFormName' : 'pendingReportName'
    item[displayKey] = file.name
  }
}

// 标记删除已有文件
function markFileForDeletion(clientKey: string, nodeKey: string, item: any) {
  if (!pendingFiles.value.has(clientKey)) {
    pendingFiles.value.set(clientKey, {})
  }
  const map = pendingFiles.value.get(clientKey)!
  if (nodeKey === 'FILING_CERTIFICATE') { map.filingCertificate = null; item.filingCertificateFile = null; item.pendingCertName = null }
  else if (nodeKey === 'FILING_FORM') { map.filingForm = null; item.filingFormFile = null; item.pendingFormName = null }
  else if (nodeKey === 'CLASSIFICATION_REPORT') { map.classificationReport = null; item.classificationReportFile = null; item.pendingReportName = null }
}

// 批量上传 pendingFiles
async function uploadPendingFiles(itemMapping: { clientKey: string; id: number }[]) {
  const tasks: { itemId: number; nodeKey: string; file: File }[] = []
  const deletions: { itemId: number; nodeKey: string }[] = []

  for (const [clientKey, fileMap] of pendingFiles.value.entries()) {
    const mapping = itemMapping.find((m) => m.clientKey === clientKey)
    if (!mapping) continue

    for (const [key, file] of Object.entries(fileMap)) {
      const nodeKey = key === 'filingCertificate' ? 'FILING_CERTIFICATE'
        : key === 'filingForm' ? 'FILING_FORM' : 'CLASSIFICATION_REPORT'
      if (file === null) {
        deletions.push({ itemId: mapping.id, nodeKey })
      } else if (file instanceof File) {
        tasks.push({ itemId: mapping.id, nodeKey, file })
      }
    }
  }

  if (tasks.length === 0 && deletions.length === 0) return

  const loadingInstance = ElLoading.service({
    lock: true,
    text: `正在处理文件 (0/${tasks.length + deletions.length})...`,
    background: 'rgba(0, 0, 0, 0.7)',
  })

  let done = 0
  const total = tasks.length + deletions.length

  try {
    // Process deletions first
    for (const del of deletions) {
      await deleteFile(del.itemId, 'PROJECT_SYSTEM_ITEM', del.nodeKey)
      done++
      loadingInstance.setText(`正在处理文件 (${done}/${total})...`)
    }

    // Upload in batches of 5
    for (let i = 0; i < tasks.length; i += 5) {
      const batch = tasks.slice(i, i + 5)
      await Promise.all(
        batch.map((t) => uploadFileRaw('PROJECT_SYSTEM_ITEM', t.itemId, t.nodeKey, t.file)),
      )
      done += batch.length
      loadingInstance.setText(`正在处理文件 (${done}/${total})...`)
    }
  } finally {
    loadingInstance.close()
    pendingFiles.value.clear()
  }
}

async function reloadSystemItemFiles() {
  if (!projectId.value) return
  try {
    const items = (await getSystemItems(projectId.value)) as any[]
    formData.value.systemItems = formData.value.systemItems.map((si: any) => {
      const enriched = items.find((item: any) => item.id === si.id)
      if (enriched) {
        return {
          ...si,
          filingCertificateFile: enriched.filingCertificateFile,
          filingFormFile: enriched.filingFormFile,
          classificationReportFile: enriched.classificationReportFile,
          pendingCertName: null,
          pendingFormName: null,
          pendingReportName: null,
        }
      }
      return si
    })
  } catch { /* ignore */ }
}

const formData = ref<ProjectFormData>({
  contractId: undefined as any,
  contractYear: undefined as any,
  applicationName: '',
  remark: '',
  systemItems: [],
})

const rules: FormRules = {
  contractId: [{ required: true, message: '请选择合同', trigger: 'change' }],
  contractYear: [{ required: true, message: '请选择年度', trigger: 'change' }],
  applicationName: [{ required: true, message: '请输入申请单名称', trigger: 'blur' }],
}

// Contract selector
const contractOptions = ref<ContractItem[]>([])
const contractLoading = ref(false)
const selectedContractName = ref('')

async function searchContracts(query: string) {
  contractLoading.value = true
  try {
    const data = (await getContractPage({
      page: 1,
      pageSize: 20,
      keyword: query || undefined,
      reviewStatus: 'APPROVED',
      archiveStatus: 'ARCHIVED',
      onlyMine: 'true',
    } as any)) as unknown as import('@nature/shared').PageResult<ContractItem>
    contractOptions.value = data.list
  } finally {
    contractLoading.value = false
  }
}

// Year selector
const yearOptions = ref<number[]>([])
const yearLoading = ref(false)

async function fetchAvailableYears(contractId: number) {
  yearLoading.value = true
  try {
    yearOptions.value = (await getAvailableYears(contractId)) as unknown as number[]
  } finally {
    yearLoading.value = false
  }
}

// Common filing agencies (公安机关网安部门)
// 备案机关：根据选择的行政区划自动生成名称
const filingRegionMap = ref<Record<string, string[]>>({})

function getFilingRegion(clientKey: string): string[] {
  return filingRegionMap.value[clientKey] || []
}

function setFilingRegion(clientKey: string, val: string[]) {
  filingRegionMap.value[clientKey] = val || []
}

const directMunicipalities = ['北京市', '上海市', '天津市', '重庆市']

function generateFilingAgency(regionPath: string[]): string {
  if (!regionPath || regionPath.length === 0) return ''
  const province = regionPath[0]
  const city = regionPath[1]
  const district = regionPath[2]

  if (directMunicipalities.includes(province)) {
    // 直辖市
    if (district) return `${province}公安局${district}分局`
    return `${province}公安局网安总队`
  }
  if (district) {
    // 区县级
    if (district.endsWith('县') || district.endsWith('市')) {
      return `${district}公安局`
    }
    return `${city}公安局${district}分局`
  }
  if (city) return `${city}公安局网安支队`
  // 省级
  if (province.includes('自治区')) return `${province}公安厅网安总队`
  return `${province.replace('省', '')}省公安厅网安总队`
}

function onFilingRegionChange(clientKey: string, val: string[], item: any) {
  setFilingRegion(clientKey, val)
  item.filingAgency = generateFilingAgency(val)
}

// Security level options
const securityLevelOptions = [
  { label: '一级', value: '一级' },
  { label: '二级', value: '二级' },
  { label: '三级', value: '三级' },
  { label: '四级', value: '四级' },
  { label: '五级', value: '五级' },
]

// No system count limit — users can freely add systems

// Watch contract selection to load years and system items
watch(
  () => formData.value.contractId,
  async (newVal) => {
    if (!newVal || isEdit.value) return
    formData.value.contractYear = undefined as any
    yearOptions.value = []

    const contract = contractOptions.value.find((c) => c.id === newVal)
    if (contract) {
      selectedContractName.value = contract.contractName || ''
    }

    await fetchAvailableYears(newVal)
  },
)

// Auto-generate applicationName when contract selected
watch(
  () => formData.value.contractId,
  (contractId) => {
    if (contractId && !isEdit.value) {
      const contract = contractOptions.value.find((c) => c.id === contractId)
      const customerName = (contract as any)?.customerName || ''
      const contractName = contract?.contractName || ''
      const userName = authStore.user?.displayName || ''
      const today = new Date().toISOString().slice(0, 10)
      if (customerName && contractName) {
        formData.value.applicationName = `${userName}-系统登记申请-${customerName}-${contractName}-${today}`
      } else if (contractName) {
        formData.value.applicationName = `${userName}-系统登记申请-${contractName}-${today}`
      }
    }
  },
)

async function fetchDetail() {
  if (!projectId.value) return
  loading.value = true
  try {
    const data = (await getProjectDetail(projectId.value)) as unknown as import('@/api/project').ProjectDetail
    // Load system items with file attachments
    let enrichedItems = data.systemItems ?? []
    try {
      enrichedItems = (await getSystemItems(projectId.value)) as any[]
    } catch { /* fallback to basic items */ }
    formData.value = {
      contractId: data.contractId,
      contractYear: data.contractYear,
      applicationName: data.applicationName,
      remark: data.remark ?? '',
      systemItems: enrichedItems.map((si: any) => ({
        ...si,
        clientKey: si.clientKey || `existing_${si.id}`,
        assessedUnitContact: si.assessedUnitContact || '',
        assessedUnitMobile: si.assessedUnitMobile || '',
        pendingCertName: null,
        pendingFormName: null,
        pendingReportName: null,
      })),
    }
    selectedContractName.value = data.contractName ?? ''
    // Ensure contract appears in selector
    if (data.contractName) {
      contractOptions.value = [
        { id: data.contractId, contractName: data.contractName } as unknown as ContractItem,
      ]
    }
    // Load year options
    await fetchAvailableYears(data.contractId)
    // Ensure current year is in options
    if (!yearOptions.value.includes(data.contractYear)) {
      yearOptions.value.push(data.contractYear)
      yearOptions.value.sort()
    }
  } finally {
    loading.value = false
  }
}

function addSystemItem() {
  formData.value.systemItems.push({
    clientKey: generateClientKey(),
    systemName: '',
    filingAgency: '',
    securityLevel: '',
    isReassessment: false,
    requiredEntryDate: '',
    requiredReportDeliveryDate: '',
    assessedUnitName: '',
    assessedUnitContact: '',
    assessedUnitMobile: '',
    assessedUnitAddress: '',
    hasFilingCertificate: true,
    filingCertificateNo: '',
    filingCertificateIssuedAt: '',
    hasFilingForm: false,
    hasClassificationReport: false,
    sortOrder: formData.value.systemItems.length + 1,
    pendingCertName: null,
    pendingFormName: null,
    pendingReportName: null,
  } as any)
}

function removeSystemItem(index: number) {
  formData.value.systemItems.splice(index, 1)
}

function handleBack() {
  router.push('/project')
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  // Edit mode: validate system items
  if (isEdit.value) {
    if (formData.value.systemItems.length === 0) {
      ElMessage.warning('请至少添加一条系统明细')
      return
    }
  }

  if (formData.value.systemItems.length > 0) {
    for (let i = 0; i < formData.value.systemItems.length; i++) {
      const si = formData.value.systemItems[i]
      const missing: string[] = []
      if (!si.systemName) missing.push('系统名称')
      if (!si.filingAgency) missing.push('备案机关')
      if (!si.securityLevel) missing.push('安全等级')
      if (!si.requiredEntryDate) missing.push('要求录入日期')
      if (!si.requiredReportDeliveryDate) missing.push('要求出报告日期')
      if (!si.assessedUnitName) missing.push('被测单位名称')
      if (!si.assessedUnitContact) missing.push('联系人')
      if (!si.assessedUnitMobile) missing.push('联系电话')
      if (!si.assessedUnitAddress) missing.push('地址')
      if (!si.filingCertificateNo) missing.push('备案证明编号')
      if (!si.filingCertificateIssuedAt) missing.push('备案证明出具时间')
      if (!(si as any).filingCertificateFile && !(si as any).pendingCertName) missing.push('备案证明文件')
      if (missing.length > 0) {
        ElMessage.warning(`系统 ${i + 1}「${si.systemName || '未命名'}」缺少：${missing.join('、')}`)
        return
      }
    }
  }

  submitLoading.value = true
  try {
    // For create: only basic info (no systemItems)
    // For edit: basic info + systemItems with clientKey
    const submitData: any = {
      contractId: formData.value.contractId,
      contractYear: formData.value.contractYear,
      applicationName: formData.value.applicationName,
      remark: formData.value.remark,
    }
    if (isEdit.value) {
      submitData.systemItems = formData.value.systemItems.map((item: any) => ({
        id: item.id || undefined,
        clientKey: item.clientKey,
        systemName: item.systemName,
        filingAgency: item.filingAgency,
        securityLevel: item.securityLevel,
        isReassessment: item.isReassessment,
        requiredEntryDate: item.requiredEntryDate,
        requiredReportDeliveryDate: item.requiredReportDeliveryDate,
        assessedUnitName: item.assessedUnitName,
        assessedUnitIndustry: item.assessedUnitIndustry,
        assessedUnitContact: item.assessedUnitContact,
        assessedUnitMobile: item.assessedUnitMobile,
        assessedUnitAddress: item.assessedUnitAddress,
        hasFilingCertificate: item.hasFilingCertificate,
        filingCertificateNo: item.filingCertificateNo,
        filingCertificateIssuedAt: item.filingCertificateIssuedAt,
        hasFilingForm: item.hasFilingForm,
        hasClassificationReport: item.hasClassificationReport,
        sortOrder: item.sortOrder,
      }))
    }

    let itemMapping: { clientKey: string; id: number }[] = []

    if (isEdit.value && projectId.value) {
      const result = (await updateProject(projectId.value, submitData)) as any
      itemMapping = result?.itemMapping || []
    } else {
      await createProject(submitData)
      ElMessage.success('创建成功')
      router.push('/project')
      return
    }

    // Step 2: Upload pending files using clientKey → id mapping
    if (pendingFiles.value.size > 0 && itemMapping.length > 0) {
      await uploadPendingFiles(itemMapping)
    }

    ElMessage.success('保存成功')
    router.push('/project')
  } finally {
    submitLoading.value = false
  }
}

onMounted(async () => {
  searchContracts('')
  if (isEdit.value) {
    await fetchDetail()
    // Handle scrollTo=systemItems from project list
    if (route.query.scrollTo === 'systemItems') {
      await nextTick()
      const el = document.getElementById('system-items-section')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  } else {
    // Pre-fill applicationName in create mode
    const today = new Date().toISOString().slice(0, 10)
    formData.value.applicationName = `${authStore.user?.displayName || ''}-系统登记申请-${today}`
  }
})
</script>

<template>
  <div v-loading="loading">
    <div class="n-page-header">
      <h2 class="n-page-title">
        <el-button :icon="ArrowLeft" text @click="handleBack" />
        {{ pageTitle }}
      </h2>
    </div>

    <RejectReasonPanel v-if="isEdit" biz-type="PROJECT_REGISTER" :biz-id="projectId!" />

    <el-card shadow="never">
      <el-form
        ref="formRef"
        :model="formData"
        :rules="rules"
        label-width="100px"
        style="max-width: 960px; margin: 0 auto"
      >
        <!-- 基本信息 -->
        <div class="n-form-section">
        <h4 class="n-section-title">基本信息</h4>
        <el-form-item label="合同" prop="contractId">
          <el-select
            v-model="formData.contractId"
            filterable
            remote
            reserve-keyword
            placeholder="请搜索选择合同（仅已通过的合同）"
            :remote-method="searchContracts"
            :loading="contractLoading"
            :disabled="isEdit"
            style="width: 100%"
          >
            <el-option
              v-for="item in contractOptions"
              :key="item.id"
              :label="item.contractName || `合同#${item.id}`"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="合同年度" prop="contractYear">
          <el-select
            v-model="formData.contractYear"
            placeholder="请选择年度"
            :loading="yearLoading"
            :disabled="!formData.contractId"
            style="width: 100%"
          >
            <el-option
              v-for="year in yearOptions"
              :key="year"
              :label="`${year}年`"
              :value="year"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="申请单名称" prop="applicationName">
          <el-input v-model="formData.applicationName" placeholder="选择合同和年度后自动生成" disabled />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input
            v-model="formData.remark"
            type="textarea"
            :rows="3"
            placeholder="请输入备注"
          />
        </el-form-item>

        </div>

        <!-- 系统明细（仅编辑模式） -->
        <div v-if="isEdit" id="system-items-section" class="n-form-section">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px">
          <h4 class="n-section-title" style="margin: 0">系统明细</h4>
          <el-button type="primary" size="small" @click="addSystemItem">+ 新增系统</el-button>
        </div>
        <el-empty
          v-if="formData.systemItems.length === 0"
          description="暂无系统明细，请点击新增或选择合同继承"
          :image-size="60"
        />
        <div v-for="(item, index) in formData.systemItems" :key="index" style="margin-bottom: 24px">
          <el-card shadow="hover" style="border-left: 3px solid #409eff">
            <template #header>
              <div style="display: flex; align-items: center; justify-content: space-between">
                <span style="font-weight: 600">{{ item.systemName || `系统 ${index + 1}` }}</span>
                <el-popconfirm title="确定要删除此系统吗？" @confirm="removeSystemItem(index)">
                  <template #reference>
                    <el-button type="danger" link size="small">删除</el-button>
                  </template>
                </el-popconfirm>
              </div>
            </template>

            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="系统名称" required>
                  <el-input v-model="item.systemName" placeholder="请输入系统名称" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="备案区域" required>
                  <el-cascader
                    :model-value="getFilingRegion(item.clientKey)"
                    :options="regionData"
                    :props="{ checkStrictly: true }"
                    filterable
                    clearable
                    placeholder="请选择省市区"
                    style="width: 100%"
                    @change="(val: string[]) => onFilingRegionChange(item.clientKey, val, item)"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="备案机关" required>
                  <el-input v-model="item.filingAgency" placeholder="选择区域后自动生成，可手动修改" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="安全等级" required>
                  <el-select v-model="item.securityLevel" placeholder="请选择" style="width: 100%">
                    <el-option
                      v-for="opt in securityLevelOptions"
                      :key="opt.value"
                      :label="opt.label"
                      :value="opt.value"
                    />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="是否复评">
                  <el-radio-group v-model="item.isReassessment">
                    <el-radio :value="true">是</el-radio>
                    <el-radio :value="false">否</el-radio>
                  </el-radio-group>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="要求录入日期" required>
                  <el-date-picker
                    v-model="item.requiredEntryDate"
                    type="date"
                    placeholder="请选择日期"
                    value-format="YYYY-MM-DD"
                    style="width: 100%"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="要求出报告日期" required>
                  <el-date-picker
                    v-model="item.requiredReportDeliveryDate"
                    type="date"
                    placeholder="请选择日期"
                    value-format="YYYY-MM-DD"
                    style="width: 100%"
                  />
                </el-form-item>
              </el-col>
            </el-row>

            <el-divider content-position="left">被测单位信息</el-divider>
            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="被测单位名称" required>
                  <el-input v-model="item.assessedUnitName" placeholder="请输入被测单位名称" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="联系人" required>
                  <el-input v-model="item.assessedUnitContact" placeholder="请输入联系人" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="联系电话" required>
                  <el-input v-model="item.assessedUnitMobile" placeholder="请输入联系电话" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="地址" required>
                  <el-input v-model="item.assessedUnitAddress" placeholder="请输入地址" />
                </el-form-item>
              </el-col>
            </el-row>

            <el-divider content-position="left">备案信息</el-divider>
            <el-row :gutter="16">
              <!-- 备案证明（必有） -->
              <el-col :span="12">
                <el-form-item label="备案证明">
                  <div style="display: flex; align-items: center; gap: 8px">
                    <el-tag v-if="(item as any).filingCertificateFile && !(item as any).pendingCertName" type="success" size="small" closable @close="markFileForDeletion((item as any).clientKey, 'FILING_CERTIFICATE', item)">
                      {{ (item as any).filingCertificateFile.fileName }}
                    </el-tag>
                    <el-tag v-else-if="(item as any).pendingCertName" type="warning" size="small">
                      待上传: {{ (item as any).pendingCertName }}
                    </el-tag>
                    <el-upload
                      :auto-upload="false"
                      :show-file-list="false"
                      accept=".pdf,.jpg,.jpeg,.png"
                      :on-change="(f: any) => handleFileSelect((item as any).clientKey, 'FILING_CERTIFICATE', f.raw)"
                    >
                      <el-button size="small" type="primary">{{ (item as any).filingCertificateFile || (item as any).pendingCertName ? '替换' : '选择文件' }}</el-button>
                    </el-upload>
                  </div>
                </el-form-item>
              </el-col>
              <el-col :span="12" />
              <el-col :span="12">
                <el-form-item label="证明编号">
                  <el-input v-model="item.filingCertificateNo" placeholder="请输入备案证明编号" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="出具时间">
                  <el-date-picker v-model="item.filingCertificateIssuedAt" type="date" placeholder="请选择日期" value-format="YYYY-MM-DD" style="width: 100%" />
                </el-form-item>
              </el-col>

              <!-- 备案表 -->
              <el-col :span="12">
                <el-form-item label="备案表">
                  <el-radio-group v-model="item.hasFilingForm">
                    <el-radio :value="false">否</el-radio>
                    <el-radio :value="true">是</el-radio>
                  </el-radio-group>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item v-if="item.hasFilingForm" label="上传备案表">
                  <div style="display: flex; align-items: center; gap: 8px">
                    <el-tag v-if="(item as any).filingFormFile && !(item as any).pendingFormName" type="success" size="small" closable @close="markFileForDeletion((item as any).clientKey, 'FILING_FORM', item)">
                      {{ (item as any).filingFormFile.fileName }}
                    </el-tag>
                    <el-tag v-else-if="(item as any).pendingFormName" type="warning" size="small">
                      待上传: {{ (item as any).pendingFormName }}
                    </el-tag>
                    <el-upload
                      :auto-upload="false"
                      :show-file-list="false"
                      accept=".pdf,.jpg,.jpeg,.png"
                      :on-change="(f: any) => handleFileSelect((item as any).clientKey, 'FILING_FORM', f.raw)"
                    >
                      <el-button size="small" type="primary">{{ (item as any).filingFormFile || (item as any).pendingFormName ? '替换' : '选择文件' }}</el-button>
                    </el-upload>
                  </div>
                </el-form-item>
              </el-col>

              <!-- 定级报告 -->
              <el-col :span="12">
                <el-form-item label="定级报告">
                  <el-radio-group v-model="item.hasClassificationReport">
                    <el-radio :value="false">否</el-radio>
                    <el-radio :value="true">是</el-radio>
                  </el-radio-group>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item v-if="item.hasClassificationReport" label="上传定级报告">
                  <div style="display: flex; align-items: center; gap: 8px">
                    <el-tag v-if="(item as any).classificationReportFile && !(item as any).pendingReportName" type="success" size="small" closable @close="markFileForDeletion((item as any).clientKey, 'CLASSIFICATION_REPORT', item)">
                      {{ (item as any).classificationReportFile.fileName }}
                    </el-tag>
                    <el-tag v-else-if="(item as any).pendingReportName" type="warning" size="small">
                      待上传: {{ (item as any).pendingReportName }}
                    </el-tag>
                    <el-upload
                      :auto-upload="false"
                      :show-file-list="false"
                      accept=".pdf,.jpg,.jpeg,.png"
                      :on-change="(f: any) => handleFileSelect((item as any).clientKey, 'CLASSIFICATION_REPORT', f.raw)"
                    >
                      <el-button size="small" type="primary">{{ (item as any).classificationReportFile || (item as any).pendingReportName ? '替换' : '选择文件' }}</el-button>
                    </el-upload>
                  </div>
                </el-form-item>
              </el-col>
            </el-row>
          </el-card>
        </div>

        </div>

        <!-- 操作栏 -->
        <div class="n-form-actions">
          <el-button @click="handleBack">取消</el-button>
          <el-button type="primary" :loading="submitLoading" @click="handleSubmit">
            {{ isEdit ? '保存' : '创建' }}
          </el-button>
        </div>
      </el-form>
    </el-card>
  </div>
</template>
