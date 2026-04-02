<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getArchivePage } from '@/api/archive'
import { formatTime } from '@/utils/format'

const router = useRouter()
const tableData = ref<any[]>([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const archiveStatusFilter = ref('')

async function fetchData() {
  loading.value = true
  try {
    const data = (await getArchivePage({ page: currentPage.value, pageSize: pageSize.value, archiveStatus: archiveStatusFilter.value || undefined })) as any
    tableData.value = data.list
    total.value = data.total
  } finally {
    loading.value = false
  }
}

function handleView(row: any) {
  router.push(`/archive/${row.id}`)
}

watch([currentPage, pageSize], fetchData)
onMounted(fetchData)
</script>

<template>
  <div class="n-page-container">
    <div class="n-page-header">
      <h2 class="n-page-title">材料归档</h2>
    </div>

    <el-card shadow="never">
      <div style="margin-bottom: 16px; display: flex; gap: 12px">
        <el-select v-model="archiveStatusFilter" placeholder="归档状态" clearable style="width: 160px" @change="() => { currentPage = 1; fetchData() }">
          <el-option label="待归档" value="待归档" />
          <el-option label="未完全归档" value="未完全归档" />
          <el-option label="已归档" value="已归档" />
        </el-select>
      </div>

      <div style="text-align: right; color: #909399; font-size: 12px; margin-bottom: 6px">&larr; 可左右滑动查看更多信息 &rarr;</div>
      <el-table v-loading="loading" :data="tableData" stripe border style="width: 100%">
        <el-table-column label="项目名称" min-width="250">
          <template #default="{ row }">
            <span style="white-space: normal; word-break: break-all; line-height: 1.5">{{ row.applicationName }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="projectManagerName" label="项目经理" width="120">
          <template #default="{ row }">{{ row.projectManagerName || '-' }}</template>
        </el-table-column>
        <el-table-column prop="salesName" label="所属销售" width="100">
          <template #default="{ row }">{{ row.salesName || '-' }}</template>
        </el-table-column>
        <el-table-column prop="compilerName" label="编制人" width="100">
          <template #default="{ row }">{{ row.compilerName || '-' }}</template>
        </el-table-column>
        <el-table-column prop="archiverName" label="归档人" width="100">
          <template #default="{ row }">{{ row.archiverName || '-' }}</template>
        </el-table-column>
        <el-table-column label="合同年度" width="100" align="center">
          <template #default="{ row }">{{ row.contractYear }}年</template>
        </el-table-column>
        <el-table-column label="归档进度" width="140" align="center">
          <template #default="{ row }">
            <el-tooltip
              v-if="row.missingMaterials?.length > 0"
              placement="top"
            >
              <template #content>
                <div style="font-weight: 600; margin-bottom: 4px">缺少材料（{{ row.missingMaterials.length }} 项）：</div>
                <div v-for="m in row.missingMaterials" :key="m" style="font-size: 12px">· {{ m }}</div>
              </template>
              <span style="cursor: pointer">
                <el-tag :type="row.checkedCount > 0 ? 'warning' : 'info'" size="small">
                  {{ row.checkedCount }}/{{ row.totalMaterials }}
                </el-tag>
              </span>
            </el-tooltip>
            <el-tag v-else type="success" size="small">{{ row.checkedCount }}/{{ row.totalMaterials }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="归档状态" width="120" align="center">
          <template #default="{ row }">
            <el-tag
              :type="row.archiveStatus === '已归档' ? 'success' : row.archiveStatus === '未完全归档' ? 'warning' : 'info'"
              size="small"
            >
              {{ row.archiveStatus }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="归档时间" width="170">
          <template #default="{ row }">{{ formatTime(row.submittedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="80" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleView(row)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="total > pageSize" style="display: flex; justify-content: flex-end; margin-top: 16px">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @size-change="() => { currentPage = 1; fetchData() }"
          @current-change="fetchData"
        />
      </div>

      <el-empty v-if="!loading && tableData.length === 0" description="暂无归档数据" />
    </el-card>
  </div>
</template>
