<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { CascaderValue, FormInstance, FormRules } from 'element-plus'
import { ArrowLeft, Plus, Delete, Upload, Download, Paperclip } from '@element-plus/icons-vue'
import { regionData } from '@/utils/region-data'
import { createContract, updateContract, getContractDetail } from '@/api/contract'
import type { ContractForm as ContractFormData } from '@/api/contract'
import { getCustomerPage, getCustomerContacts } from '@/api/customer'
import type { CustomerItem, CustomerContact } from '@/api/customer'
import { getPartnerList, createPartner } from '@/api/partner'
import type { PartnerItem } from '@/api/partner'
import RejectReasonPanel from '@/components/RejectReasonPanel.vue'
import { getUsersByRole } from '@/api/workflow'
import { useAuthStore } from '@/stores/auth'
import { formatTime } from '@/utils/format'
import { getFileList, getUploadUrl, getFileDownloadPath, getFilePreviewPath, deleteFile, type FileItem } from '@/api/file'

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()

const contractId = computed(() => {
  const id = route.params.id
  return id ? Number(id) : null
})
const isEdit = computed(() => !!contractId.value)
const pageTitle = computed(() => (isEdit.value ? '编辑合同' : '新建合同'))

const formRef = ref<FormInstance>()
const loading = ref(false)
const submitLoading = ref(false)

// groupId from route query
const groupId = computed(() => {
  const gid = route.query.groupId
  return gid ? Number(gid) : (formData.value.groupId || undefined)
})

const contractCategoryOptions = ['委托书', '收款合同', '付款合同']

const formData = ref<ContractFormData>({
  groupId: undefined,
  contractCategory: '',
  customerId: undefined,
  contactName: '',
  contactPhone: '',
  paymentCompany: '',
  paymentAmount: undefined,
  paymentMethod: '',
  paymentInfo: '',
  invoiceType: '',
  taxRate: '',
  partnerId: undefined,
  partnerName: '',
  salesPersonId: undefined,
  performanceCity: '',
  dealStatus: '',
  serviceContent: '',
  contractType: '',
  serviceYears: [],
  remark: '',
  systemItems: [],
})

// 业绩城市级联
const cityCascaderValue = ref<string[]>([])
function normalizeCascaderPath(val: CascaderValue | null | undefined): string[] {
  return Array.isArray(val) ? val.map((item) => String(item)) : []
}

function onCityChange(val: CascaderValue | null | undefined) {
  const path = normalizeCascaderPath(val)
  formData.value.performanceCity = path.join('/')
}
function parseCityToArray(str: string): string[] {
  return str ? str.split('/') : []
}

const rules: FormRules = {
  contractCategory: [{ required: true, message: '请选择合同分类', trigger: 'change' }],
  customerId: [{ required: true, message: '请选择客户', trigger: 'change' }],
  contactName: [{ required: true, message: '请选择联系人', trigger: 'change' }],
  salesPersonId: [{ required: true, message: '请选择签单销售', trigger: 'change' }],
  serviceContent: [{ required: true, message: '请选择服务内容', trigger: 'change' }],
  contractType: [{ required: true, message: '请选择合同类型', trigger: 'change' }],
  dealStatus: [{ required: true, message: '请选择成交情况', trigger: 'change' }],
  performanceCity: [{ required: true, message: '请选择业绩归属城市', trigger: 'change' }],
  paymentAmount: [{ required: true, message: '请输入付款金额', trigger: 'blur' }],
  paymentMethod: [{ required: true, message: '请选择付款方式', trigger: 'change' }],
  paymentCompany: [{ required: true, message: '请选择付款单位', trigger: 'change' }],
  invoiceType: [{ required: true, message: '请选择发票类型', trigger: 'change' }],
  taxRate: [{ required: true, message: '请选择税率', trigger: 'change' }],
  paymentInfo: [{ required: true, message: '请输入付款信息', trigger: 'blur' }],
  partnerId: [{ required: true, message: '请选择合作方', trigger: 'change' }],
  serviceYears: [{ required: true, type: 'array', min: 1, message: '请选择服务年度', trigger: 'change' }],
}

// ── 客户选择器 ──
const customerOptions = ref<CustomerItem[]>([])
const customerLoading = ref(false)
const selectedCustomer = ref<CustomerItem | null>(null)

async function searchCustomers(query: string) {
  customerLoading.value = true
  try {
    const data = (await getCustomerPage({
      page: 1,
      pageSize: 20,
      keyword: query || undefined,
    })) as unknown as import('@nature/shared').PageResult<CustomerItem>
    customerOptions.value = data.list
  } finally {
    customerLoading.value = false
  }
}

// ── 客户联系人 ──
const contactOptions = ref<CustomerContact[]>([])
const selectedContactId = ref<number | null>(null)

async function loadCustomerContacts(customerId: number) {
  try {
    contactOptions.value = (await getCustomerContacts(customerId)) as any
    // Default to first contact
    if (contactOptions.value.length > 0) {
      const first = contactOptions.value[0]
      selectedContactId.value = first.id
      formData.value.contactName = first.contactName
      formData.value.contactPhone = first.contactPhone || ''
    } else {
      selectedContactId.value = null
      formData.value.contactName = ''
      formData.value.contactPhone = ''
    }
  } catch {
    contactOptions.value = []
  }
}

function handleContactChange(contactId: number) {
  const contact = contactOptions.value.find((c) => c.id === contactId)
  if (contact) {
    formData.value.contactName = contact.contactName
    formData.value.contactPhone = contact.contactPhone || ''
  }
}

function handleCustomerChange(customerId: number) {
  const cust = customerOptions.value.find((c) => c.id === customerId)
  selectedCustomer.value = cust || null
  // Load contacts for the selected customer
  if (cust) {
    loadCustomerContacts(cust.id)
  } else {
    contactOptions.value = []
    selectedContactId.value = null
    formData.value.contactName = ''
    formData.value.contactPhone = ''
  }
}

// ── 合作方列表 ──
const partnerOptions = ref<PartnerItem[]>([])

async function loadPartners() {
  try {
    partnerOptions.value = (await getPartnerList()) as any
  } catch { partnerOptions.value = [] }
}

// Quick create partner
const quickPartnerDialogVisible = ref(false)
const quickPartnerName = ref('')
const quickPartnerLoading = ref(false)

async function handleQuickCreatePartner() {
  if (!quickPartnerName.value.trim()) {
    ElMessage.warning('请输入合作方名称')
    return
  }
  quickPartnerLoading.value = true
  try {
    const newPartner = (await createPartner({ name: quickPartnerName.value.trim() })) as any
    ElMessage.success('合作方创建成功')
    quickPartnerDialogVisible.value = false
    quickPartnerName.value = ''
    await loadPartners()
    formData.value.partnerId = newPartner.id
  } catch {
    // handled by interceptor
  } finally {
    quickPartnerLoading.value = false
  }
}

// ── 签单销售列表 ──
const salesOptions = ref<{ id: number; displayName: string }[]>([])

async function loadSalesUsers() {
  try {
    salesOptions.value = (await getUsersByRole('sales')) as any
    // Default to current user if creating and not yet selected
    if (!isEdit.value && !formData.value.salesPersonId && authStore.user?.id) {
      const me = salesOptions.value.find((u: any) => u.id === authStore.user?.id)
      if (me) {
        formData.value.salesPersonId = me.id
      }
    }
  } catch { salesOptions.value = [] }
}

// ── 服务年份 ──
const currentYear = new Date().getFullYear()
const serviceYearOptions = Array.from({ length: 12 }, (_, i) => currentYear - 5 + i)

// ── 系统明细 ──
function addSystemItem() {
  formData.value.systemItems.push({
    systemName: '',
    systemLevel: 3,
    sortOrder: formData.value.systemItems.length + 1,
  })
}

function removeSystemItem(index: number) {
  formData.value.systemItems.splice(index, 1)
}

const systemLevelOptions = [
  { label: '一级', value: 1 },
  { label: '二级', value: 2 },
  { label: '三级', value: 3 },
  { label: '四级', value: 4 },
  { label: '五级', value: 5 },
]

// ── 预设选项 ──
const paymentMethodOptions = ['全款', '进度款']
const serviceContentOptions = ['等级保护测评', '等保（综合）', '安全咨询', '渗透测试', '风险评估', '其他']
const contractTypeOptions = ['自主', '直接合作', '间接合作']
const dealStatusOptions = ['新客户挖掘', '老客户续签', '老客户转介绍', '招投标', '其他']
const invoiceTypeOptions = ['专票', '普票']
const taxRateOptions = ['0', '1', '3', '6', '9', '13']

// ── 加载详情 ──
async function fetchDetail() {
  if (!contractId.value) return
  loading.value = true
  try {
    const data = (await getContractDetail(contractId.value)) as any
    formData.value = {
      groupId: data.groupId,
      contractCategory: data.contractCategory ?? '',
      customerId: data.customerId,
      contactName: data.contactName ?? '',
      contactPhone: data.contactPhone ?? '',
      paymentCompany: data.paymentCompany ?? '',
      paymentAmount: data.paymentAmount ?? undefined,
      paymentMethod: data.paymentMethod ?? '',
      paymentInfo: data.paymentInfo ?? '',
      invoiceType: data.invoiceType ?? '',
      taxRate: data.taxRate ?? '',
      partnerId: data.partnerId ?? undefined,
      salesPersonId: data.salesPersonId ?? undefined,
      performanceCity: data.performanceCity ?? '',
      dealStatus: data.dealStatus ?? '',
      serviceContent: data.serviceContent ?? '',
      contractType: data.contractType ?? '',
      serviceYears: data.serviceYears ?? [],
      remark: data.remark ?? '',
      systemItems: data.systemItems ?? [],
    }
    cityCascaderValue.value = parseCityToArray(data.performanceCity ?? '')
    // Pre-fill customer option for display
    if (data.customerName) {
      customerOptions.value = [{ id: data.customerId, fullName: data.customerName } as CustomerItem]
      selectedCustomer.value = { id: data.customerId, fullName: data.customerName } as any
      // Load contacts and try to match the saved contact name
      try {
        contactOptions.value = (await getCustomerContacts(data.customerId)) as any
        const matched = contactOptions.value.find(c => c.contactName === data.contactName)
        selectedContactId.value = matched ? matched.id : (contactOptions.value[0]?.id ?? null)
      } catch {
        contactOptions.value = []
      }
    }
    // Pre-fill partner option: "无" is stored as partnerId=null, partnerName="无"
    if (data.partnerName === '无' || (!data.partnerId && !data.partnerName)) {
      formData.value.partnerId = 0
    } else if (data.partnerId && data.partnerName) {
      if (!partnerOptions.value.find(p => p.id === data.partnerId)) {
        partnerOptions.value.push({ id: data.partnerId, name: data.partnerName } as PartnerItem)
      }
    }
  } finally {
    loading.value = false
    loadContractFiles()
    loadContractDescFile()
  }
}

function handleBack() {
  router.push('/contract')
}

// ── 合同文件管理（编辑模式，多文件） ──
const contractFiles = ref<FileItem[]>([])
const uploadHeaders = computed(() => ({ Authorization: `Bearer ${localStorage.getItem('token')}` }))

async function loadContractFiles() {
  if (!isEdit.value || !contractId.value) return
  try {
    contractFiles.value = (await getFileList('CONTRACT', contractId.value)) as any as FileItem[]
  } catch {
    contractFiles.value = []
  }
}

async function handleFileUploadSuccess() {
  ElMessage.success('上传成功')
  await loadContractFiles()
}

async function handleSingleFileDelete(fileId: number) {
  try { await deleteFile(fileId) } catch { /* ignore */ }
  ElMessage.success('已删除')
  await loadContractFiles()
}

// ── 合同文件说明（单文件） ──
const contractDescFile = ref<FileItem | null>(null)

async function loadContractDescFile() {
  if (!isEdit.value || !contractId.value) return
  try {
    const files = (await getFileList('CONTRACT_DESC', contractId.value)) as any as FileItem[]
    contractDescFile.value = files && files.length > 0 ? files[0] : null
  } catch {
    contractDescFile.value = null
  }
}

async function handleDescUploadSuccess() {
  ElMessage.success('上传成功')
  await loadContractDescFile()
}

async function handleDescBeforeUpload() {
  if (contractDescFile.value) {
    try { await deleteFile(contractDescFile.value.id) } catch { /* ignore */ }
  }
  return true
}

async function handleDescFileDelete() {
  if (!contractDescFile.value) return
  try { await deleteFile(contractDescFile.value.id) } catch { /* ignore */ }
  ElMessage.success('已删除')
  contractDescFile.value = null
}

function openFileDownload(fileId: number) {
  window.open(getFileDownloadPath(fileId), '_blank')
}

function formatFileSize(size: number) {
  if (!size) return '-'
  if (size < 1024) return size + ' B'
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB'
  return (size / 1024 / 1024).toFixed(1) + ' MB'
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) {
    await nextTick()
    const firstError = document.querySelector('.el-form-item.is-error')
    if (firstError) {
      firstError.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    ElMessage.warning('请完善必填字段')
    return
  }

  if (formData.value.systemItems.length === 0) {
    ElMessage.warning('请至少添加一条系统明细')
    return
  }

  submitLoading.value = true
  try {
    // Clean data: handle partner "无" option and system items
    const cleanData = {
      ...formData.value,
      groupId: groupId.value,
      partnerId: formData.value.partnerId === 0 ? undefined : formData.value.partnerId,
      partnerName: formData.value.partnerId === 0 ? '无' : formData.value.partnerName,
      systemItems: formData.value.systemItems.map(item => ({
        systemName: item.systemName,
        systemLevel: item.systemLevel,
        sortOrder: item.sortOrder,
      })),
    }
    if (isEdit.value && contractId.value) {
      delete cleanData.groupId
      await updateContract(contractId.value, cleanData)
      ElMessage.success('更新成功')
    } else {
      await createContract(cleanData)
      ElMessage.success('创建成功，请在列表中上传合同文件')
    }
    router.push('/contract')
  } finally {
    submitLoading.value = false
  }
}

onMounted(() => {
  searchCustomers('')
  loadPartners()
  loadSalesUsers()
  if (isEdit.value) {
    fetchDetail()
    loadContractFiles()
    loadContractDescFile()
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

    <RejectReasonPanel v-if="isEdit" biz-type="CONTRACT" :biz-id="contractId!" />

    <el-card shadow="never">
      <el-form
        ref="formRef"
        :model="formData"
        :rules="rules"
        label-width="110px"
        style="max-width: 960px; margin: 0 auto"
      >
        <!-- ── 基本信息 ── -->
        <div class="n-form-section">
          <h4 class="n-section-title">基本信息</h4>
          <div class="n-form-row">
            <el-form-item label="合同分类" prop="contractCategory">
              <el-radio-group v-model="formData.contractCategory">
                <el-radio v-for="c in contractCategoryOptions" :key="c" :value="c">{{ c }}</el-radio>
              </el-radio-group>
            </el-form-item>
          </div>
          <div class="n-form-row">
            <el-form-item label="客户" prop="customerId">
              <el-select
                v-model="formData.customerId"
                filterable
                remote
                reserve-keyword
                placeholder="请搜索选择客户"
                :remote-method="searchCustomers"
                :loading="customerLoading"
                style="width: 100%"
                @change="handleCustomerChange"
              >
                <el-option
                  v-for="item in customerOptions"
                  :key="item.id"
                  :label="item.fullName"
                  :value="item.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="合作方" prop="partnerId">
              <div style="display: flex; gap: 8px; width: 100%">
                <el-select v-model="formData.partnerId" filterable placeholder="请选择合作方" style="flex: 1">
                  <el-option label="无" :value="0" />
                  <el-option v-for="p in partnerOptions" :key="p.id" :label="p.name" :value="p.id" />
                </el-select>
                <el-button :icon="Plus" @click="quickPartnerDialogVisible = true" title="快速新增合作方" />
              </div>
            </el-form-item>
          </div>

          <!-- 联系人（从客户的联系人列表中选择） -->
          <div class="n-form-row">
            <el-form-item label="联系人" prop="contactName">
              <el-select
                v-model="selectedContactId"
                placeholder="请先选择客户"
                :disabled="contactOptions.length === 0"
                style="width: 100%"
                @change="handleContactChange"
              >
                <el-option
                  v-for="c in contactOptions"
                  :key="c.id"
                  :label="`${c.contactName}${c.position ? ' (' + c.position + ')' : ''}`"
                  :value="c.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="联系电话">
              <el-input v-model="formData.contactPhone" disabled placeholder="选择联系人后自动填充" />
            </el-form-item>
          </div>

          <div class="n-form-row">
            <el-form-item label="统一信用代码">
              <el-input :model-value="selectedCustomer?.uscc || ''" disabled placeholder="选择客户后自动填充" />
            </el-form-item>
            <el-form-item label="签单销售" prop="salesPersonId">
              <el-select v-model="formData.salesPersonId" filterable clearable placeholder="请选择签单销售" style="width: 100%">
                <el-option v-for="u in salesOptions" :key="u.id" :label="u.displayName" :value="u.id" />
              </el-select>
            </el-form-item>
          </div>

          <div class="n-form-row">
            <el-form-item label="服务内容" prop="serviceContent">
              <el-select v-model="formData.serviceContent" filterable allow-create placeholder="请选择服务内容" style="width: 100%">
                <el-option v-for="t in serviceContentOptions" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
            <el-form-item label="合同类型" prop="contractType">
              <el-radio-group v-model="formData.contractType">
                <el-radio v-for="t in contractTypeOptions" :key="t" :value="t">{{ t }}</el-radio>
              </el-radio-group>
            </el-form-item>
          </div>

          <div class="n-form-row">
            <el-form-item label="成交情况" prop="dealStatus">
              <el-select v-model="formData.dealStatus" filterable allow-create placeholder="请选择成交情况" style="width: 100%">
                <el-option v-for="d in dealStatusOptions" :key="d" :label="d" :value="d" />
              </el-select>
            </el-form-item>
            <el-form-item label="业绩归属城市" prop="performanceCity">
              <el-cascader
                v-model="cityCascaderValue"
                :options="regionData"
                :props="{ checkStrictly: true }"
                filterable
                clearable
                placeholder="请选择城市"
                style="width: 100%"
                @change="onCityChange"
              />
            </el-form-item>
          </div>

        </div>

        <!-- ── 财务信息 ── -->
        <div class="n-form-section">
          <h4 class="n-section-title">财务信息</h4>
          <div class="n-form-row">
            <el-form-item label="付款金额(元)" prop="paymentAmount">
              <el-input-number
                v-model="formData.paymentAmount"
                :precision="2"
                :min="0"
                :controls="false"
                placeholder="请输入金额"
                style="width: 100%"
              />
            </el-form-item>
            <el-form-item label="付款方式" prop="paymentMethod">
              <el-select v-model="formData.paymentMethod" placeholder="请选择付款方式" style="width: 100%">
                <el-option v-for="m in paymentMethodOptions" :key="m" :label="m" :value="m" />
              </el-select>
            </el-form-item>
          </div>
          <div class="n-form-row">
            <el-form-item label="付款单位" prop="paymentCompany">
              <el-select
                v-model="formData.paymentCompany"
                filterable
                allow-create
                clearable
                placeholder="请选择付款单位"
                style="width: 100%"
              >
                <el-option-group label="客户">
                  <el-option
                    v-if="selectedCustomer"
                    :key="'sel-' + selectedCustomer.id"
                    :label="selectedCustomer.fullName"
                    :value="selectedCustomer.fullName"
                  />
                  <el-option
                    v-for="c in customerOptions.filter(c => c.id !== selectedCustomer?.id)"
                    :key="'c-' + c.id"
                    :label="c.fullName"
                    :value="c.fullName"
                  />
                </el-option-group>
                <el-option-group label="合作方">
                  <el-option
                    v-for="p in partnerOptions"
                    :key="'p-' + p.id"
                    :label="p.name"
                    :value="p.name"
                  />
                </el-option-group>
              </el-select>
            </el-form-item>
            <el-form-item label="发票类型" prop="invoiceType">
              <el-select v-model="formData.invoiceType" placeholder="请选择发票类型" clearable style="width: 100%">
                <el-option v-for="t in invoiceTypeOptions" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
          </div>
          <div class="n-form-row">
            <el-form-item label="税率（%）" prop="taxRate">
              <el-select v-model="formData.taxRate" placeholder="请选择税率" clearable style="width: 100%">
                <el-option v-for="r in taxRateOptions" :key="r" :label="r + '%'" :value="r" />
              </el-select>
            </el-form-item>
          </div>
          <el-form-item label="付款信息" prop="paymentInfo">
            <el-input v-model="formData.paymentInfo" type="textarea" :rows="3" placeholder="请输入付款信息" />
          </el-form-item>
        </div>

        <!-- ── 服务信息 ── -->
        <div class="n-form-section">
          <h4 class="n-section-title">服务信息</h4>
          <div class="n-form-row">
            <el-form-item label="服务年度" prop="serviceYears" class="n-form-full">
              <el-select
                v-model="formData.serviceYears"
                multiple
                placeholder="请选择服务年度（可多选）"
                style="width: 100%"
              >
                <el-option v-for="year in serviceYearOptions" :key="year" :label="`${year}年`" :value="year" />
              </el-select>
            </el-form-item>
          </div>
        </div>

        <!-- ── 系统明细 ── -->
        <div class="n-form-section">
          <div style="display: flex; align-items: center; justify-content: space-between">
            <h4 class="n-section-title" style="flex: 1; margin-bottom: 0">系统明细</h4>
            <el-button type="primary" :icon="Plus" size="small" @click="addSystemItem">
              添加系统
            </el-button>
          </div>
          <el-table
            v-if="formData.systemItems.length > 0"
            :data="formData.systemItems"
            border
            style="width: 100%; margin-top: 12px"
          >
            <el-table-column type="index" label="序号" width="60" align="center" />
            <el-table-column label="系统名称" min-width="200">
              <template #default="{ row }">
                <el-input v-model="row.systemName" placeholder="请输入系统名称" />
              </template>
            </el-table-column>
            <el-table-column label="系统等级" width="160">
              <template #default="{ row }">
                <el-select v-model="row.systemLevel" placeholder="请选择等级">
                  <el-option v-for="opt in systemLevelOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="70" align="center">
              <template #default="{ $index }">
                <el-button :icon="Delete" type="danger" link size="small" @click="removeSystemItem($index)" />
              </template>
            </el-table-column>
          </el-table>
        </div>

        <!-- ── 其他 ── -->
        <div class="n-form-section">
          <h4 class="n-section-title">其他</h4>
          <el-form-item label="备注">
            <el-input v-model="formData.remark" type="textarea" :rows="3" placeholder="请输入备注" />
          </el-form-item>
        </div>

        <!-- ── 合同文件（编辑模式，多文件） ── -->
        <div v-if="isEdit && contractId" class="n-form-section">
          <div style="display: flex; align-items: center; justify-content: space-between">
            <h4 class="n-section-title" style="flex: 1; margin-bottom: 0">合同文件</h4>
            <el-upload
              :action="getUploadUrl('CONTRACT', contractId)"
              :headers="uploadHeaders"
              :show-file-list="false"
              :on-success="handleFileUploadSuccess"
              accept=".pdf,.zip,.rar,.doc,.docx,.jpg,.jpeg,.png"
            >
              <el-button type="primary" :icon="Upload" size="small">上传文件</el-button>
            </el-upload>
          </div>

          <el-table
            v-if="contractFiles.length > 0"
            :data="contractFiles"
            border
            size="small"
            style="width: 100%; margin-top: 12px"
          >
            <el-table-column label="文件名" min-width="200" show-overflow-tooltip>
              <template #default="{ row }">
                <el-icon style="vertical-align: -2px; margin-right: 4px"><Paperclip /></el-icon>{{ row.fileName }}
              </template>
            </el-table-column>
            <el-table-column label="大小" width="100">
              <template #default="{ row }">{{ formatFileSize(row.fileSize) }}</template>
            </el-table-column>
            <el-table-column label="上传时间" width="170">
              <template #default="{ row }">{{ formatTime(row.uploadedAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="140" align="center">
              <template #default="{ row }">
                <el-button type="primary" link size="small" :icon="Download" @click="openFileDownload(row.id)">下载</el-button>
                <el-button type="danger" link size="small" :icon="Delete" @click="handleSingleFileDelete(row.id)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div v-else style="border: 2px dashed var(--el-border-color); border-radius: 8px; padding: 32px; text-align: center; background: var(--el-fill-color-blank); margin-top: 12px">
            <el-upload
              :action="getUploadUrl('CONTRACT', contractId)"
              :headers="uploadHeaders"
              :show-file-list="false"
              :on-success="handleFileUploadSuccess"
              accept=".pdf,.zip,.rar,.doc,.docx,.jpg,.jpeg,.png"
              drag
              style="width: 100%"
            >
              <div style="padding: 10px 0">
                <el-icon style="font-size: 32px; color: var(--el-text-color-placeholder); margin-bottom: 8px"><Upload /></el-icon>
                <div style="color: var(--el-text-color-secondary)">点击或拖拽上传合同文件</div>
                <div style="font-size: 12px; color: var(--el-text-color-placeholder); margin-top: 4px">支持 PDF、图片、Word、压缩包，可上传多个</div>
              </div>
            </el-upload>
          </div>
        </div>

        <!-- ── 合同文件说明（编辑模式，单文件） ── -->
        <div v-if="isEdit && contractId" class="n-form-section">
          <h4 class="n-section-title">合同文件说明</h4>
          <template v-if="contractDescFile">
            <div style="display: flex; align-items: center; justify-content: space-between; border: 1px solid var(--el-border-color-lighter); border-radius: 8px; padding: 12px 16px; background: var(--el-fill-color-lighter)">
              <div>
                <el-icon style="vertical-align: -2px; margin-right: 4px"><Paperclip /></el-icon>
                <span style="font-weight: 500">{{ contractDescFile.fileName }}</span>
                <span style="font-size: 12px; color: var(--el-text-color-secondary); margin-left: 12px">{{ formatFileSize(contractDescFile.fileSize) }}</span>
              </div>
              <div style="display: flex; gap: 6px">
                <el-button size="small" :icon="Download" @click="openFileDownload(contractDescFile.id)">下载</el-button>
                <el-upload
                  :action="getUploadUrl('CONTRACT_DESC', contractId)"
                  :headers="uploadHeaders"
                  :show-file-list="false"
                  :before-upload="handleDescBeforeUpload"
                  :on-success="handleDescUploadSuccess"
                  accept=".pdf,.zip,.rar,.doc,.docx,.jpg,.jpeg,.png"
                >
                  <el-button size="small" type="warning" :icon="Upload">替换</el-button>
                </el-upload>
                <el-button size="small" type="danger" plain @click="handleDescFileDelete">删除</el-button>
              </div>
            </div>
          </template>
          <template v-else>
            <el-upload
              :action="getUploadUrl('CONTRACT_DESC', contractId)"
              :headers="uploadHeaders"
              :show-file-list="false"
              :on-success="handleDescUploadSuccess"
              accept=".pdf,.zip,.rar,.doc,.docx,.jpg,.jpeg,.png"
            >
              <el-button type="primary" :icon="Upload" size="small">上传文件说明</el-button>
            </el-upload>
          </template>
        </div>

        <!-- ── 操作栏 ── -->
        <div class="n-form-actions">
          <el-button @click="handleBack">取消</el-button>
          <el-button type="primary" :loading="submitLoading" @click="handleSubmit">
            {{ isEdit ? '保存' : '创建' }}
          </el-button>
        </div>
      </el-form>
    </el-card>

    <!-- Quick create partner dialog -->
    <el-dialog v-model="quickPartnerDialogVisible" title="快速新增合作方" width="400px" :close-on-click-modal="false">
      <el-form label-width="80px">
        <el-form-item label="名称" required>
          <el-input v-model="quickPartnerName" placeholder="请输入合作方名称" @keyup.enter="handleQuickCreatePartner" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="quickPartnerDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="quickPartnerLoading" @click="handleQuickCreatePartner">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>
