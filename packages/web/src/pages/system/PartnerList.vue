<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { getPartnerList, createPartner, updatePartner, deletePartner } from '@/api/partner'
import type { PartnerItem, PartnerForm } from '@/api/partner'

const loading = ref(false)
const list = ref<PartnerItem[]>([])

async function fetchList() {
  loading.value = true
  try {
    list.value = (await getPartnerList()) as any
  } finally {
    loading.value = false
  }
}

// ── Dialog ──
const dialogVisible = ref(false)
const dialogTitle = ref('新增合作方')
const editingId = ref<number | null>(null)
const formRef = ref()
const formLoading = ref(false)
const form = ref<PartnerForm>({ name: '' })

const rules = {
  name: [{ required: true, message: '请输入合作方名称', trigger: 'blur' }],
}

function handleAdd() {
  editingId.value = null
  dialogTitle.value = '新增合作方'
  form.value = { name: '' }
  dialogVisible.value = true
}

function handleEdit(row: PartnerItem) {
  editingId.value = row.id
  dialogTitle.value = '编辑合作方'
  form.value = {
    name: row.name,
    contactName: row.contactName ?? '',
    contactPhone: row.contactPhone ?? '',
    remark: row.remark ?? '',
  }
  dialogVisible.value = true
}

async function handleSubmit() {
  await formRef.value?.validate()
  formLoading.value = true
  try {
    if (editingId.value) {
      await updatePartner(editingId.value, form.value)
      ElMessage.success('更新成功')
    } else {
      await createPartner(form.value)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    fetchList()
  } finally {
    formLoading.value = false
  }
}

async function handleDelete(row: PartnerItem) {
  await ElMessageBox.confirm(`确定要删除合作方「${row.name}」吗？`, '提示', { type: 'warning' })
  await deletePartner(row.id)
  ElMessage.success('删除成功')
  fetchList()
}

onMounted(fetchList)
</script>

<template>
  <div>
    <el-card shadow="never">
      <template #header>
        <div style="display: flex; align-items: center; justify-content: space-between">
          <span style="font-weight: 600; font-size: 16px">合作方管理</span>
          <el-button type="primary" :icon="Plus" @click="handleAdd">新增合作方</el-button>
        </div>
      </template>

      <el-table :data="list" v-loading="loading" stripe border style="width: 100%">
        <el-table-column prop="name" label="合作方名称" min-width="200" show-overflow-tooltip />
        <el-table-column prop="contactName" label="联系人" width="120" />
        <el-table-column prop="contactPhone" label="联系电话" width="140" />
        <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
        <el-table-column label="操作" width="140" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Dialog -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px" :close-on-click-modal="false">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入合作方名称" />
        </el-form-item>
        <el-form-item label="联系人">
          <el-input v-model="form.contactName" placeholder="联系人姓名" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="form.contactPhone" placeholder="联系电话" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="formLoading" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
