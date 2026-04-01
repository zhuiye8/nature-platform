<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus } from '@element-plus/icons-vue'
import { getStatusLabel, getStatusTagType } from '@/utils/status-map'
import { getUserPage, toggleUserEnabled, resetUserPassword, assignUserRoles } from '@/api/user'
import { getRoleList } from '@/api/role'
import type { UserItem } from '@/api/user'
import type { RoleItem } from '@/api/role'
import UserForm from './UserForm.vue'

const tableData = ref<UserItem[]>([])
const loading = ref(false)
const keyword = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const formVisible = ref(false)
const editUserId = ref<number | null>(null)

// Role assignment dialog
const roleDialogVisible = ref(false)
const roleTargetUserId = ref(0)
const selectedRoles = ref<string[]>([])
const allRoles = ref<RoleItem[]>([])

async function fetchData() {
  loading.value = true
  try {
    const data = await getUserPage({ page: currentPage.value, pageSize: pageSize.value, keyword: keyword.value || undefined }) as any
    tableData.value = data.list
    total.value = data.total
  } finally {
    loading.value = false
  }
}

function handleSearch() { currentPage.value = 1; fetchData() }
function handleReset() { keyword.value = ''; currentPage.value = 1; fetchData() }
function handleCreate() { editUserId.value = null; formVisible.value = true }
function handleEdit(row: UserItem) { editUserId.value = row.id; formVisible.value = true }

async function handleToggleEnabled(row: UserItem) {
  try {
    await toggleUserEnabled(row.id)
    ElMessage.success(row.enabled ? '已禁用' : '已启用')
    fetchData()
  } catch { /* handled */ }
}

async function handleResetPassword(row: UserItem) {
  try {
    await ElMessageBox.confirm(`确定要重置 ${row.displayName} 的密码为 123456 吗？`, '重置密码')
    await resetUserPassword(row.id, '123456')
    ElMessage.success('密码已重置为 123456')
  } catch { /* cancelled or error */ }
}

async function openRoleDialog(row: UserItem) {
  roleTargetUserId.value = row.id
  if (allRoles.value.length === 0) {
    allRoles.value = await getRoleList()
  }
  // Load current roles
  const { getUserDetail } = await import('@/api/user')
  const detail = await getUserDetail(row.id)
  selectedRoles.value = detail.roles
  roleDialogVisible.value = true
}

async function handleAssignRoles() {
  try {
    await assignUserRoles(roleTargetUserId.value, selectedRoles.value)
    ElMessage.success('角色分配成功')
    roleDialogVisible.value = false
  } catch { /* handled */ }
}

onMounted(() => fetchData())
</script>

<template>
  <div>
    <el-card shadow="never">
      <template #header>
        <div style="display: flex; align-items: center; justify-content: space-between">
          <span style="font-weight: 600; font-size: 16px">用户管理</span>
          <el-button v-permission="'user:create'" type="primary" :icon="Plus" @click="handleCreate">新建用户</el-button>
        </div>
      </template>

      <div style="margin-bottom: 16px; display: flex; gap: 12px">
        <el-input v-model="keyword" placeholder="搜索用户名/姓名/手机号" clearable style="width: 300px" :prefix-icon="Search" @keyup.enter="handleSearch" />
        <el-button :icon="Search" type="primary" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="handleReset">重置</el-button>
      </div>

      <el-table v-loading="loading" :data="tableData" stripe border style="width: 100%">
        <el-table-column prop="username" label="用户名" min-width="120" />
        <el-table-column prop="displayName" label="姓名" min-width="100" />
        <el-table-column prop="mobile" label="手机号" min-width="130" />
        <el-table-column label="状态" min-width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'danger'" size="small">{{ row.enabled ? '启用' : '禁用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="来源" min-width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.sourceType)" size="small">{{ getStatusLabel(row.sourceType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" min-width="170" />
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button v-permission="'user:update'" type="primary" link size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button v-permission="'user:update'" link size="small" @click="openRoleDialog(row)">角色</el-button>
            <el-button v-permission="'user:update'" :type="row.enabled ? 'warning' : 'success'" link size="small" @click="handleToggleEnabled(row)">
              {{ row.enabled ? '禁用' : '启用' }}
            </el-button>
            <el-button v-permission="'user:update'" link size="small" @click="handleResetPassword(row)">重置密码</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div style="display: flex; justify-content: flex-end; margin-top: 16px">
        <el-pagination v-model:current-page="currentPage" v-model:page-size="pageSize" :page-sizes="[10, 20, 50]" :total="total" layout="total, sizes, prev, pager, next" @size-change="() => { currentPage = 1; fetchData() }" @current-change="fetchData" />
      </div>
    </el-card>

    <UserForm v-model:visible="formVisible" :user-id="editUserId" @saved="fetchData" />

    <!-- Role Assignment Dialog -->
    <el-dialog v-model="roleDialogVisible" title="分配角色" width="500px">
      <el-checkbox-group v-model="selectedRoles">
        <el-checkbox v-for="role in allRoles" :key="role.roleCode" :label="role.roleCode" :value="role.roleCode" style="display: block; margin-bottom: 8px">
          {{ role.roleName }} <el-tag v-if="role.systemFlag" size="small" type="warning" style="margin-left: 8px">系统</el-tag>
        </el-checkbox>
      </el-checkbox-group>
      <template #footer>
        <el-button @click="roleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleAssignRoles">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>
