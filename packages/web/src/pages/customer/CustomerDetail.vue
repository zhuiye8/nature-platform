<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import { getCustomerDetail } from '@/api/customer'
import { getStatusLabel } from '@/utils/status-map'
import { formatTime } from '@/utils/format'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const customer = ref<any>(null)

async function fetchDetail() {
  const id = Number(route.params.id)
  if (!id) return
  loading.value = true
  try {
    customer.value = (await getCustomerDetail(id)) as any
  } finally {
    loading.value = false
  }
}


onMounted(fetchDetail)
</script>

<template>
  <div v-loading="loading">
    <!-- 页头 -->
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px">
      <el-button :icon="ArrowLeft" @click="router.back()">返回</el-button>
      <h2 style="margin: 0; font-size: 18px; color: #303133">客户详情</h2>
    </div>

    <template v-if="customer">
      <el-card shadow="never" style="margin-bottom: 16px">
        <template #header>
          <span style="font-weight: 600">基本信息</span>
        </template>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="客户名称" :span="2">{{ customer.fullName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="行业">{{ customer.industry || '--' }}</el-descriptions-item>
          <el-descriptions-item label="地区">{{ customer.region || '--' }}</el-descriptions-item>
          <el-descriptions-item label="详细地址" :span="2">{{ customer.addressDetail || '--' }}</el-descriptions-item>
          <el-descriptions-item label="统一信用代码">{{ customer.uscc || '--' }}</el-descriptions-item>
          <el-descriptions-item label="是否政府单位">
            <el-tag :type="customer.isGovernment ? 'warning' : 'info'" size="small">
              {{ customer.isGovernment ? '是' : '否' }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card shadow="never" style="margin-bottom: 16px">
        <template #header>
          <span style="font-weight: 600">联系信息</span>
        </template>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="联系人">{{ customer.contactName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="手机号">{{ customer.mobilePhone || '--' }}</el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card shadow="never">
        <template #header>
          <span style="font-weight: 600">其他信息</span>
        </template>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="备注" :span="2">{{ customer.remark || '--' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatTime(customer.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="更新时间">{{ formatTime(customer.updatedAt) }}</el-descriptions-item>
        </el-descriptions>
      </el-card>
    </template>
  </div>
</template>
