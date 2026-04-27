<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { getInvoiceDetail, reviewInvoice, type InvoiceDetail } from '@/api/invoice'
import { SERVICE_CONTENT_TAG_TYPE } from '@/utils/enums'
import { formatTime } from '@/utils/format'
import { usePermission } from '@/composables/usePermission'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const { hasPermission } = usePermission()
const authStore = useAuthStore()

const detail = ref<InvoiceDetail | null>(null)
const loading = ref(false)

const invoiceId = computed(() => Number(route.params.id))

const statusLabel: Record<string, string> = {
  DRAFT: '草稿', SUBMITTED: '审核中', APPROVED: '已开票', REJECTED: '需修改',
}
const statusTagType: Record<string, 'info' | 'warning' | 'success' | 'danger'> = {
  DRAFT: 'info', SUBMITTED: 'warning', APPROVED: 'success', REJECTED: 'danger',
}

const canReview = computed(() =>
  detail.value?.status === 'SUBMITTED' &&
  (hasPermission('invoice:review') || authStore.user?.roles?.includes('super_admin')),
)

async function fetchDetail() {
  loading.value = true
  try {
    detail.value = await getInvoiceDetail(invoiceId.value)
  } finally {
    loading.value = false
  }
}

function formatAmount(val: any) {
  if (val == null || val === '') return '--'
  return `¥${Number(val).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`
}

// ── 审核 ──
const reviewing = ref(false)
async function handleReview(action: 'APPROVE' | 'REJECT') {
  const actionLabel = action === 'APPROVE' ? '已开票' : '需修改'
  try {
    const { value: remark } = await ElMessageBox.prompt(
      `确认标记为「${actionLabel}」？`,
      `审核 - ${actionLabel}`,
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        inputType: 'textarea',
        inputPlaceholder: action === 'REJECT' ? '请填写需要修改的内容（必填）' : '审核意见（可选）',
        inputValidator: (v) => action === 'REJECT' && !v?.trim() ? '驳回时必须填写修改意见' : true,
      },
    )
    reviewing.value = true
    await reviewInvoice(invoiceId.value, action, remark?.trim() || undefined)
    ElMessage.success(`已标记为「${actionLabel}」`)
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
        <span style="font-weight: 600; font-size: 16px">开票申请详情</span>
      </template>
    </el-page-header>

    <template v-if="detail">
      <!-- ── 状态卡片 ── -->
      <el-card shadow="never" style="margin-top: 16px">
        <div style="display: flex; align-items: center; justify-content: space-between">
          <div>
            <span style="font-size: 18px; font-weight: 600">{{ detail.contractName || '(未命名合同)' }}</span>
            <span style="margin-left: 12px; color: #909399; font-size: 14px">{{ detail.contractNo }}</span>
            <el-tag v-if="detail.serviceContent" :type="SERVICE_CONTENT_TAG_TYPE[detail.serviceContent] || 'info'" size="small" style="margin-left: 12px">
              {{ detail.serviceContent }}
            </el-tag>
          </div>
          <el-tag :type="statusTagType[detail.status] || 'info'" size="large">
            {{ statusLabel[detail.status] || detail.status }}
          </el-tag>
        </div>
      </el-card>

      <!-- ── 合同信息 ── -->
      <el-card shadow="never" style="margin-top: 16px">
        <template #header><span style="font-weight: 600; font-size: 15px">合同信息</span></template>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="合同编号">{{ detail.contractNo || '--' }}</el-descriptions-item>
          <el-descriptions-item label="合同名称">{{ detail.contractName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="客户">{{ detail.customerName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="服务内容">
            <el-tag v-if="detail.serviceContent" :type="SERVICE_CONTENT_TAG_TYPE[detail.serviceContent] || 'info'" size="small">
              {{ detail.serviceContent }}
            </el-tag>
            <span v-else>--</span>
          </el-descriptions-item>
          <el-descriptions-item label="合同金额">{{ formatAmount(detail.contractAmount) }}</el-descriptions-item>
          <el-descriptions-item label="合同发票类型">{{ detail.contractInvoiceType || '--' }}</el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- ── 系统列表 ── -->
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

      <!-- ── 开票信息 ── -->
      <el-card shadow="never" style="margin-top: 16px">
        <template #header><span style="font-weight: 600; font-size: 15px">开票信息</span></template>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="开票内容" :span="2">{{ detail.invoiceContent }}</el-descriptions-item>
          <el-descriptions-item label="申请开票金额">
            <strong style="color: #f56c6c">{{ formatAmount(detail.applyAmount) }}</strong>
          </el-descriptions-item>
          <el-descriptions-item label="发票类型">{{ detail.invoiceType }}</el-descriptions-item>
          <el-descriptions-item label="发票税率">{{ detail.taxRate }}</el-descriptions-item>
          <el-descriptions-item label="申请人">{{ detail.creatorName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="开票说明" :span="2">{{ detail.description || '--' }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ detail.remark || '--' }}</el-descriptions-item>
          <el-descriptions-item label="申请时间">{{ formatTime(detail.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="更新时间">{{ formatTime(detail.updatedAt) }}</el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- ── 累计汇总 ── -->
      <el-card shadow="never" style="margin-top: 16px">
        <template #header><span style="font-weight: 600; font-size: 15px">合同累计</span></template>
        <el-row :gutter="16">
          <el-col :span="6">
            <el-statistic title="合同金额" :value="detail.cumulative.contractAmount" :precision="2" prefix="¥ " />
          </el-col>
          <el-col :span="6">
            <el-statistic title="累计已开票（含审核中）" :value="detail.cumulative.invoicedTotal" :precision="2" prefix="¥ " value-style="color: #409EFF" />
          </el-col>
          <el-col :span="6">
            <el-statistic title="累计已回款" :value="detail.cumulative.paidTotal" :precision="2" prefix="¥ " value-style="color: #67C23A" />
          </el-col>
          <el-col :span="6">
            <el-statistic title="剩余可开票额度" :value="detail.cumulative.remainingInvoice" :precision="2" prefix="¥ " value-style="color: #E6A23C" />
          </el-col>
        </el-row>
      </el-card>

      <!-- ── 审核操作 ── -->
      <el-card v-if="canReview" shadow="never" style="margin-top: 16px; margin-bottom: 24px">
        <template #header><span style="font-weight: 600; font-size: 15px">审核操作</span></template>
        <div style="display: flex; gap: 12px">
          <el-button type="success" :loading="reviewing" @click="handleReview('APPROVE')">已开票</el-button>
          <el-button type="danger" :loading="reviewing" @click="handleReview('REJECT')">需修改</el-button>
        </div>
      </el-card>
    </template>
  </div>
</template>
