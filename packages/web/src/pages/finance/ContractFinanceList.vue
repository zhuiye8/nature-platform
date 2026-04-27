<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Search, Refresh } from '@element-plus/icons-vue'
import { getContractGroupPage } from '@/api/contract'
import type { ContractGroupItem } from '@/api/contract'
import { getStatusLabel, getStatusTagType } from '@/utils/status-map'
import { formatTime } from '@/utils/format'
import { SERVICE_CONTENT_OPTIONS, SERVICE_CONTENT_TAG_TYPE } from '@/utils/enums'

const router = useRouter()
const tableData = ref<ContractGroupItem[]>([])
const loading = ref(false)
const keyword = ref('')
const paymentStatusFilter = ref('')
const serviceContentFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

const paymentStatusOptions = [
  { label: '未回款', value: 'UNPAID' },
  { label: '部分回款', value: 'PARTIAL' },
  { label: '已回款', value: 'PAID' },
]

async function fetchData() {
  loading.value = true
  try {
    const data = (await getContractGroupPage({
      page: currentPage.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined,
      reviewStatus: 'APPROVED',
      paymentStatus: paymentStatusFilter.value || undefined,
      serviceContent: serviceContentFilter.value || undefined,
    } as any)) as any
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
  paymentStatusFilter.value = ''
  serviceContentFilter.value = ''
  currentPage.value = 1
  fetchData()
}

function formatAmount(val: any) {
  if (val == null) return '--'
  return `\u00a5 ${Number(val).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`
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
        <span style="font-weight: 600; font-size: 16px">合同财务</span>
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
        <el-select v-model="paymentStatusFilter" placeholder="回款状态" clearable style="width: 140px" @change="handleSearch">
          <el-option v-for="opt in paymentStatusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
        <el-select v-model="serviceContentFilter" placeholder="服务内容" clearable style="width: 140px" @change="handleSearch">
          <el-option v-for="sc in SERVICE_CONTENT_OPTIONS" :key="sc" :label="sc" :value="sc" />
        </el-select>
        <el-button :icon="Search" type="primary" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="handleReset">重置</el-button>
      </div>

      <!-- 合同组父子表格 -->
      <el-table v-loading="loading" :data="tableData" stripe border style="width: 100%" row-key="id">
        <el-table-column type="expand">
          <template #default="{ row: group }">
            <div style="padding: 12px 24px">
              <el-table v-if="group.contracts.length > 0" :data="group.contracts" border size="small" style="width: 100%">
                <el-table-column prop="contractNo" label="合同编号" min-width="180" show-overflow-tooltip />
                <el-table-column label="合同名称" min-width="200" show-overflow-tooltip>
                  <template #default="{ row }">
                    <el-link type="primary" underline="never" @click="router.push(`/contract/${row.id}`)">{{ row.contractName || '--' }}</el-link>
                  </template>
                </el-table-column>
                <el-table-column label="合同分类" min-width="100" align="center">
                  <template #default="{ row }">
                    <el-tag v-if="row.contractCategory" size="small">{{ row.contractCategory }}</el-tag>
                    <span v-else>--</span>
                  </template>
                </el-table-column>
                <el-table-column label="合同金额" min-width="130" align="right">
                  <template #default="{ row }">{{ formatAmount(row.paymentAmount) }}</template>
                </el-table-column>
                <el-table-column label="服务内容" min-width="120" align="center">
                  <template #default="{ row }">
                    <el-tag v-if="row.serviceContent" :type="SERVICE_CONTENT_TAG_TYPE[row.serviceContent] || 'info'" size="small">
                      {{ row.serviceContent }}
                    </el-tag>
                    <span v-else>--</span>
                  </template>
                </el-table-column>
                <el-table-column label="付款方式" min-width="100">
                  <template #default="{ row }">{{ row.paymentMethod || '--' }}</template>
                </el-table-column>
                <el-table-column label="回款状态" min-width="100" align="center">
                  <template #default="{ row }">
                    <el-tag :type="getStatusTagType(row.paymentStatus)" size="small">
                      {{ getStatusLabel(row.paymentStatus) || row.paymentStatus }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="签单销售" min-width="100">
                  <template #default="{ row }">{{ row.salesPersonName || '--' }}</template>
                </el-table-column>
                <el-table-column label="财务" min-width="100">
                  <template #default="{ row }">{{ row.financialHandlerName || '--' }}</template>
                </el-table-column>
                <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
                <el-table-column label="操作" width="120" fixed="right">
                  <template #default="{ row }">
                    <el-button type="primary" link size="small" @click="router.push(`/finance/contract/${row.id}`)">详情</el-button>
                  </template>
                </el-table-column>
              </el-table>
              <div v-else style="color: #909399; text-align: center; padding: 16px 0">暂无合同</div>
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
  </div>
</template>
