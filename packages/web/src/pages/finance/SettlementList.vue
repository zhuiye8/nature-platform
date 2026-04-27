<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Search, Refresh, View } from '@element-plus/icons-vue'
import {
  getSettlementGroupPage,
  getSettlementContractDetail,
  type SettlementGroupItem,
  type SettlementContractRow,
  type SettlementContractDetail,
} from '@/api/settlement'
import { SERVICE_CONTENT_OPTIONS, SERVICE_CONTENT_TAG_TYPE } from '@/utils/enums'
import { formatTime } from '@/utils/format'

const tableData = ref<SettlementGroupItem[]>([])
const loading = ref(false)
const keyword = ref('')
const serviceContentFilter = ref('')
const dateRange = ref<[string, string] | null>(null)
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)

// 时间快捷选项
const datePickerShortcuts = [
  {
    text: '本月',
    value: () => {
      const now = new Date()
      return [new Date(now.getFullYear(), now.getMonth(), 1), now]
    },
  },
  {
    text: '本季度',
    value: () => {
      const now = new Date()
      const q = Math.floor(now.getMonth() / 3)
      return [new Date(now.getFullYear(), q * 3, 1), now]
    },
  },
  {
    text: '本年',
    value: () => {
      const now = new Date()
      return [new Date(now.getFullYear(), 0, 1), now]
    },
  },
]

async function fetchData() {
  loading.value = true
  try {
    const data = (await getSettlementGroupPage({
      page: currentPage.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined,
      serviceContent: serviceContentFilter.value || undefined,
      startDate: dateRange.value?.[0] || undefined,
      endDate: dateRange.value?.[1] || undefined,
    })) as any
    tableData.value = data.list
    total.value = data.total
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  currentPage.value = 1
  fetchData()
}

function handleReset() {
  keyword.value = ''
  serviceContentFilter.value = ''
  dateRange.value = null
  currentPage.value = 1
  fetchData()
}

function formatAmount(val: any) {
  if (val == null || val === '') return '--'
  return `¥${Number(val).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`
}

// ── 详情弹窗 ──
const detailVisible = ref(false)
const detail = ref<SettlementContractDetail | null>(null)
const detailLoading = ref(false)

async function openDetail(row: SettlementContractRow) {
  detailVisible.value = true
  detail.value = null
  detailLoading.value = true
  try {
    detail.value = await getSettlementContractDetail(row.id)
  } finally {
    detailLoading.value = false
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null
watch(keyword, () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => handleSearch(), 300)
})

onMounted(fetchData)
</script>

<template>
  <div>
    <el-card shadow="never">
      <template #header>
        <span style="font-weight: 600; font-size: 16px">结算管理</span>
      </template>

      <!-- 筛选 -->
      <div style="margin-bottom: 16px; display: flex; gap: 12px; flex-wrap: wrap">
        <el-input
          v-model="keyword"
          placeholder="搜索合同组 / 合同名称 / 合同编号"
          clearable
          style="width: 320px"
          :prefix-icon="Search"
          @keyup.enter="handleSearch"
        />
        <el-select v-model="serviceContentFilter" placeholder="服务内容" clearable style="width: 140px" @change="handleSearch">
          <el-option v-for="sc in SERVICE_CONTENT_OPTIONS" :key="sc" :label="sc" :value="sc" />
        </el-select>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="签订开始"
          end-placeholder="签订结束"
          value-format="YYYY-MM-DD"
          :shortcuts="datePickerShortcuts"
          style="width: 260px"
          @change="handleSearch"
        />
        <el-button :icon="Search" type="primary" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="handleReset">重置</el-button>
      </div>

      <!-- 合同组父子表格 -->
      <el-table v-loading="loading" :data="tableData" stripe border style="width: 100%" row-key="id">
        <el-table-column type="expand">
          <template #default="{ row: group }">
            <div style="padding: 12px 24px">
              <el-table v-if="group.contracts.length > 0" :data="group.contracts" border size="small" style="width: 100%">
                <el-table-column label="合同编号" min-width="170" show-overflow-tooltip>
                  <template #default="{ row }">{{ row.contractNo || '--' }}</template>
                </el-table-column>
                <el-table-column label="合同名称" min-width="200" show-overflow-tooltip>
                  <template #default="{ row }">{{ row.contractName || '--' }}</template>
                </el-table-column>
                <el-table-column label="服务内容" min-width="120" align="center">
                  <template #default="{ row }">
                    <el-tag v-if="row.serviceContent" :type="SERVICE_CONTENT_TAG_TYPE[row.serviceContent] || 'info'" size="small">
                      {{ row.serviceContent }}
                    </el-tag>
                    <span v-else>--</span>
                  </template>
                </el-table-column>
                <el-table-column label="合同金额" min-width="130" align="right">
                  <template #default="{ row }">{{ formatAmount(row.paymentAmount) }}</template>
                </el-table-column>
                <el-table-column label="累计开票" min-width="130" align="right">
                  <template #default="{ row }">
                    <span style="color: #409EFF">{{ formatAmount(row.invoicedTotal) }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="累计回款" min-width="130" align="right">
                  <template #default="{ row }">
                    <span style="color: #67C23A">{{ formatAmount(row.paidTotal) }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="费用合计" min-width="130" align="right">
                  <template #default="{ row }">
                    <span style="color: #E6A23C">{{ formatAmount(row.expenseTotal) }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="合作发票/付款" min-width="180" align="right">
                  <template #default="{ row }">
                    <span v-if="row.partnerName">
                      {{ formatAmount(row.partnerInvoiceTotal) }} / {{ formatAmount(row.partnerPaidTotal) }}
                    </span>
                    <span v-else>--</span>
                  </template>
                </el-table-column>
                <el-table-column label="毛利" min-width="130" align="right">
                  <template #default="{ row }">
                    <strong :style="{ color: row.grossProfit >= 0 ? '#67C23A' : '#f56c6c' }">
                      {{ formatAmount(row.grossProfit) }}
                    </strong>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="100" fixed="right">
                  <template #default="{ row }">
                    <el-button type="primary" link size="small" :icon="View" @click="openDetail(row)">详情</el-button>
                  </template>
                </el-table-column>
              </el-table>
              <div v-else style="color: #909399; text-align: center; padding: 16px 0">该组下无符合筛选的合同</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="合同组名称" min-width="250" show-overflow-tooltip>
          <template #default="{ row }">
            <span style="font-weight: 500">{{ row.groupName }}</span>
          </template>
        </el-table-column>
        <el-table-column label="合同数" width="80" align="center">
          <template #default="{ row }">{{ row.contracts?.length ?? 0 }}</template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div style="display: flex; justify-content: flex-end; margin-top: 16px">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="() => { currentPage = 1; fetchData() }"
          @current-change="fetchData"
        />
      </div>
    </el-card>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" title="结算详情" width="1100px" :close-on-click-modal="false" top="5vh">
      <div v-loading="detailLoading">
        <template v-if="detail">
          <!-- 顶部摘要 -->
          <el-descriptions :column="2" border size="small" style="margin-bottom: 16px">
            <el-descriptions-item label="合同编号">{{ detail.contractNo || '--' }}</el-descriptions-item>
            <el-descriptions-item label="合同名称">{{ detail.contractName || '--' }}</el-descriptions-item>
            <el-descriptions-item label="客户">{{ detail.customerName || '--' }}</el-descriptions-item>
            <el-descriptions-item label="服务内容">
              <el-tag v-if="detail.serviceContent" :type="SERVICE_CONTENT_TAG_TYPE[detail.serviceContent] || 'info'" size="small">
                {{ detail.serviceContent }}
              </el-tag>
              <span v-else>--</span>
            </el-descriptions-item>
            <el-descriptions-item label="合同金额">{{ formatAmount(detail.paymentAmount) }}</el-descriptions-item>
            <el-descriptions-item label="合作方">{{ detail.partnerName || '--' }}</el-descriptions-item>
          </el-descriptions>

          <!-- 金额汇总 -->
          <el-row :gutter="12" style="margin-bottom: 16px">
            <el-col :span="6">
              <el-statistic title="系统金额合计" :value="detail.systemAmountTotal" :precision="2" prefix="¥ " />
            </el-col>
            <el-col :span="6">
              <el-statistic title="累计已开票" :value="detail.invoicedTotal" :precision="2" prefix="¥ " value-style="color: #409EFF" />
            </el-col>
            <el-col :span="6">
              <el-statistic title="累计回款" :value="detail.paidTotal" :precision="2" prefix="¥ " value-style="color: #67C23A" />
            </el-col>
            <el-col :span="6">
              <el-statistic title="费用合计" :value="detail.expenseTotal" :precision="2" prefix="¥ " value-style="color: #E6A23C" />
            </el-col>
          </el-row>

          <!-- 毛利公式 -->
          <el-alert type="success" :closable="false" show-icon style="margin-bottom: 16px">
            <template #default>
              <div>
                <span>项目结算毛利（含税） = 系统金额合计 − 费用合计</span>
                <span style="margin-left: 16px">
                  = {{ formatAmount(detail.systemAmountTotal) }} − {{ formatAmount(detail.expenseTotal) }}
                  = <strong :style="{ color: detail.grossProfit >= 0 ? '#67C23A' : '#f56c6c' }">{{ formatAmount(detail.grossProfit) }}</strong>
                </span>
              </div>
            </template>
          </el-alert>

          <el-tabs>
            <el-tab-pane :label="`系统明细 (${detail.systems.length})`" name="systems">
              <el-table :data="detail.systems" border size="small">
                <el-table-column label="系统编号" min-width="180" show-overflow-tooltip>
                  <template #default="{ row }">{{ row.systemNo || '--' }}</template>
                </el-table-column>
                <el-table-column label="系统名称" min-width="160" show-overflow-tooltip>
                  <template #default="{ row }">{{ row.systemName }}</template>
                </el-table-column>
                <el-table-column label="保护等级" width="90" align="center">
                  <template #default="{ row }">{{ row.securityLevel || '--' }}</template>
                </el-table-column>
                <el-table-column label="所属项目" min-width="160" show-overflow-tooltip>
                  <template #default="{ row }">{{ row.applicationName || '--' }}</template>
                </el-table-column>
                <el-table-column label="系统金额" min-width="130" align="right">
                  <template #default="{ row }">{{ formatAmount(row.amount) }}</template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
            <el-tab-pane :label="`已通过开票 (${detail.invoices.length})`" name="invoices">
              <el-table :data="detail.invoices" border size="small">
                <el-table-column label="开票内容" min-width="200" show-overflow-tooltip>
                  <template #default="{ row }">{{ row.invoiceContent }}</template>
                </el-table-column>
                <el-table-column label="申请金额" min-width="130" align="right">
                  <template #default="{ row }">{{ formatAmount(row.applyAmount) }}</template>
                </el-table-column>
                <el-table-column label="发票类型" width="100" align="center">
                  <template #default="{ row }">{{ row.invoiceType }}</template>
                </el-table-column>
                <el-table-column label="税率" width="80" align="center">
                  <template #default="{ row }">{{ row.taxRate }}</template>
                </el-table-column>
                <el-table-column label="申请人" min-width="100">
                  <template #default="{ row }">{{ row.creatorName || '--' }}</template>
                </el-table-column>
                <el-table-column label="申请时间" min-width="160">
                  <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
            <el-tab-pane :label="`已通过费用 (${detail.expenses.length})`" name="expenses">
              <el-table :data="detail.expenses" border size="small">
                <el-table-column label="费用类型" width="100" align="center">
                  <template #default="{ row }">
                    <el-tag size="small">{{ row.expenseType }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="请款金额" min-width="130" align="right">
                  <template #default="{ row }">{{ formatAmount(row.requestAmount) }}</template>
                </el-table-column>
                <el-table-column label="发票金额" min-width="130" align="right">
                  <template #default="{ row }">{{ formatAmount(row.invoiceAmount) }}</template>
                </el-table-column>
                <el-table-column label="收款人" min-width="120">
                  <template #default="{ row }">{{ row.payeeName }}</template>
                </el-table-column>
                <el-table-column label="合作方" min-width="120">
                  <template #default="{ row }">{{ row.partnerName || '--' }}</template>
                </el-table-column>
                <el-table-column label="申请人" min-width="100">
                  <template #default="{ row }">{{ row.creatorName || '--' }}</template>
                </el-table-column>
                <el-table-column label="申请时间" min-width="160">
                  <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
            <el-tab-pane :label="`回款明细 (${detail.payments.length})`" name="payments">
              <el-table :data="detail.payments" border size="small">
                <el-table-column label="金额" min-width="130" align="right">
                  <template #default="{ row }">{{ formatAmount(row.amount) }}</template>
                </el-table-column>
                <el-table-column label="回款日期" min-width="120">
                  <template #default="{ row }">{{ row.paidAt }}</template>
                </el-table-column>
                <el-table-column label="付款方" min-width="160" show-overflow-tooltip>
                  <template #default="{ row }">{{ row.payer || '--' }}</template>
                </el-table-column>
                <el-table-column label="备注" min-width="180" show-overflow-tooltip>
                  <template #default="{ row }">{{ row.remark || '--' }}</template>
                </el-table-column>
                <el-table-column label="操作人" min-width="100">
                  <template #default="{ row }">{{ row.creatorName || '--' }}</template>
                </el-table-column>
                <el-table-column label="操作时间" min-width="160">
                  <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
          </el-tabs>
        </template>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>
