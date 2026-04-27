<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Download } from '@element-plus/icons-vue'
import { getExpenseDetail, reviewExpense, type ExpenseDetail } from '@/api/expense'
import { getFileList, getFileDownloadPath, type FileItem } from '@/api/file'
import { SERVICE_CONTENT_TAG_TYPE, EXPENSE_TYPE_TRAVEL, EXPENSE_TYPE_PARTNER } from '@/utils/enums'
import { formatTime } from '@/utils/format'
import { usePermission } from '@/composables/usePermission'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const { hasPermission } = usePermission()
const authStore = useAuthStore()

const detail = ref<ExpenseDetail | null>(null)
const attachments = ref<FileItem[]>([])
const loading = ref(false)

const expenseId = computed(() => Number(route.params.id))

const statusLabel: Record<string, string> = {
  DRAFT: '草稿',
  SUBMITTED: '部门审核中',
  DEPT_APPROVED: '财务审核中',
  APPROVED: '已通过',
  REJECTED: '需修改',
}
const statusTagType: Record<string, 'info' | 'warning' | 'success' | 'danger' | 'primary'> = {
  DRAFT: 'info',
  SUBMITTED: 'warning',
  DEPT_APPROVED: 'primary',
  APPROVED: 'success',
  REJECTED: 'danger',
}

// 当前用户在哪个节点能审核
const isSuperAdmin = computed(() => authStore.user?.roles?.includes('super_admin') ?? false)
const canDeptReview = computed(() =>
  detail.value?.status === 'SUBMITTED' && (hasPermission('expense:dept_approve') || isSuperAdmin.value),
)
const canFinReview = computed(() =>
  detail.value?.status === 'DEPT_APPROVED' && (hasPermission('expense:fin_approve') || isSuperAdmin.value),
)
const canReview = computed(() => canDeptReview.value || canFinReview.value)

const isTravelExpense = computed(() => detail.value?.expenseType === EXPENSE_TYPE_TRAVEL)
const isPartnerExpense = computed(() => detail.value?.expenseType === EXPENSE_TYPE_PARTNER)

async function fetchDetail() {
  loading.value = true
  try {
    detail.value = await getExpenseDetail(expenseId.value)
    try {
      attachments.value = (await getFileList('EXPENSE_ATTACH', expenseId.value)) as any
    } catch {
      attachments.value = []
    }
  } finally {
    loading.value = false
  }
}

function formatAmount(val: any) {
  if (val == null || val === '') return '--'
  return `¥${Number(val).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`
}

function downloadAttachment(fileId: number) {
  window.open(getFileDownloadPath(fileId), '_blank')
}

// ── 审核 ──
const reviewing = ref(false)
async function handleReview(action: 'APPROVE' | 'REJECT') {
  const phaseLabel = canDeptReview.value ? '部门审核' : '财务审核'
  const actionLabel = action === 'APPROVE' ? '通过' : '驳回'
  try {
    const { value: remark } = await ElMessageBox.prompt(
      `确认 ${phaseLabel} ${actionLabel} 该费用请款？`,
      `${phaseLabel} - ${actionLabel}`,
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        inputType: 'textarea',
        inputPlaceholder: action === 'REJECT' ? '请填写需要修改的内容（必填）' : '审核意见（可选）',
        inputValidator: (v) => action === 'REJECT' && !v?.trim() ? '驳回时必须填写修改意见' : true,
      },
    )
    reviewing.value = true
    await reviewExpense(expenseId.value, action, remark?.trim() || undefined)
    ElMessage.success(`已${actionLabel}`)
    fetchDetail()
  } catch {
    /* cancelled */
  } finally {
    reviewing.value = false
  }
}

onMounted(fetchDetail)
</script>

<template>
  <div v-loading="loading">
    <el-page-header :icon="ArrowLeft" @back="router.back()">
      <template #content>
        <span style="font-weight: 600; font-size: 16px">费用请款详情</span>
      </template>
    </el-page-header>

    <template v-if="detail">
      <!-- 状态卡片 -->
      <el-card shadow="never" style="margin-top: 16px">
        <div style="display: flex; align-items: center; justify-content: space-between">
          <div>
            <span style="font-size: 18px; font-weight: 600">{{ detail.contractName || '(未命名合同)' }}</span>
            <span style="margin-left: 12px; color: #909399; font-size: 14px">{{ detail.contractNo }}</span>
            <el-tag v-if="detail.serviceContent" :type="SERVICE_CONTENT_TAG_TYPE[detail.serviceContent] || 'info'" size="small" style="margin-left: 12px">
              {{ detail.serviceContent }}
            </el-tag>
            <el-tag size="small" style="margin-left: 8px">{{ detail.expenseType }}</el-tag>
          </div>
          <el-tag :type="statusTagType[detail.status] || 'info'" size="large">
            {{ statusLabel[detail.status] || detail.status }}
          </el-tag>
        </div>
      </el-card>

      <!-- 合同信息 -->
      <el-card shadow="never" style="margin-top: 16px">
        <template #header><span style="font-weight: 600; font-size: 15px">合同信息</span></template>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="合同编号">{{ detail.contractNo || '--' }}</el-descriptions-item>
          <el-descriptions-item label="合同名称">{{ detail.contractName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="客户">{{ detail.customerName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="合同金额">{{ formatAmount(detail.contractAmount) }}</el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- 系统列表 -->
      <el-card shadow="never" style="margin-top: 16px">
        <template #header><span style="font-weight: 600; font-size: 15px">系统明细</span></template>
        <el-table :data="detail.systems" border size="small" style="width: 100%">
          <el-table-column label="系统编号" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">{{ row.systemNo || '--' }}</template>
          </el-table-column>
          <el-table-column label="系统名称" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">{{ row.systemName }}</template>
          </el-table-column>
          <el-table-column label="保护等级" width="90" align="center">
            <template #default="{ row }">{{ row.securityLevel || '--' }}</template>
          </el-table-column>
          <el-table-column label="所属项目" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">{{ row.applicationName || '--' }}</template>
          </el-table-column>
          <el-table-column label="系统金额" min-width="130" align="right">
            <template #default="{ row }">{{ formatAmount(row.amount) }}</template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- 费用信息 -->
      <el-card shadow="never" style="margin-top: 16px">
        <template #header><span style="font-weight: 600; font-size: 15px">费用信息</span></template>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="费用类型">
            <el-tag size="small">{{ detail.expenseType }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="费用请款金额">
            <strong style="color: #f56c6c">{{ formatAmount(detail.requestAmount) }}</strong>
          </el-descriptions-item>
          <el-descriptions-item v-if="!isTravelExpense" label="发票类型">{{ detail.invoiceType || '--' }}</el-descriptions-item>
          <el-descriptions-item v-if="!isTravelExpense" label="发票税率">{{ detail.taxRate || '--' }}</el-descriptions-item>
          <el-descriptions-item v-if="!isTravelExpense" label="发票金额">{{ formatAmount(detail.invoiceAmount) }}</el-descriptions-item>
          <el-descriptions-item v-if="isTravelExpense" label="说明" :span="2">
            <span style="color: #E6A23C">差旅费请款 — 无发票相关字段</span>
          </el-descriptions-item>
          <el-descriptions-item label="申请人">{{ detail.creatorName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="申请时间">{{ formatTime(detail.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ detail.remark || '--' }}</el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- 收款人信息 -->
      <el-card shadow="never" style="margin-top: 16px">
        <template #header><span style="font-weight: 600; font-size: 15px">收款人信息</span></template>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="收款人">{{ detail.payeeName }}</el-descriptions-item>
          <el-descriptions-item label="开户行">{{ detail.payeeBank }}</el-descriptions-item>
          <el-descriptions-item label="银行账号" :span="2">{{ detail.payeeAccount }}</el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- 合作方信息 (合作费时) -->
      <el-card v-if="isPartnerExpense" shadow="never" style="margin-top: 16px">
        <template #header><span style="font-weight: 600; font-size: 15px">合作方信息</span></template>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="合作方名称">{{ detail.partnerName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="合作方合同金额">{{ formatAmount(detail.partnerAmount) }}</el-descriptions-item>
          <el-descriptions-item label="合作方发票类型">{{ detail.partnerInvoiceType || '--' }}</el-descriptions-item>
          <el-descriptions-item label="合作方发票税率">{{ detail.partnerTaxRate || '--' }}</el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- 附件 -->
      <el-card shadow="never" style="margin-top: 16px">
        <template #header><span style="font-weight: 600; font-size: 15px">附件</span></template>
        <el-table v-if="attachments.length > 0" :data="attachments" border size="small">
          <el-table-column prop="fileName" label="文件名" min-width="240" show-overflow-tooltip />
          <el-table-column label="上传时间" min-width="160">
            <template #default="{ row }">{{ formatTime(row.uploadedAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="100" align="center">
            <template #default="{ row }">
              <el-button type="primary" link size="small" :icon="Download" @click="downloadAttachment(row.id)">下载</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="无附件" :image-size="60" />
      </el-card>

      <!-- 审核操作 -->
      <el-card v-if="canReview" shadow="never" style="margin-top: 16px; margin-bottom: 24px">
        <template #header>
          <span style="font-weight: 600; font-size: 15px">
            {{ canDeptReview ? '部门审核' : '财务审核' }}
          </span>
        </template>
        <div style="display: flex; gap: 12px">
          <el-button type="success" :loading="reviewing" @click="handleReview('APPROVE')">通过</el-button>
          <el-button type="danger" :loading="reviewing" @click="handleReview('REJECT')">驳回</el-button>
        </div>
      </el-card>
    </template>
  </div>
</template>
