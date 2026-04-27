<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { ArrowLeft, Plus, Delete } from '@element-plus/icons-vue'
import { getContractDetail, updateContractFinancial, type ContractItem } from '@/api/contract'
import { getPaymentRecords, createPaymentRecord, deletePaymentRecord, type PaymentRecord } from '@/api/payment-record'
import { getStatusLabel, getStatusTagType } from '@/utils/status-map'
import { SERVICE_CONTENT_TAG_TYPE } from '@/utils/enums'
import { formatTime } from '@/utils/format'
import { usePermission } from '@/composables/usePermission'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const { hasPermission } = usePermission()
const authStore = useAuthStore()

const contractId = computed(() => Number(route.params.id))
const contract = ref<ContractItem | null>(null)
const loading = ref(false)

// 财务信息编辑表单
const finForm = ref({
  paymentAmount: undefined as number | undefined,
  paymentMethod: '',
  paymentCompany: '',
  paymentInfo: '',
  invoiceType: '',
  taxRate: '',
  performanceCity: '',
})
const finSaving = ref(false)
const canEditFinance = computed(() => hasPermission('contract:update_financial'))

// 回款明细
const paymentRecords = ref<PaymentRecord[]>([])
const paymentSummary = ref({ contractAmount: 0, totalPaid: 0, remaining: 0 })
const canRecordPayment = computed(() => hasPermission('payment:record'))
const isSuperAdmin = computed(() => authStore.user?.roles?.includes('super_admin') ?? false)

// 添加回款弹窗
const addDialogVisible = ref(false)
const addFormRef = ref<FormInstance | null>(null)
const addForm = reactive({
  amount: undefined as number | undefined,
  paidAt: '',
  payer: '',
  remark: '',
})
const addSaving = ref(false)

const todayStr = new Date().toISOString().slice(0, 10)
const addRules: FormRules = {
  amount: [
    { required: true, message: '请输入回款金额', trigger: 'blur' },
    { validator: (_r, v: number, cb) => (v && v > 0 ? cb() : cb(new Error('金额必须大于 0'))), trigger: 'blur' },
  ],
  paidAt: [
    { required: true, message: '请选择回款日期', trigger: 'change' },
  ],
}

function disableFutureDate(d: Date) {
  return d.getTime() > Date.now()
}

// ── Helpers ──
function formatAmount(val: any) {
  if (val == null || val === '') return '--'
  return `¥${Number(val).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`
}

// ── Data loading ──
async function fetchContract() {
  loading.value = true
  try {
    contract.value = await getContractDetail(contractId.value)
    if (contract.value) {
      finForm.value = {
        paymentAmount: contract.value.paymentAmount ? Number(contract.value.paymentAmount) : undefined,
        paymentMethod: contract.value.paymentMethod ?? '',
        paymentCompany: contract.value.paymentCompany ?? '',
        paymentInfo: contract.value.paymentInfo ?? '',
        invoiceType: contract.value.invoiceType ?? '',
        taxRate: contract.value.taxRate ?? '',
        performanceCity: contract.value.performanceCity ?? '',
      }
    }
  } finally {
    loading.value = false
  }
}

async function fetchPaymentRecords() {
  const data = await getPaymentRecords(contractId.value)
  paymentRecords.value = data.list ?? []
  paymentSummary.value = data.summary ?? { contractAmount: 0, totalPaid: 0, remaining: 0 }
}

// ── 财务信息保存 ──
async function saveFinancial() {
  if (!contract.value) return
  finSaving.value = true
  try {
    await updateContractFinancial(contract.value.id, finForm.value)
    ElMessage.success('财务信息已保存')
    fetchContract()
  } finally {
    finSaving.value = false
  }
}

// ── 付款方候选项（来自合同的客户/付款公司/合作方）──
const payerOptions = computed(() => {
  const c = contract.value
  if (!c) return []
  const opts: string[] = []
  if (c.customerName) opts.push(c.customerName)
  if (c.paymentCompany && c.paymentCompany !== c.customerName) opts.push(c.paymentCompany)
  if (c.partnerName) opts.push(c.partnerName)
  return opts
})

// ── 添加回款 ──
function openAddDialog() {
  addForm.amount = undefined
  addForm.paidAt = todayStr
  // 默认填合同的付款公司，没有则用客户名
  addForm.payer = contract.value?.paymentCompany || contract.value?.customerName || ''
  addForm.remark = ''
  addDialogVisible.value = true
}

async function saveAddPayment() {
  if (!addFormRef.value) return
  await addFormRef.value.validate().catch(() => null) // 触发显示错误
  const valid = await addFormRef.value.validate().then(() => true).catch(() => false)
  if (!valid) return

  addSaving.value = true
  try {
    await createPaymentRecord(contractId.value, {
      amount: addForm.amount!,
      paidAt: addForm.paidAt,
      payer: addForm.payer.trim() || undefined,
      remark: addForm.remark.trim() || undefined,
    })
    ElMessage.success('回款已录入')
    addDialogVisible.value = false
    await Promise.all([fetchContract(), fetchPaymentRecords()])
  } finally {
    addSaving.value = false
  }
}

// ── 删除回款 (super_admin) ──
async function handleDeleteRecord(row: PaymentRecord) {
  try {
    await ElMessageBox.confirm(`确认删除 ${formatAmount(row.amount)} 的回款记录？`, '确认', { type: 'warning' })
    await deletePaymentRecord(contractId.value, row.id)
    ElMessage.success('已删除')
    await Promise.all([fetchContract(), fetchPaymentRecords()])
  } catch { /* cancelled */ }
}

onMounted(async () => {
  await Promise.all([fetchContract(), fetchPaymentRecords()])
})
</script>

<template>
  <div v-loading="loading">
    <!-- ── 顶部导航 ── -->
    <el-page-header :icon="ArrowLeft" @back="router.back()">
      <template #content>
        <span style="font-weight: 600; font-size: 16px">合同财务 - {{ contract?.contractName || '...' }}</span>
      </template>
    </el-page-header>

    <template v-if="contract">
      <!-- ── 合同基本信息 (只读) ── -->
      <el-card shadow="never" style="margin-top: 16px">
        <template #header>
          <span style="font-weight: 600; font-size: 15px">合同基本信息</span>
        </template>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="合同编号">{{ contract.contractNo || '--' }}</el-descriptions-item>
          <el-descriptions-item label="合同名称">{{ contract.contractName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="客户">{{ contract.customerName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="服务内容">
            <el-tag v-if="contract.serviceContent" :type="SERVICE_CONTENT_TAG_TYPE[contract.serviceContent] || 'info'" size="small">
              {{ contract.serviceContent }}
            </el-tag>
            <span v-else>--</span>
          </el-descriptions-item>
          <el-descriptions-item label="合同金额">{{ formatAmount(contract.paymentAmount) }}</el-descriptions-item>
          <el-descriptions-item label="签订日期">{{ contract.signedAt ? new Date(contract.signedAt).toLocaleDateString('zh-CN') : '--' }}</el-descriptions-item>
          <el-descriptions-item label="签单销售">{{ contract.salesPersonName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="合作方">{{ contract.partnerName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ contract.remark || '--' }}</el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- ── 财务信息 (finance 可编辑) ── -->
      <el-card shadow="never" style="margin-top: 16px">
        <template #header>
          <span style="font-weight: 600; font-size: 15px">财务信息</span>
        </template>
        <el-form label-width="110px" style="max-width: 800px">
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="合同金额">
                <el-input-number v-model="finForm.paymentAmount" :min="0" :precision="2" :controls="false" :disabled="!canEditFinance" placeholder="合同金额" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="付款方式">
                <el-input v-model="finForm.paymentMethod" :disabled="!canEditFinance" placeholder="如：全款 / 进度款" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="发票类型">
                <el-input v-model="finForm.invoiceType" :disabled="!canEditFinance" placeholder="如：专票 / 普票" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="税率">
                <el-input v-model="finForm.taxRate" :disabled="!canEditFinance" placeholder="如：6 / 13" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="付款公司">
                <el-input v-model="finForm.paymentCompany" :disabled="!canEditFinance" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="履约城市">
                <el-input v-model="finForm.performanceCity" :disabled="!canEditFinance" />
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <el-form-item label="付款信息">
                <el-input v-model="finForm.paymentInfo" type="textarea" :rows="2" :disabled="!canEditFinance" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-form-item v-if="canEditFinance">
            <el-button type="primary" :loading="finSaving" @click="saveFinancial">保存财务信息</el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <!-- ── 回款汇总 ── -->
      <el-card shadow="never" style="margin-top: 16px">
        <template #header>
          <span style="font-weight: 600; font-size: 15px">回款汇总</span>
        </template>
        <el-row :gutter="16">
          <el-col :span="6">
            <el-statistic title="合同金额" :value="paymentSummary.contractAmount" :precision="2" prefix="¥ " />
          </el-col>
          <el-col :span="6">
            <el-statistic title="累计回款" :value="paymentSummary.totalPaid" :precision="2" prefix="¥ " value-style="color: #67C23A" />
          </el-col>
          <el-col :span="6">
            <el-statistic title="剩余" :value="paymentSummary.remaining" :precision="2" prefix="¥ " value-style="color: #E6A23C" />
          </el-col>
          <el-col :span="6">
            <div style="font-size: 13px; color: #909399; padding-bottom: 8px">回款状态</div>
            <el-tag :type="getStatusTagType(contract.paymentStatus)" size="large">
              {{ getStatusLabel(contract.paymentStatus) || contract.paymentStatus }}
            </el-tag>
          </el-col>
        </el-row>
      </el-card>

      <!-- ── 回款明细 ── -->
      <el-card shadow="never" style="margin-top: 16px; margin-bottom: 24px">
        <template #header>
          <div style="display: flex; align-items: center; justify-content: space-between">
            <span style="font-weight: 600; font-size: 15px">回款明细</span>
            <el-button v-if="canRecordPayment" type="primary" :icon="Plus" size="small" @click="openAddDialog">添加回款</el-button>
          </div>
        </template>
        <el-table :data="paymentRecords" border stripe size="small" style="width: 100%">
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
          <el-table-column v-if="isSuperAdmin" label="操作" width="80" fixed="right">
            <template #default="{ row }">
              <el-button type="danger" link size="small" :icon="Delete" @click="handleDeleteRecord(row)">删除</el-button>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty description="暂无回款记录" :image-size="80" />
          </template>
        </el-table>
      </el-card>
    </template>

    <!-- ── 添加回款弹窗 ── -->
    <el-dialog v-model="addDialogVisible" title="添加回款" width="480px" :close-on-click-modal="false">
      <el-form ref="addFormRef" :model="addForm" :rules="addRules" label-width="90px">
        <el-form-item label="金额" prop="amount">
          <el-input-number v-model="addForm.amount" :min="0.01" :precision="2" :controls="false" placeholder="回款金额" style="width: 100%" />
        </el-form-item>
        <el-form-item label="回款日期" prop="paidAt">
          <el-date-picker
            v-model="addForm.paidAt"
            type="date"
            placeholder="请选择回款日期"
            value-format="YYYY-MM-DD"
            :disabled-date="disableFutureDate"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="付款方">
          <el-select
            v-model="addForm.payer"
            placeholder="付款方名称（可从合同候选中选择，或自行输入）"
            filterable
            allow-create
            default-first-option
            clearable
            style="width: 100%"
          >
            <el-option v-for="opt in payerOptions" :key="opt" :label="opt" :value="opt" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="addForm.remark" type="textarea" :rows="2" placeholder="备注（可选）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="addSaving" @click="saveAddPayment">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>
