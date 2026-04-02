<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import request from '@/api/request'
import { useAuthStore } from '@/stores/auth'
import { getStatusLabel } from '@/utils/status-map'

const authStore = useAuthStore()
const loading = ref(false)
const profile = ref<any>(null)

// 个人信息编辑
const editForm = ref({ displayName: '', mobile: '', email: '' })
const editSaving = ref(false)

// 修改密码
const pwdForm = ref({ oldPassword: '', newPassword: '', confirmPassword: '' })
const pwdSaving = ref(false)

async function fetchProfile() {
  loading.value = true
  try {
    const data = await request.get('/user/profile') as any
    profile.value = data
    editForm.value = {
      displayName: data.displayName || '',
      mobile: data.mobile || '',
      email: data.email || '',
    }
  } finally {
    loading.value = false
  }
}

async function handleSaveProfile() {
  if (!editForm.value.displayName.trim()) {
    ElMessage.warning('姓名不能为空')
    return
  }
  editSaving.value = true
  try {
    await request.put('/user/profile', editForm.value)
    ElMessage.success('个人信息已更新')
    fetchProfile()
    // 同步更新 authStore 的 displayName
    if (authStore.user) {
      authStore.user.displayName = editForm.value.displayName
    }
  } finally {
    editSaving.value = false
  }
}

async function handleChangePassword() {
  if (!pwdForm.value.oldPassword) {
    ElMessage.warning('请输入旧密码')
    return
  }
  if (!pwdForm.value.newPassword) {
    ElMessage.warning('请输入新密码')
    return
  }
  if (pwdForm.value.newPassword.length < 6) {
    ElMessage.warning('新密码长度不能少于6位')
    return
  }
  if (pwdForm.value.newPassword !== pwdForm.value.confirmPassword) {
    ElMessage.warning('两次输入的新密码不一致')
    return
  }
  pwdSaving.value = true
  try {
    await request.put('/user/change-password', {
      oldPassword: pwdForm.value.oldPassword,
      newPassword: pwdForm.value.newPassword,
    })
    ElMessage.success('密码修改成功，下次登录请使用新密码')
    pwdForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
  } finally {
    pwdSaving.value = false
  }
}

onMounted(fetchProfile)
</script>

<template>
  <div v-loading="loading" style="max-width: 800px; margin: 0 auto">
    <h2 style="margin: 0 0 20px; font-size: 18px; color: #303133">个人中心</h2>

    <!-- 个人信息 -->
    <el-card shadow="never" style="margin-bottom: 16px">
      <template #header>
        <div style="display: flex; align-items: center; gap: 8px">
          <el-icon><User /></el-icon>
          <span style="font-weight: 600">个人信息</span>
        </div>
      </template>

      <el-form label-width="80px">
        <el-form-item label="用户名">
          <el-input :model-value="profile?.username" disabled />
        </el-form-item>
        <el-form-item label="角色">
          <div style="display: flex; gap: 6px; flex-wrap: wrap">
            <el-tag v-for="role in (profile?.roles || [])" :key="role" size="small" type="info">
              {{ getStatusLabel(role) }}
            </el-tag>
          </div>
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="editForm.displayName" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="手机">
          <el-input v-model="editForm.mobile" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="editForm.email" placeholder="请输入邮箱" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="editSaving" @click="handleSaveProfile">保存</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 修改密码 -->
    <el-card shadow="never">
      <template #header>
        <div style="display: flex; align-items: center; gap: 8px">
          <el-icon><Lock /></el-icon>
          <span style="font-weight: 600">修改密码</span>
        </div>
      </template>

      <el-form label-width="100px">
        <el-form-item label="旧密码">
          <el-input v-model="pwdForm.oldPassword" type="password" show-password placeholder="请输入当前密码" />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="pwdForm.newPassword" type="password" show-password placeholder="请输入新密码（至少6位）" />
        </el-form-item>
        <el-form-item label="确认新密码">
          <el-input v-model="pwdForm.confirmPassword" type="password" show-password placeholder="请再次输入新密码" />
        </el-form-item>
        <el-form-item>
          <el-button type="warning" :loading="pwdSaving" @click="handleChangePassword">修改密码</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>
