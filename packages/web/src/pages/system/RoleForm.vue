<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getRoleDetail, createRole, updateRole } from '@/api/role'
import type { RoleForm as RoleFormType } from '@/api/role'

const props = defineProps<{ visible: boolean; roleId: number | null }>()
const emit = defineEmits<{ 'update:visible': [val: boolean]; saved: [] }>()

const formRef = ref()
const loading = ref(false)
const isEdit = ref(false)
const form = ref<RoleFormType>({ roleCode: '', roleName: '' })

const rules = {
  roleCode: [{ required: true, message: '请输入角色编码', trigger: 'blur' }],
  roleName: [{ required: true, message: '请输入角色名称', trigger: 'blur' }],
}

watch(() => props.visible, async (val) => {
  if (!val) return
  if (props.roleId) {
    isEdit.value = true
    const data = await getRoleDetail(props.roleId)
    form.value = { roleCode: data.roleCode, roleName: data.roleName, description: data.description ?? undefined }
  } else {
    isEdit.value = false
    form.value = { roleCode: '', roleName: '' }
  }
})

async function handleSubmit() {
  await formRef.value?.validate()
  loading.value = true
  try {
    if (isEdit.value && props.roleId) {
      const { roleCode, ...rest } = form.value
      await updateRole(props.roleId, rest)
      ElMessage.success('更新成功')
    } else {
      await createRole(form.value)
      ElMessage.success('创建成功')
    }
    emit('update:visible', false)
    emit('saved')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    :title="isEdit ? '编辑角色' : '新建角色'"
    width="640px"
    :close-on-click-modal="false"
    class="n-form-dialog"
    @update:model-value="$emit('update:visible', $event)"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
      <el-form-item label="角色编码" prop="roleCode">
        <el-input v-model="form.roleCode" :disabled="isEdit" placeholder="如 content_reviewer" />
      </el-form-item>
      <el-form-item label="角色名称" prop="roleName">
        <el-input v-model="form.roleName" placeholder="如 内容审核人" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="form.description" type="textarea" :rows="3" placeholder="角色功能描述" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="loading" @click="handleSubmit">保存</el-button>
    </template>
  </el-dialog>
</template>
