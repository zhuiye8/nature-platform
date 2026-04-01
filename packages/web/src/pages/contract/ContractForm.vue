<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { ArrowLeft, Plus, Delete, Upload, Download, Paperclip } from '@element-plus/icons-vue'
import { createContract, updateContract, getContractDetail } from '@/api/contract'
import type { ContractForm as ContractFormData } from '@/api/contract'
import { getCustomerPage } from '@/api/customer'
import type { CustomerItem } from '@/api/customer'
import { getPartnerList, createPartner } from '@/api/partner'
import type { PartnerItem } from '@/api/partner'
import RejectReasonPanel from '@/components/RejectReasonPanel.vue'
import { getUsersByRole } from '@/api/workflow'
import { useAuthStore } from '@/stores/auth'
import { formatTime } from '@/utils/format'
import { getFileList, getUploadUrl, getDownloadUrl, getPreviewUrl, deleteFile, type FileItem } from '@/api/file'

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

const formData = ref<ContractFormData>({
  customerId: undefined,
  contactName: '',
  contactPhone: '',
  paymentCompany: '',
  paymentAmount: undefined,
  paymentMethod: '',
  partnerId: undefined,
  partnerName: '',
  salesPersonId: undefined,
  performanceCity: '',
  dealStatus: '',
  contractType: '',
  serviceYears: [],
  remark: '',
  systemItems: [],
})

const rules: FormRules = {
  customerId: [{ required: true, message: '请选择客户', trigger: 'change' }],
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

function handleCustomerChange(customerId: number) {
  const cust = customerOptions.value.find((c) => c.id === customerId)
  selectedCustomer.value = cust || null
  // Auto-fill contact info (editable)
  if (cust) {
    formData.value.contactName = (cust as any).contactName || ''
    formData.value.contactPhone = (cust as any).mobilePhone || ''
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
  { label: '第一级', value: 1 },
  { label: '第二级', value: 2 },
  { label: '第三级', value: 3 },
  { label: '第四级', value: 4 },
  { label: '第五级', value: 5 },
]

// ── 预设选项 ──
const paymentMethodOptions = ['结项', '分期', '月结', '预付']
const contractTypeOptions = ['等级保护测评', '安全咨询', '渗透测试', '风险评估', '其他']
const dealStatusOptions = ['新客户挖掘', '老客户续签', '老客户转介绍', '招投标', '其他']

// ── 加载详情 ──
async function fetchDetail() {
  if (!contractId.value) return
  loading.value = true
  try {
    const data = (await getContractDetail(contractId.value)) as any
    formData.value = {
      customerId: data.customerId,
      contactName: data.contactName ?? '',
      contactPhone: data.contactPhone ?? '',
      paymentCompany: data.paymentCompany ?? '',
      payerType: data.payerType ?? '',
      payerId: data.payerId ?? undefined,
      paymentAmount: data.paymentAmount ?? undefined,
      paymentMethod: data.paymentMethod ?? '',
      partnerId: data.partnerId ?? undefined,
      salesPersonId: data.salesPersonId ?? undefined,
      performanceCity: data.performanceCity ?? '',
      dealStatus: data.dealStatus ?? '',
      contractType: data.contractType ?? '',
      serviceYears: data.serviceYears ?? [],
      remark: data.remark ?? '',
      systemItems: data.systemItems ?? [],
    }
    // Pre-fill customer option for display
    if (data.customerName) {
      customerOptions.value = [{ id: data.customerId, fullName: data.customerName } as CustomerItem]
      selectedCustomer.value = { id: data.customerId, fullName: data.customerName, contactName: data.contactName ?? '', mobilePhone: data.contactPhone ?? '' } as any
    }
    // Pre-fill partner option
    if (data.partnerId && data.partnerName) {
      if (!partnerOptions.value.find(p => p.id === data.partnerId)) {
        partnerOptions.value.push({ id: data.partnerId, name: data.partnerName } as PartnerItem)
      }
    }
  } finally {
    loading.value = false
    loadContractFile()
  }
}

function handleBack() {
  router.push('/contract')
}

// ── 合同文件管理（编辑模式） ──
const contractFile = ref<FileItem | null>(null)
const filePreviewUrl = ref('')
const uploadHeaders = computed(() => ({ Authorization: `Bearer ${localStorage.getItem('token')}` }))
const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

async function loadContractFile() {
  if (!isEdit.value || !contractId.value) return
  try {
    const files = (await getFileList('CONTRACT', contractId.value)) as any as FileItem[]
    contractFile.value = files && files.length > 0 ? files[0] : null
    if (contractFile.value && (imageTypes.includes(contractFile.value.contentType) || contractFile.value.contentType === 'application/pdf')) {
      const result = (await getPreviewUrl(contractFile.value.id)) as any
      filePreviewUrl.value = result.url || result
    } else {
      filePreviewUrl.value = ''
    }
  } catch {
    contractFile.value = null
  }
}

async function handleFileUploadSuccess() {
  ElMessage.success('上传成功')
  await loadContractFile()
}

async function handleBeforeFileUpload() {
  if (contractFile.value) {
    try { await deleteFile(contractFile.value.id) } catch { /* ignore */ }
  }
  return true
}

async function handleFileDelete() {
  if (!contractFile.value) return
  try { await deleteFile(contractFile.value.id) } catch { /* ignore */ }
  ElMessage.success('已删除')
  contractFile.value = null
  filePreviewUrl.value = ''
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

function formatFileSize(size: number) {
  if (!size) return '-'
  if (size < 1024) return size + ' B'
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB'
  return (size / 1024 / 1024).toFixed(1) + ' MB'
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitLoading.value = true
  try {
    // Clean system items: only send fields the DTO accepts
    const cleanData = {
      ...formData.value,
      systemItems: formData.value.systemItems.map(item => ({
        systemName: item.systemName,
        systemLevel: item.systemLevel,
        sortOrder: item.sortOrder,
      })),
    }
    if (isEdit.value && contractId.value) {
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
    loadContractFile()
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
            <el-form-item label="合作方">
              <div style="display: flex; gap: 8px; width: 100%">
                <el-select v-model="formData.partnerId" filterable clearable placeholder="请选择合作方" style="flex: 1">
                  <el-option v-for="p in partnerOptions" :key="p.id" :label="p.name" :value="p.id" />
                </el-select>
                <el-button :icon="Plus" @click="quickPartnerDialogVisible = true" title="快速新增合作方" />
              </div>
            </el-form-item>
          </div>

          <!-- 联系人（从客户自动填充，可编辑） -->
          <div class="n-form-row">
            <el-form-item label="联系人">
              <el-input v-model="formData.contactName" placeholder="选择客户后自动填充，可修改" />
            </el-form-item>
            <el-form-item label="联系电话">
              <el-input v-model="formData.contactPhone" placeholder="选择客户后自动填充，可修改" />
            </el-form-item>
          </div>

          <div class="n-form-row">
            <el-form-item label="签单销售">
              <el-select v-model="formData.salesPersonId" filterable clearable placeholder="请选择签单销售" style="width: 100%">
                <el-option v-for="u in salesOptions" :key="u.id" :label="u.displayName" :value="u.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="合同类型">
              <el-select v-model="formData.contractType" filterable allow-create placeholder="请选择合同类型" style="width: 100%">
                <el-option v-for="t in contractTypeOptions" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
          </div>

          <div class="n-form-row">
            <el-form-item label="成交情况">
              <el-select v-model="formData.dealStatus" filterable allow-create placeholder="请选择成交情况" style="width: 100%">
                <el-option v-for="d in dealStatusOptions" :key="d" :label="d" :value="d" />
              </el-select>
            </el-form-item>
            <el-form-item label="业绩归属城市">
              <el-input v-model="formData.performanceCity" placeholder="请输入业绩归属城市" />
            </el-form-item>
          </div>

        </div>

        <!-- ── 财务信息 ── -->
        <div class="n-form-section">
          <h4 class="n-section-title">财务信息</h4>
          <div class="n-form-row">
            <el-form-item label="付款金额（元）">
              <el-input-number
                v-model="formData.paymentAmount"
                :precision="2"
                :min="0"
                :controls="false"
                placeholder="请输入金额"
                style="width: 100%"
              />
            </el-form-item>
            <el-form-item label="付款方式">
              <el-select v-model="formData.paymentMethod" filterable allow-create placeholder="请选择付款方式" style="width: 100%">
                <el-option v-for="m in paymentMethodOptions" :key="m" :label="m" :value="m" />
              </el-select>
            </el-form-item>
          </div>
          <div class="n-form-row">
            <el-form-item label="付款单位">
              <el-select
                v-model="formData.paymentCompany"
                filterable
                allow-create
                clearable
                placeholder="请选择付款单位（客户/合作方）"
                style="width: 100%"
              >
                <el-option-group label="客户">
                  <el-option
                    v-for="c in customerOptions"
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
          </div>
        </div>

        <!-- ── 服务信息 ── -->
        <div class="n-form-section">
          <h4 class="n-section-title">服务信息</h4>
          <div class="n-form-row">
            <el-form-item label="服务年度" class="n-form-full">
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

        <!-- ── 合同文件（编辑模式） ── -->
        <div v-if="isEdit && contractId" class="n-form-section">
          <h4 class="n-section-title">合同文件</h4>

          <template v-if="contractFile">
            <div style="border: 1px solid var(--el-border-color-lighter); border-radius: 8px; padding: 16px; background: var(--el-fill-color-lighter)">
              <!-- 文件信息行 -->
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px">
                <div style="flex: 1">
                  <div style="font-weight: 500; margin-bottom: 4px"><el-icon style="vertical-align: -2px; margin-right: 4px"><Paperclip /></el-icon>{{ contractFile.fileName }}</div>
                  <div style="font-size: 12px; color: var(--el-text-color-secondary)">
                    {{ formatFileSize(contractFile.fileSize) }} · {{ formatTime(contractFile.uploadedAt) }}
                  </div>
                </div>
                <div style="display: flex; gap: 6px; flex-shrink: 0">
                  <el-button size="small" :icon="Download" @click="handleFileDownload">下载</el-button>
                  <el-upload
                    :action="getUploadUrl('CONTRACT', contractId)"
                    :headers="uploadHeaders"
                    :show-file-list="false"
                    :before-upload="handleBeforeFileUpload"
                    :on-success="handleFileUploadSuccess"
                    accept=".pdf,.zip,.rar,.doc,.docx,.jpg,.jpeg,.png"
                  >
                    <el-button size="small" type="warning" :icon="Upload">更换</el-button>
                  </el-upload>
                  <el-button size="small" type="danger" plain @click="handleFileDelete">删除</el-button>
                </div>
              </div>

              <!-- 预览区 -->
              <div v-if="imageTypes.includes(contractFile.contentType) && filePreviewUrl" style="text-align: center; border-top: 1px solid var(--el-border-color-lighter); padding-top: 12px">
                <el-image :src="filePreviewUrl" :preview-src-list="[filePreviewUrl]" fit="contain" style="max-width: 100%; max-height: 280px; border-radius: 6px" />
              </div>
              <div v-else-if="contractFile.contentType === 'application/pdf' && filePreviewUrl" style="border-top: 1px solid var(--el-border-color-lighter); padding-top: 12px">
                <iframe :src="filePreviewUrl" style="width: 100%; height: 320px; border: none; border-radius: 6px" />
              </div>
              <div v-else style="text-align: center; padding: 20px 0; color: var(--el-text-color-placeholder); border-top: 1px solid var(--el-border-color-lighter); margin-top: 0; padding-top: 12px; font-size: 13px">
                该格式不支持预览，请下载查看
              </div>
            </div>
          </template>

          <template v-else>
            <div style="border: 2px dashed var(--el-border-color); border-radius: 8px; padding: 32px; text-align: center; background: var(--el-fill-color-blank)">
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
                  <div style="font-size: 12px; color: var(--el-text-color-placeholder); margin-top: 4px">支持 PDF、图片、Word、压缩包</div>
                </div>
              </el-upload>
            </div>
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
