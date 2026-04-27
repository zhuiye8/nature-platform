<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Upload, Delete, Download } from '@element-plus/icons-vue'
import {
  getContractOptions,
  getSystemOptions,
  type ContractOption,
  type SystemOption,
} from '@/api/invoice'   // 复用开票申请的 contract/system options API
import {
  getExpenseDetail,
  createExpense,
  updateExpense,
  submitExpense,
  type ExpenseCreateData,
} from '@/api/expense'
import { getFileList, getUploadUrl, getFileDownloadPath, deleteFile, type FileItem } from '@/api/file'
import {
  SERVICE_CONTENT_OPTIONS,
  INVOICE_TYPE_OPTIONS,
  TAX_RATE_OPTIONS,
  EXPENSE_TYPE_OPTIONS,
  EXPENSE_TYPE_TRAVEL,
  EXPENSE_TYPE_PARTNER,
  isDangerousFile,
} from '@/utils/enums'
import { formatTime } from '@/utils/format'

const route = useRoute()
const router = useRouter()

const isEdit = computed(() => !!route.params.id)
const editId = computed(() => Number(route.params.id))

// ── 三步选择 ──
const serviceContent = ref('')
const contractKeyword = ref('')
const contractOptions = ref<ContractOption[]>([])
const selectedContractId = ref<number | null>(null)
const selectedContract = computed(() =>
  contractOptions.value.find((c) => c.id === selectedContractId.value) ?? null,
)

const systemOptions = ref<SystemOption[]>([])
const selectedSystemIds = ref<Set<number>>(new Set())

// ── 费用表单 ──
const form = ref({
  expenseType: '',
  requestAmount: undefined as number | undefined,
  invoiceType: '',
  taxRate: '',
  invoiceAmount: undefined as number | undefined,
  payeeName: '',
  payeeBank: '',
  payeeAccount: '',
  partnerId: undefined as number | undefined,
  partnerName: '',
  partnerAmount: undefined as number | undefined,
  partnerInvoiceType: '',
  partnerTaxRate: '',
  remark: '',
})

const submitting = ref(false)
const saving = ref(false)

// ── 差旅费 / 合作费 特殊逻辑 ──
const isTravelExpense = computed(() => form.value.expenseType === EXPENSE_TYPE_TRAVEL)
const isPartnerExpense = computed(() => form.value.expenseType === EXPENSE_TYPE_PARTNER)

// 选中合作费时自动从合同回填合作方信息
watch(isPartnerExpense, (yes) => {
  if (yes && selectedContract.value) {
    if (!form.value.partnerId) form.value.partnerId = selectedContract.value.partnerId ?? undefined
    if (!form.value.partnerName) form.value.partnerName = selectedContract.value.partnerName ?? ''
    if (!form.value.partnerAmount && selectedContract.value.paymentAmount) {
      form.value.partnerAmount = Number(selectedContract.value.paymentAmount)
    }
    if (!form.value.partnerInvoiceType) form.value.partnerInvoiceType = selectedContract.value.invoiceType ?? ''
    if (!form.value.partnerTaxRate) form.value.partnerTaxRate = formatTaxRate(selectedContract.value.taxRate)
  }
})

// 差旅费时清空发票相关字段
watch(isTravelExpense, (yes) => {
  if (yes) {
    form.value.invoiceType = ''
    form.value.taxRate = ''
    form.value.invoiceAmount = undefined
  }
})

// ── 加载合同选项 ──
let contractFetchTimer: ReturnType<typeof setTimeout> | null = null
async function loadContractOptions() {
  if (!serviceContent.value) {
    contractOptions.value = []
    return
  }
  try {
    contractOptions.value = await getContractOptions({
      serviceContent: serviceContent.value,
      keyword: contractKeyword.value || undefined,
    })
  } catch {
    contractOptions.value = []
  }
}

watch(serviceContent, () => {
  selectedContractId.value = null
  systemOptions.value = []
  selectedSystemIds.value = new Set()
  loadContractOptions()
})

watch(contractKeyword, () => {
  if (contractFetchTimer) clearTimeout(contractFetchTimer)
  contractFetchTimer = setTimeout(loadContractOptions, 300)
})

async function onContractSelected(contractId: number | null) {
  selectedContractId.value = contractId
  selectedSystemIds.value = new Set()
  if (!contractId) {
    systemOptions.value = []
    return
  }
  try {
    systemOptions.value = await getSystemOptions(contractId)
  } catch {
    systemOptions.value = []
  }
  if (systemOptions.value.length === 0) {
    ElMessageBox.alert(
      '该合同下暂无可选系统，请先完成项目登记审批后再发起费用请款',
      '提示',
      { type: 'warning', confirmButtonText: '知道了' },
    )
  }
}

function toggleSystem(systemId: number) {
  if (selectedSystemIds.value.has(systemId)) {
    selectedSystemIds.value.delete(systemId)
  } else {
    selectedSystemIds.value.add(systemId)
  }
  selectedSystemIds.value = new Set(selectedSystemIds.value)
}

// ── Helpers ──
function formatAmount(val: any) {
  if (val == null || val === '') return '--'
  return `¥${Number(val).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`
}

function formatTaxRate(rate: string | null): string {
  if (!rate) return ''
  return rate.endsWith('%') ? rate : `${rate}%`
}

// ── 附件管理 ──
const attachments = ref<FileItem[]>([])
const uploadHeaders = computed(() => ({ Authorization: `Bearer ${localStorage.getItem('token')}` }))
const expenseIdForFile = computed(() => isEdit.value ? editId.value : 0)

async function loadAttachments() {
  if (!expenseIdForFile.value) {
    attachments.value = []
    return
  }
  try {
    attachments.value = (await getFileList('EXPENSE_ATTACH', expenseIdForFile.value)) as any
  } catch {
    attachments.value = []
  }
}

function onBeforeUpload(file: File): boolean {
  if (isDangerousFile(file.name)) {
    ElMessage.error('该类型文件不允许上传（可执行文件存在安全风险）')
    return false
  }
  return true
}

function onUploadSuccess() {
  ElMessage.success('上传成功')
  loadAttachments()
}

async function handleDeleteAttachment(fileId: number) {
  try {
    await ElMessageBox.confirm('确认删除该附件？', '确认', { type: 'warning' })
    await deleteFile(fileId)
    ElMessage.success('已删除')
    loadAttachments()
  } catch { /* cancelled */ }
}

function downloadAttachment(fileId: number) {
  window.open(getFileDownloadPath(fileId), '_blank')
}

// ── 编辑模式 ──
async function loadDetail() {
  if (!isEdit.value) return
  const detail = await getExpenseDetail(editId.value)

  serviceContent.value = detail.serviceContent ?? ''
  await loadContractOptions()
  selectedContractId.value = detail.contractId
  if (!contractOptions.value.find((c) => c.id === detail.contractId)) {
    contractOptions.value.unshift({
      id: detail.contractId,
      contractNo: detail.contractNo,
      contractName: detail.contractName,
      paymentAmount: detail.contractAmount,
      invoiceType: detail.contractInvoiceType,
      taxRate: detail.contractTaxRate,
      serviceContent: detail.serviceContent,
      partnerId: detail.partnerId,
      partnerName: detail.partnerName,
      customerId: detail.customerId ?? 0,
      customerName: detail.customerName,
    })
  }
  systemOptions.value = await getSystemOptions(detail.contractId)
  selectedSystemIds.value = new Set(detail.systems.map((s) => s.id))

  form.value = {
    expenseType: detail.expenseType,
    requestAmount: Number(detail.requestAmount),
    invoiceType: detail.invoiceType ?? '',
    taxRate: detail.taxRate ?? '',
    invoiceAmount: detail.invoiceAmount != null ? Number(detail.invoiceAmount) : undefined,
    payeeName: detail.payeeName,
    payeeBank: detail.payeeBank,
    payeeAccount: detail.payeeAccount,
    partnerId: detail.partnerId ?? undefined,
    partnerName: detail.partnerName ?? '',
    partnerAmount: detail.partnerAmount != null ? Number(detail.partnerAmount) : undefined,
    partnerInvoiceType: detail.partnerInvoiceType ?? '',
    partnerTaxRate: detail.partnerTaxRate ?? '',
    remark: detail.remark ?? '',
  }

  await loadAttachments()
}

// ── 校验 + 提交 ──
function buildPayload(): ExpenseCreateData | null {
  if (!serviceContent.value) {
    ElMessage.warning('请选择服务内容')
    return null
  }
  if (!selectedContractId.value) {
    ElMessage.warning('请选择合同')
    return null
  }
  if (selectedSystemIds.value.size === 0) {
    ElMessage.warning('请至少选择一个系统')
    return null
  }
  if (!form.value.expenseType) {
    ElMessage.warning('请选择费用类型')
    return null
  }
  if (!form.value.requestAmount || form.value.requestAmount <= 0) {
    ElMessage.warning('请填写费用请款金额')
    return null
  }
  // 合作费时 partner 信息必填
  if (isPartnerExpense.value) {
    if (!form.value.partnerName?.trim()) {
      ElMessage.warning('合作费请款时，合作方名称必填')
      return null
    }
    if (!form.value.partnerAmount || form.value.partnerAmount <= 0) {
      ElMessage.warning('合作费请款时，合作方合同金额必填')
      return null
    }
    if (!form.value.partnerInvoiceType) {
      ElMessage.warning('合作费请款时，合作方发票类型必填')
      return null
    }
    if (!form.value.partnerTaxRate) {
      ElMessage.warning('合作费请款时，合作方发票税率必填')
      return null
    }
  }
  // 收款人信息
  if (!form.value.payeeName.trim()) {
    ElMessage.warning('请填写收款人姓名')
    return null
  }
  if (!form.value.payeeBank.trim()) {
    ElMessage.warning('请填写收款人开户行')
    return null
  }
  if (!/^\d{10,30}$/.test(form.value.payeeAccount)) {
    ElMessage.warning('收款人银行账号格式不正确（应为 10-30 位数字）')
    return null
  }

  return {
    contractId: selectedContractId.value,
    systems: Array.from(selectedSystemIds.value).map((id) => ({ systemId: id })),
    expenseType: form.value.expenseType,
    requestAmount: form.value.requestAmount,
    invoiceType: form.value.invoiceType || undefined,
    taxRate: form.value.taxRate || undefined,
    invoiceAmount: form.value.invoiceAmount,
    payeeName: form.value.payeeName.trim(),
    payeeBank: form.value.payeeBank.trim(),
    payeeAccount: form.value.payeeAccount.trim(),
    partnerId: form.value.partnerId,
    partnerName: form.value.partnerName?.trim() || undefined,
    partnerAmount: form.value.partnerAmount,
    partnerInvoiceType: form.value.partnerInvoiceType || undefined,
    partnerTaxRate: form.value.partnerTaxRate || undefined,
    remark: form.value.remark.trim() || undefined,
  }
}

async function handleSaveDraft() {
  const payload = buildPayload()
  if (!payload) return
  saving.value = true
  try {
    if (isEdit.value) {
      await updateExpense(editId.value, payload)
    } else {
      await createExpense(payload)
    }
    ElMessage.success('草稿已保存')
    router.push('/finance/expense')
  } finally {
    saving.value = false
  }
}

async function handleSubmit() {
  const payload = buildPayload()
  if (!payload) return

  submitting.value = true
  try {
    let id: number = editId.value
    if (isEdit.value) {
      await updateExpense(editId.value, payload)
    } else {
      const created = (await createExpense(payload)) as any
      id = created?.id ?? created?.data?.id
    }
    if (id) {
      await submitExpense(id)
      ElMessage.success('已提交审核')
      router.push('/finance/expense')
    }
  } finally {
    submitting.value = false
  }
}

onMounted(loadDetail)
</script>

<template>
  <div>
    <el-page-header :icon="ArrowLeft" @back="router.back()">
      <template #content>
        <span style="font-weight: 600; font-size: 16px">{{ isEdit ? '编辑费用请款' : '新建费用请款' }}</span>
      </template>
    </el-page-header>

    <el-card shadow="never" style="margin-top: 16px">
      <el-form label-width="130px" style="max-width: 920px">
        <!-- ── Step 1: 服务内容 ── -->
        <el-form-item label="服务内容" required>
          <el-select v-model="serviceContent" placeholder="先选择服务内容" style="width: 280px">
            <el-option v-for="sc in SERVICE_CONTENT_OPTIONS" :key="sc" :label="sc" :value="sc" />
          </el-select>
        </el-form-item>

        <!-- ── Step 2: 合同 ── -->
        <el-form-item label="合同" required>
          <el-select
            :model-value="selectedContractId"
            placeholder="按合同名称搜索"
            filterable
            remote
            :remote-method="(kw: string) => { contractKeyword = kw }"
            :disabled="!serviceContent"
            style="width: 100%"
            @update:model-value="onContractSelected"
          >
            <el-option
              v-for="c in contractOptions"
              :key="c.id"
              :label="`${c.contractName || '(未命名)'} ${c.contractNo ? `(${c.contractNo})` : ''}`"
              :value="c.id"
            />
            <template #empty>
              <div style="padding: 16px; color: #909399; text-align: center">
                {{ serviceContent ? '无符合条件的合同' : '请先选择服务内容' }}
              </div>
            </template>
          </el-select>
        </el-form-item>

        <!-- 合同信息 -->
        <template v-if="selectedContract">
          <el-descriptions :column="2" border size="small" style="margin: 0 0 16px">
            <el-descriptions-item label="合同金额">{{ formatAmount(selectedContract.paymentAmount) }}</el-descriptions-item>
            <el-descriptions-item label="客户">{{ selectedContract.customerName || '--' }}</el-descriptions-item>
            <el-descriptions-item label="合同发票类型">{{ selectedContract.invoiceType || '--' }}</el-descriptions-item>
            <el-descriptions-item label="合同税率">{{ selectedContract.taxRate || '--' }}</el-descriptions-item>
            <el-descriptions-item label="合作方">{{ selectedContract.partnerName || '--' }}</el-descriptions-item>
          </el-descriptions>
        </template>

        <!-- ── Step 3: 系统多选 (金额只展示) ── -->
        <el-form-item v-if="selectedContractId" label="系统选择" required>
          <div style="width: 100%">
            <div v-if="systemOptions.length === 0" style="color: #909399; padding: 8px 0">
              该合同下暂无可选系统
            </div>
            <el-table v-else :data="systemOptions" border size="small" style="width: 100%">
              <el-table-column type="selection" width="44" align="center">
                <template #default="{ row }">
                  <el-checkbox
                    :model-value="selectedSystemIds.has(row.id)"
                    @update:model-value="() => toggleSystem(row.id)"
                  />
                </template>
              </el-table-column>
              <el-table-column label="系统编号" min-width="200" show-overflow-tooltip>
                <template #default="{ row }">{{ row.systemNo || '--' }}</template>
              </el-table-column>
              <el-table-column label="系统名称" min-width="180" show-overflow-tooltip>
                <template #default="{ row }">{{ row.systemName }}</template>
              </el-table-column>
              <el-table-column label="保护等级" width="90" align="center">
                <template #default="{ row }">{{ row.securityLevel || '--' }}</template>
              </el-table-column>
              <el-table-column label="系统金额（只读）" min-width="160" align="right">
                <template #default="{ row }">
                  <span :style="{ color: row.amount ? 'inherit' : '#909399' }">
                    {{ row.amount ? formatAmount(row.amount) : '未录入' }}
                  </span>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-form-item>

        <el-divider />

        <!-- ── 费用信息 ── -->
        <el-form-item label="费用类型" required>
          <el-select v-model="form.expenseType" placeholder="请选择费用类型" style="width: 200px">
            <el-option v-for="t in EXPENSE_TYPE_OPTIONS" :key="t" :label="t" :value="t" />
          </el-select>
          <span v-if="isTravelExpense" style="margin-left: 12px; color: #E6A23C; font-size: 12px">
            ⚠ 差旅费请款无需发票，发票相关字段已灰化
          </span>
          <span v-if="isPartnerExpense" style="margin-left: 12px; color: #409EFF; font-size: 12px">
            ⚠ 合作费请款时合作方信息必填（已从合同自动回填，可编辑）
          </span>
        </el-form-item>
        <el-form-item label="费用请款金额" required>
          <el-input-number v-model="form.requestAmount" :min="0.01" :precision="2" :controls="false" placeholder="费用请款金额" style="width: 240px" />
        </el-form-item>
        <el-form-item label="发票金额">
          <el-input-number v-model="form.invoiceAmount" :min="0" :precision="2" :controls="false" :disabled="isTravelExpense" placeholder="可与请款金额不同" style="width: 240px" />
        </el-form-item>
        <el-form-item label="发票类型">
          <el-select v-model="form.invoiceType" :disabled="isTravelExpense" placeholder="发票类型" clearable style="width: 180px">
            <el-option v-for="opt in INVOICE_TYPE_OPTIONS" :key="opt" :label="opt" :value="opt" />
          </el-select>
        </el-form-item>
        <el-form-item label="发票税率">
          <el-select v-model="form.taxRate" :disabled="isTravelExpense" placeholder="税率" clearable style="width: 180px">
            <el-option v-for="opt in TAX_RATE_OPTIONS" :key="opt" :label="opt" :value="opt" />
          </el-select>
        </el-form-item>

        <el-divider />

        <!-- ── 收款人信息 ── -->
        <el-form-item label="收款人" required>
          <el-input v-model="form.payeeName" placeholder="收款人姓名" maxlength="128" style="width: 280px" />
        </el-form-item>
        <el-form-item label="收款人开户行" required>
          <el-input v-model="form.payeeBank" placeholder="如：中国银行XXX分行" maxlength="255" />
        </el-form-item>
        <el-form-item label="收款人银行账号" required>
          <el-input v-model="form.payeeAccount" placeholder="10-30 位数字" maxlength="30" />
        </el-form-item>

        <!-- ── 合作方信息 (合作费时显示) ── -->
        <template v-if="isPartnerExpense">
          <el-divider>合作方信息（合作费时必填）</el-divider>
          <el-form-item label="合作方名称" required>
            <el-input v-model="form.partnerName" placeholder="合作方名称" maxlength="255" />
          </el-form-item>
          <el-form-item label="合作方合同金额" required>
            <el-input-number v-model="form.partnerAmount" :min="0" :precision="2" :controls="false" placeholder="合作方合同金额" style="width: 240px" />
          </el-form-item>
          <el-form-item label="合作方发票类型" required>
            <el-select v-model="form.partnerInvoiceType" placeholder="发票类型" style="width: 180px">
              <el-option v-for="opt in INVOICE_TYPE_OPTIONS" :key="opt" :label="opt" :value="opt" />
            </el-select>
          </el-form-item>
          <el-form-item label="合作方发票税率" required>
            <el-select v-model="form.partnerTaxRate" placeholder="税率" style="width: 180px">
              <el-option v-for="opt in TAX_RATE_OPTIONS" :key="opt" :label="opt" :value="opt" />
            </el-select>
          </el-form-item>
        </template>

        <el-divider />

        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="备注（可选）" />
        </el-form-item>

        <!-- ── 附件 ── -->
        <el-form-item v-if="isEdit" label="附件">
          <div style="width: 100%">
            <el-upload
              :action="getUploadUrl('EXPENSE_ATTACH', editId)"
              :headers="uploadHeaders"
              :show-file-list="false"
              :before-upload="onBeforeUpload"
              :on-success="onUploadSuccess"
              multiple
            >
              <el-button type="primary" :icon="Upload" size="small">上传附件</el-button>
              <span style="margin-left: 12px; color: #909399; font-size: 12px">支持任意类型（.exe/.bat 等危险文件除外），多个文件</span>
            </el-upload>
            <el-table v-if="attachments.length > 0" :data="attachments" border size="small" style="margin-top: 8px">
              <el-table-column prop="fileName" label="文件名" min-width="240" show-overflow-tooltip />
              <el-table-column label="上传时间" min-width="160">
                <template #default="{ row }">{{ formatTime(row.uploadedAt) }}</template>
              </el-table-column>
              <el-table-column label="操作" width="140" align="center">
                <template #default="{ row }">
                  <el-button type="primary" link size="small" :icon="Download" @click="downloadAttachment(row.id)">下载</el-button>
                  <el-button type="danger" link size="small" :icon="Delete" @click="handleDeleteAttachment(row.id)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-form-item>
        <el-form-item v-else label="附件">
          <span style="color: #909399; font-size: 13px">保存草稿后可上传附件</span>
        </el-form-item>

        <el-form-item>
          <el-button @click="router.back()">取消</el-button>
          <el-button :loading="saving" @click="handleSaveDraft">保存草稿</el-button>
          <el-button type="primary" :loading="submitting" @click="handleSubmit">提交审核</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>
