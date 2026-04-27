<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getRecyclePage, restoreRecord, permanentDeleteRecord } from '@/api/recycle'
import type { RecycleItem } from '@/api/recycle'

const activeTab = ref('CONTRACT')
const tableData = ref<RecycleItem[]>([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)

async function fetchData() {
  loading.value = true
  try {
    const data = await getRecyclePage({ page: currentPage.value, pageSize: pageSize.value, bizType: activeTab.value }) as any
    tableData.value = data.list
    total.value = data.total
  } finally {
    loading.value = false
  }
}

async function handleRestore(row: RecycleItem) {
  try {
    await ElMessageBox.confirm('确定要恢复吗？', '确认', { type: 'warning' })
    await restoreRecord(row.id)
    ElMessage.success('恢复成功')
    fetchData()
  } catch { /* cancelled or handled */ }
}

async function handlePermanentDelete(row: RecycleItem) {
  try {
    await ElMessageBox.confirm('永久删除后不可恢复，确定吗？', '确认', { type: 'warning' })
    await permanentDeleteRecord(row.id)
    ElMessage.success('已永久删除')
    fetchData()
  } catch { /* cancelled or handled */ }
}

function handleTabChange() { currentPage.value = 1; fetchData() }

onMounted(() => fetchData())
</script>

<template>
  <div>
    <el-card shadow="never">
      <template #header>
        <span style="font-weight: 600; font-size: 16px">回收站</span>
      </template>

      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane label="合同" name="CONTRACT" />
        <el-tab-pane label="项目登记" name="PROJECT_REGISTER" />
      </el-tabs>

      <div style="text-align: right; color: #909399; font-size: 12px; margin-bottom: 6px">&larr; 可左右滑动查看更多信息 &rarr;</div>
      <el-table v-loading="loading" :data="tableData" stripe border style="width: 100%">
        <el-table-column prop="displayName" label="名称" min-width="300" show-overflow-tooltip />
        <el-table-column prop="deletedAt" label="删除时间" min-width="170" />
        <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button v-permission="'recycle:restore'" type="primary" link size="small" @click="handleRestore(row)">恢复</el-button>
            <el-button v-permission="'recycle:delete'" type="danger" link size="small" @click="handlePermanentDelete(row)">永久删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div style="display: flex; justify-content: flex-end; margin-top: 16px">
        <el-pagination v-model:current-page="currentPage" v-model:page-size="pageSize" :page-sizes="[10, 20, 50]" :total="total" layout="total, sizes, prev, pager, next" @size-change="() => { currentPage = 1; fetchData() }" @current-change="fetchData" />
      </div>
    </el-card>
  </div>
</template>
