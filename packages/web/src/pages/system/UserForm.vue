<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getUserDetail, createUser, updateUser } from '@/api/user'
import type { UserForm as UserFormType } from '@/api/user'

const props = defineProps<{ visible: boolean; userId: number | null }>()
const emit = defineEmits<{ 'update:visible': [val: boolean]; saved: [] }>()

const formRef = ref()
const loading = ref(false)
const isEdit = ref(false)
const form = ref<UserFormType>({ username: '', displayName: '' })

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  displayName: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }, { min: 6, message: '密码至少6位', trigger: 'blur' }],
}

watch(() => props.visible, async (val) => {
  if (!val) return
  if (props.userId) {
    isEdit.value = true
    const data = await getUserDetail(props.userId)
    form.value = { username: data.username, displayName: data.displayName, mobile: data.mobile ?? undefined, email: data.email ?? undefined, deptId: data.deptId ?? undefined }
  } else {
    isEdit.value = false
    form.value = { username: '', password: '', displayName: '' }
  }
})

async function handleSubmit() {
  await formRef.value?.validate()
  loading.value = true
  try {
    if (isEdit.value && props.userId) {
      const { username, password, ...rest } = form.value
      await updateUser(props.userId, rest)
      ElMessage.success('更新成功')
    } else {
      await createUser(form.value)
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
    :title="isEdit ? '编辑用户' : '新建用户'"
    width="640px"
    :close-on-click-modal="false"
    class="n-form-dialog"
    @update:model-value="$emit('update:visible', $event)"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
      <h4 class="n-section-title">账号信息</h4>
      <div class="n-form-row">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" :disabled="isEdit" placeholder="登录用户名" />
        </el-form-item>
        <el-form-item v-if="!isEdit" label="密码" prop="password">
          <el-input v-model="form.password" type="password" show-password placeholder="至少6位" />
        </el-form-item>
      </div>

      <h4 class="n-section-title">个人信息</h4>
      <div class="n-form-row">
        <el-form-item label="姓名" prop="displayName">
          <el-input v-model="form.displayName" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="form.mobile" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="form.email" placeholder="请输入邮箱" />
        </el-form-item>
      </div>
    </el-form>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="loading" @click="handleSubmit">保存</el-button>
    </template>
  </el-dialog>
</template>
