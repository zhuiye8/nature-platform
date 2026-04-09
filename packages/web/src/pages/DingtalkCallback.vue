<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { dingtalkLogin, dingtalkBind, dingtalkCreate } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const loading = ref(true)
const status = ref<'loading' | 'select' | 'create' | 'error'>('loading')
const errorMsg = ref('')

// 多人同名选择
const candidates = ref<{ id: number; displayName: string; mobileLast4: string }[]>([])
const dingtalkInfo = ref<any>(null)
const selectedUserId = ref<number | null>(null)
const bindPassword = ref('')
const bindLoading = ref(false)

// 新建用户确认
const createLoading = ref(false)

async function handleLogin() {
  const authCode = (route.query.authCode as string) || ''
  if (!authCode) {
    status.value = 'error'
    errorMsg.value = '缺少授权码'
    loading.value = false
    return
  }

  try {
    const result = (await dingtalkLogin(authCode)) as any

    if (result.status === 'OK') {
      // 直接登录成功
      handleLoginSuccess(result)
    } else if (result.status === 'NEED_SELECT') {
      // 多人同名，需要选择
      status.value = 'select'
      candidates.value = result.candidates
      dingtalkInfo.value = result.dingtalkInfo
      loading.value = false
    } else if (result.status === 'NEED_CREATE') {
      // 没有匹配用户，需要创建
      status.value = 'create'
      dingtalkInfo.value = result.dingtalkInfo
      loading.value = false
    }
  } catch (e: any) {
    status.value = 'error'
    errorMsg.value = e?.message || '钉钉登录失败'
    loading.value = false
  }
}

async function handleBindConfirm() {
  if (!selectedUserId.value) {
    ElMessage.warning('请选择要绑定的账号')
    return
  }
  if (!bindPassword.value) {
    ElMessage.warning('请输入密码验证身份')
    return
  }

  bindLoading.value = true
  try {
    const result = (await dingtalkBind(selectedUserId.value, bindPassword.value, dingtalkInfo.value)) as any
    handleLoginSuccess(result)
  } catch (e: any) {
    ElMessage.error(e?.message || '绑定失败')
  } finally {
    bindLoading.value = false
  }
}

async function handleCreateConfirm() {
  createLoading.value = true
  try {
    const result = (await dingtalkCreate(dingtalkInfo.value)) as any
    if (result?.accessToken) {
      handleLoginSuccess(result)
    } else {
      ElMessage.error('创建用户返回数据异常')
      status.value = 'error'
      errorMsg.value = '创建成功但未返回登录凭证'
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '创建用户失败')
  } finally {
    createLoading.value = false
  }
}

function handleLoginSuccess(result: any) {
  authStore.token = result.accessToken
  authStore.user = result.user
  localStorage.setItem('token', result.accessToken)

  if (result.user?.mustChangePassword) {
    ElMessage.warning('首次登录，请修改密码')
    window.location.href = '/profile'
  } else {
    window.location.href = '/dashboard'
  }
}

function goLogin() {
  router.replace('/login')
}

onMounted(handleLogin)
</script>

<template>
  <div style="display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f0f2f5">
    <el-card style="width: 460px; text-align: center" shadow="hover">
      <!-- 加载中 -->
      <template v-if="status === 'loading'">
        <div style="padding: 40px 0">
          <el-icon style="font-size: 48px; color: var(--el-color-primary); animation: spin 1s linear infinite"><Loading /></el-icon>
          <p style="margin-top: 16px; color: #606266">正在处理钉钉登录...</p>
        </div>
      </template>

      <!-- 多人同名选择 -->
      <template v-if="status === 'select'">
        <h3 style="margin-bottom: 16px">选择要绑定的账号</h3>
        <p style="color: #909399; margin-bottom: 16px; font-size: 13px">
          系统中存在多个同名用户「{{ dingtalkInfo?.nick }}」，请选择您的账号并输入密码验证
        </p>
        <el-radio-group v-model="selectedUserId" style="display: flex; flex-direction: column; gap: 8px; text-align: left; margin-bottom: 16px">
          <el-radio v-for="c in candidates" :key="c.id" :value="c.id" style="height: auto; padding: 8px 0">
            {{ c.displayName }}
            <span v-if="c.mobileLast4" style="color: #909399; margin-left: 8px">（手机尾号 {{ c.mobileLast4 }}）</span>
          </el-radio>
        </el-radio-group>
        <el-input v-model="bindPassword" type="password" show-password placeholder="请输入该账号的密码" style="margin-bottom: 16px" />
        <div style="display: flex; gap: 8px; justify-content: center">
          <el-button @click="goLogin">取消</el-button>
          <el-button type="primary" :loading="bindLoading" @click="handleBindConfirm">确认绑定</el-button>
        </div>
      </template>

      <!-- 新建用户确认 -->
      <template v-if="status === 'create'">
        <h3 style="margin-bottom: 16px">创建新账号</h3>
        <p style="color: #909399; margin-bottom: 16px; font-size: 13px">
          系统中未找到与「{{ dingtalkInfo?.nick }}」匹配的账号，是否自动创建新账号？
        </p>
        <el-descriptions :column="1" border size="small" style="text-align: left; margin-bottom: 16px">
          <el-descriptions-item label="姓名">{{ dingtalkInfo?.nick }}</el-descriptions-item>
          <el-descriptions-item label="手机号">{{ dingtalkInfo?.mobile || '未获取' }}</el-descriptions-item>
        </el-descriptions>
        <p style="color: #e6a23c; font-size: 12px; margin-bottom: 16px">
          创建后初始密码为 123456，首次登录需修改密码，管理员将为您分配权限
        </p>
        <div style="display: flex; gap: 8px; justify-content: center">
          <el-button @click="goLogin">取消</el-button>
          <el-button type="primary" :loading="createLoading" @click="handleCreateConfirm">确认创建</el-button>
        </div>
      </template>

      <!-- 错误 -->
      <template v-if="status === 'error'">
        <div style="padding: 40px 0">
          <el-icon style="font-size: 48px; color: #f56c6c"><CircleCloseFilled /></el-icon>
          <p style="margin-top: 16px; color: #303133; font-weight: 500">登录失败</p>
          <p style="color: #909399; margin-top: 8px">{{ errorMsg }}</p>
          <el-button type="primary" style="margin-top: 20px" @click="goLogin">返回登录</el-button>
        </div>
      </template>
    </el-card>
  </div>
</template>

<script lang="ts">
import { Loading, CircleCloseFilled } from '@element-plus/icons-vue'
export default { components: { Loading, CircleCloseFilled } }
</script>
