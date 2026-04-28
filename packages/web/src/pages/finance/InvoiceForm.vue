<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import {
  getContractOptions,
  getSystemOptions,
  getInvoiceDetail,
  createInvoice,
  updateInvoice,
  submitInvoice,
  deleteInvoice,
  type ContractOption,
  type SystemOption,
  type InvoiceCreateData,
} from '@/api/invoice'
import { SERVICE_CONTENT_OPTIONS, INVOICE_TYPE_OPTIONS, TAX_RATE_OPTIONS } from '@/utils/enums'

const route = useRoute()
const router = useRouter()

const isEdit = computed(() => !!route.params.id)
const editId = computed(() => Number(route.params.id))

// ── 三步选择状态 ──
const serviceContent = ref('')
const contractKeyword = ref('')
const contractOptions = ref<ContractOption[]>([])
const selectedContractId = ref<number | null>(null)
const selectedContract = computed(() =>
  contractOptions.value.find((c) => c.id === selectedContractId.value) ?? null,
)

const systemOptions = ref<SystemOption[]>([])
const systemSelections = ref<Map<number, number | undefined>>(new Map()) // systemId → amount

// ── 表单字段 ──
const form = ref({
  invoiceContent: '',
  applyAmount: undefined as number | undefined,
  invoiceType: '',
  taxRate: '',
  description: '',
  remark: '',
})

const submitting = ref(false)
const saving = ref(false)

// ── 加载合同选项 (受服务内容 + 关键词过滤) ──
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
  systemSelections.value = new Map()
  loadContractOptions()
})

watch(contractKeyword, () => {
  if (contractFetchTimer) clearTimeout(contractFetchTimer)
  contractFetchTimer = setTimeout(loadContractOptions, 300)
})

// ── 选合同后加载系统选项 + 自动继承发票类型/税率 ──
async function onContractSelected(contractId: number | null) {
  selectedContractId.value = contractId
  systemSelections.value = new Map()
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
      '该合同下暂无可选系统，请先完成项目登记审批后再发起开票申请',
      '提示',
      { type: 'warning', confirmButtonText: '知道了' },
    )
  }
  // 默认继承
  if (selectedContract.value) {
    if (!form.value.invoiceType) form.value.invoiceType = selectedContract.value.invoiceType ?? ''
    if (!form.value.taxRate) form.value.taxRate = formatTaxRate(selectedContract.value.taxRate)
    // 系统默认金额 = project_system_item.amount (如果存在)
    for (const s of systemOptions.value) {
      if (s.amount) {
        systemSelections.value.set(s.id, Number(s.amount))
      }
    }
  }
}

// ── 系统多选 ──
function toggleSystem(systemId: number) {
  if (systemSelections.value.has(systemId)) {
    systemSelections.value.delete(systemId)
  } else {
    const sys = systemOptions.value.find((s) => s.id === systemId)
    systemSelections.value.set(systemId, sys?.amount ? Number(sys.amount) : undefined)
  }
  // 强制响应式
  systemSelections.value = new Map(systemSelections.value)
}

function setSystemAmount(systemId: number, amount: number | undefined) {
  systemSelections.value.set(systemId, amount)
  systemSelections.value = new Map(systemSelections.value)
}

const selectedSystemEntries = computed(() =>
  Array.from(systemSelections.value.entries()).map(([systemId, amount]) => ({ systemId, amount })),
)

// ── 累计信息 (实时) ──
const cumulative = computed(() => {
  if (!selectedContract.value || !form.value.applyAmount) return null
  return {
    contractAmount: Number(selectedContract.value.paymentAmount ?? 0),
    invoicedTotal: 0, // 实际由后端计算；新建时无法精确
    paidTotal: 0,
    remainingInvoice: Number(selectedContract.value.paymentAmount ?? 0),
  }
})

// ── Helpers ──
function formatAmount(val: any) {
  if (val == null || val === '') return '--'
  return `¥${Number(val).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`
}

function formatTaxRate(rate: string | null): string {
  if (!rate) return ''
  // 后端可能存 "6" 或 "6%"，统一为 "6%"
  return rate.endsWith('%') ? rate : `${rate}%`
}

// ── 编辑模式: 加载详情 ──
async function loadDetail() {
  if (!isEdit.value) return
  const detail = await getInvoiceDetail(editId.value)

  // 预填字段
  serviceContent.value = detail.serviceContent ?? ''
  await loadContractOptions()
  selectedContractId.value = detail.contractId
  // 确保选中合同也在列表中（如果当前关键词不匹配，可能 fetch 不到）
  if (!contractOptions.value.find((c) => c.id === detail.contractId)) {
    contractOptions.value.unshift({
      id: detail.contractId,
      contractNo: detail.contractNo,
      contractName: detail.contractName,
      paymentAmount: detail.contractAmount,
      invoiceType: detail.contractInvoiceType,
      taxRate: detail.contractTaxRate,
      serviceContent: detail.serviceContent,
      partnerId: null,
      partnerName: null,
      customerId: detail.customerId ?? 0,
      customerName: detail.customerName,
    })
  }
  systemOptions.value = await getSystemOptions(detail.contractId)
  systemSelections.value = new Map(detail.systems.map((s) => [s.id, s.amount ? Number(s.amount) : undefined]))

  form.value = {
    invoiceContent: detail.invoiceContent,
    applyAmount: Number(detail.applyAmount),
    invoiceType: detail.invoiceType,
    taxRate: detail.taxRate,
    description: detail.description ?? '',
    remark: detail.remark ?? '',
  }
}

// ── 提交校验 ──
function buildPayload(): InvoiceCreateData | null {
  if (!serviceContent.value) {
    ElMessage.warning('请选择服务内容')
    return null
  }
  if (!selectedContractId.value) {
    ElMessage.warning('请选择合同')
    return null
  }
  const entries = selectedSystemEntries.value
  if (entries.length === 0) {
    ElMessage.warning('请至少选择一个系统')
    return null
  }
  for (const e of entries) {
    if (!e.amount || e.amount <= 0) {
      ElMessage.warning('请填写每个系统的金额（必填且 > 0）')
      return null
    }
  }
  if (!form.value.invoiceContent.trim()) {
    ElMessage.warning('请填写开票内容')
    return null
  }
  if (!form.value.applyAmount || form.value.applyAmount <= 0) {
    ElMessage.warning('请填写申请开票金额')
    return null
  }
  if (!form.value.invoiceType) {
    ElMessage.warning('请选择发票类型')
    return null
  }
  if (!form.value.taxRate) {
    ElMessage.warning('请选择发票税率')
    return null
  }
  return {
    contractId: selectedContractId.value,
    systems: entries as { systemId: number; amount: number }[],
    invoiceContent: form.value.invoiceContent.trim(),
    applyAmount: form.value.applyAmount,
    invoiceType: form.value.invoiceType,
    taxRate: form.value.taxRate,
    description: form.value.description.trim() || undefined,
    remark: form.value.remark.trim() || undefined,
  }
}

async function handleSaveDraft() {
  const payload = buildPayload()
  if (!payload) return
  saving.value = true
  try {
    if (isEdit.value) {
      await updateInvoice(editId.value, payload)
      ElMessage.success('草稿已保存')
    } else {
      await createInvoice(payload)
      ElMessage.success('草稿已保存')
    }
    router.push('/finance/invoice')
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
    let createdInThisCall = false
    if (isEdit.value) {
      await updateInvoice(editId.value, payload)
    } else {
      const created = (await createInvoice(payload)) as any
      id = created?.id ?? created?.data?.id
      createdInThisCall = true
    }
    if (id) {
      try {
        await submitInvoice(id)
        ElMessage.success('已提交审核')
        router.push('/finance/invoice')
      } catch (err) {
        // submit 失败 (累计校验等): 如果是新建本次创建的草稿, 清理掉避免残留
        // 错误信息已由 axios interceptor 显示给用户
        if (createdInThisCall) {
          try { await deleteInvoice(id) } catch { /* 清理失败不再扩散 */ }
        }
        throw err
      }
    }
  } catch {
    /* 错误已通过 interceptor 显示 */
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
        <span style="font-weight: 600; font-size: 16px">{{ isEdit ? '编辑开票申请' : '新建开票申请' }}</span>
      </template>
    </el-page-header>

    <el-card shadow="never" style="margin-top: 16px">
      <el-form label-width="120px" style="max-width: 900px">
        <!-- ── Step 1: 服务内容 ── -->
        <el-form-item label="服务内容" required>
          <el-select v-model="serviceContent" placeholder="先选择服务内容" style="width: 280px">
            <el-option v-for="sc in SERVICE_CONTENT_OPTIONS" :key="sc" :label="sc" :value="sc" />
          </el-select>
        </el-form-item>

        <!-- ── Step 2: 选合同 ── -->
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
                {{ serviceContent ? '无符合条件的合同（请确认服务内容并尝试搜索）' : '请先选择服务内容' }}
              </div>
            </template>
          </el-select>
        </el-form-item>

        <!-- 合同信息 (继承显示) -->
        <template v-if="selectedContract">
          <el-descriptions :column="2" border size="small" style="margin: 0 0 16px">
            <el-descriptions-item label="合同金额">{{ formatAmount(selectedContract.paymentAmount) }}</el-descriptions-item>
            <el-descriptions-item label="客户">{{ selectedContract.customerName || '--' }}</el-descriptions-item>
            <el-descriptions-item label="合同发票类型">{{ selectedContract.invoiceType || '--' }}</el-descriptions-item>
            <el-descriptions-item label="合同税率">{{ selectedContract.taxRate || '--' }}</el-descriptions-item>
          </el-descriptions>
        </template>

        <!-- ── Step 3: 系统多选 ── -->
        <el-form-item v-if="selectedContractId" label="系统选择" required>
          <div style="width: 100%">
            <div v-if="systemOptions.length === 0" style="color: #909399; padding: 8px 0">
              该合同下暂无可选系统（项目登记尚未审批通过）
            </div>
            <el-table v-else :data="systemOptions" border size="small" style="width: 100%">
              <el-table-column type="selection" width="44" align="center">
                <template #default="{ row }">
                  <el-checkbox
                    :model-value="systemSelections.has(row.id)"
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
              <el-table-column label="金额（必填）" min-width="180">
                <template #default="{ row }">
                  <el-input-number
                    :model-value="systemSelections.get(row.id)"
                    :min="0"
                    :precision="2"
                    :controls="false"
                    :disabled="!systemSelections.has(row.id)"
                    placeholder="系统金额"
                    style="width: 100%"
                    @update:model-value="(v: any) => setSystemAmount(row.id, v)"
                  />
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-form-item>

        <!-- ── 开票信息 ── -->
        <el-form-item label="开票内容" required>
          <el-input v-model="form.invoiceContent" placeholder="如：等保测评服务费" maxlength="500" />
        </el-form-item>
        <el-form-item label="申请开票金额" required>
          <el-input-number v-model="form.applyAmount" :min="0.01" :precision="2" :controls="false" placeholder="申请开票金额" style="width: 280px" />
        </el-form-item>
        <el-form-item label="发票类型" required>
          <el-select v-model="form.invoiceType" placeholder="发票类型" style="width: 180px">
            <el-option v-for="opt in INVOICE_TYPE_OPTIONS" :key="opt" :label="opt" :value="opt" />
          </el-select>
        </el-form-item>
        <el-form-item label="发票税率" required>
          <el-select v-model="form.taxRate" placeholder="税率" style="width: 180px">
            <el-option v-for="opt in TAX_RATE_OPTIONS" :key="opt" :label="opt" :value="opt" />
          </el-select>
        </el-form-item>
        <el-form-item label="开票说明">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="开票说明（可选）" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="备注（可选）" />
        </el-form-item>

        <!-- ── 累计信息提示 ── -->
        <el-alert
          v-if="selectedContract && form.applyAmount"
          type="info"
          :closable="false"
          show-icon
          style="margin-bottom: 16px"
        >
          <template #default>
            <div>
              合同金额: <strong>{{ formatAmount(selectedContract.paymentAmount) }}</strong>
              <span style="margin-left: 16px; color: #909399">
                注: 提交时后端会校验"累计开票（含审核中）+ 当前金额 ≤ 合同金额"
              </span>
            </div>
          </template>
        </el-alert>

        <el-form-item>
          <el-button @click="router.back()">取消</el-button>
          <el-button :loading="saving" @click="handleSaveDraft">保存草稿</el-button>
          <el-button type="primary" :loading="submitting" @click="handleSubmit">提交审核</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>
