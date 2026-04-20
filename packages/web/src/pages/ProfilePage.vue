<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { User, Lock, Link, Warning } from '@element-plus/icons-vue'
import request from '@/api/request'
import { getDingtalkAuthUrl, dingtalkUnbind } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import { getStatusLabel } from '@/utils/status-map'

const authStore = useAuthStore()
const router = useRouter()
const loading = ref(false)
const profile = ref<any>(null)

const mustChangePassword = computed(() => authStore.user?.mustChangePassword === true)
const isDingBound = computed(() => !!profile.value?.dingUnionId)

// 个人信息编辑
const editForm = ref({ username: '', displayName: '', mobile: '', email: '' })
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
      username: data.username || '',
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
  if (mustChangePassword.value && !editForm.value.mobile?.trim()) {
    ElMessage.warning('手机号为必填项')
    return
  }
  editSaving.value = true
  try {
    await request.put('/user/profile', editForm.value)
    ElMessage.success('个人信息已更新')
    fetchProfile()
    if (authStore.user) {
      authStore.user.displayName = editForm.value.displayName
    }
  } finally {
    editSaving.value = false
  }
}

async function handleChangePassword() {
  if (mustChangePassword.value && !editForm.value.mobile?.trim()) {
    ElMessage.warning('请先填写手机号')
    return
  }
  if (!pwdForm.value.oldPassword) {
    ElMessage.warning('请输入旧密码')
    return
  }
  if (!pwdForm.value.newPassword) {
    ElMessage.warning('请输入新密码')
    return
  }
  if (pwdForm.value.newPassword.length < 8) {
    ElMessage.warning('新密码长度不能少于8位')
    return
  }
  if (!/^(?=.*[A-Za-z])(?=.*\d).+$/.test(pwdForm.value.newPassword)) {
    ElMessage.warning('新密码必须同时包含英文字母和数字')
    return
  }
  if (pwdForm.value.newPassword !== pwdForm.value.confirmPassword) {
    ElMessage.warning('两次输入的新密码不一致')
    return
  }
  pwdSaving.value = true
  try {
    // 改密码时顺带保存个人信息（手机号等），避免用户忘记点保存
    if (mustChangePassword.value) {
      await request.put('/user/profile', editForm.value)
    }
    await request.put('/user/change-password', {
      oldPassword: pwdForm.value.oldPassword,
      newPassword: pwdForm.value.newPassword,
    })
    if (mustChangePassword.value) {
      ElMessage.success('密码修改成功，请重新登录')
      authStore.logout()
    } else {
      ElMessage.success('密码修改成功，下次登录请使用新密码')
      pwdForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
    }
  } finally {
    pwdSaving.value = false
  }
}

// 钉钉绑定
const dingtalkLoading = ref(false)
async function handleBindDingtalk() {
  dingtalkLoading.value = true
  try {
    const result = (await getDingtalkAuthUrl()) as any
    window.location.href = result.url
  } catch {
    ElMessage.error('获取钉钉授权链接失败')
    dingtalkLoading.value = false
  }
}

async function handleUnbindDingtalk() {
  try {
    await dingtalkUnbind()
    ElMessage.success('已解绑钉钉')
    fetchProfile()
    if (authStore.user) {
      authStore.user.dingUnionId = null
    }
  } catch {
    ElMessage.error('解绑失败')
  }
}

onMounted(fetchProfile)
</script>

<template>
  <div v-loading="loading" style="max-width: 800px; margin: 0 auto">
    <h2 style="margin: 0 0 20px; font-size: 18px; color: #303133">个人中心</h2>

    <!-- 强制修改密码提示 -->
    <el-alert
      v-if="mustChangePassword"
      title="首次登录，请先修改密码并完善个人信息后才能使用系统"
      type="warning"
      :icon="Warning"
      show-icon
      :closable="false"
      style="margin-bottom: 16px"
    />

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
          <el-input v-model="editForm.username" placeholder="字母、数字、下划线，3-32位" />
        </el-form-item>
        <el-form-item label="角色">
          <div style="display: flex; gap: 6px; flex-wrap: wrap">
            <el-tag v-for="(role, idx) in (profile?.roles || [])" :key="role" size="small" type="info">
              {{ profile?.roleNames?.[idx] || getStatusLabel(role) }}
            </el-tag>
            <el-tag v-if="!profile?.roles?.length" size="small" type="warning">未分配角色</el-tag>
          </div>
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="editForm.displayName" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="手机" :required="mustChangePassword">
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
    <el-card shadow="never" style="margin-bottom: 16px">
      <template #header>
        <div style="display: flex; align-items: center; gap: 8px">
          <el-icon><Lock /></el-icon>
          <span style="font-weight: 600">修改密码</span>
          <el-tag v-if="mustChangePassword" type="danger" size="small">必须修改</el-tag>
        </div>
      </template>

      <el-form label-width="100px">
        <el-form-item label="旧密码">
          <el-input v-model="pwdForm.oldPassword" type="password" show-password placeholder="请输入当前密码" />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="pwdForm.newPassword" type="password" show-password placeholder="请输入新密码（至少8位，必须含英文字母和数字）" />
        </el-form-item>
        <el-form-item label="确认新密码">
          <el-input v-model="pwdForm.confirmPassword" type="password" show-password placeholder="请再次输入新密码" />
        </el-form-item>
        <el-form-item>
          <el-button type="warning" :loading="pwdSaving" @click="handleChangePassword">修改密码</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 钉钉绑定 -->
    <el-card shadow="never">
      <template #header>
        <div style="display: flex; align-items: center; gap: 8px">
          <el-icon><Link /></el-icon>
          <span style="font-weight: 600">钉钉账号</span>
        </div>
      </template>

      <div style="display: flex; align-items: center; justify-content: space-between">
        <div>
          <span style="margin-right: 12px">绑定状态：</span>
          <el-tag v-if="isDingBound" type="success" size="small">已绑定</el-tag>
          <el-tag v-else type="info" size="small">未绑定</el-tag>
        </div>
        <el-button v-if="isDingBound" type="danger" plain size="small" @click="handleUnbindDingtalk">解绑钉钉</el-button>
        <el-button v-else type="primary" size="small" :loading="dingtalkLoading" @click="handleBindDingtalk">绑定钉钉</el-button>
      </div>
    </el-card>
  </div>
</template>
