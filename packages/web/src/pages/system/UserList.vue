<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus, View, Hide } from '@element-plus/icons-vue'
import { getUserPage, toggleUserEnabled, resetUserPassword, assignUserRoles } from '@/api/user'
import { getRoleList } from '@/api/role'
import { maskCertificateNo } from '@/utils/format'
import type { UserItem } from '@/api/user'
import type { RoleItem } from '@/api/role'
import UserForm from './UserForm.vue'

const tableData = ref<UserItem[]>([])
const loading = ref(false)
const keyword = ref('')
const roleCode = ref('')   // 角色筛选
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const formVisible = ref(false)
const editUserId = ref<number | null>(null)

// 证书编号显隐（单元格级别，点击切换）
const revealedCerts = ref<Set<number>>(new Set())
function toggleCertVisibility(userId: number) {
  if (revealedCerts.value.has(userId)) revealedCerts.value.delete(userId)
  else revealedCerts.value.add(userId)
  // Trigger reactivity
  revealedCerts.value = new Set(revealedCerts.value)
}

// Role assignment dialog
const roleDialogVisible = ref(false)
const roleTargetUserId = ref(0)
const selectedRoles = ref<string[]>([])
const allRoles = ref<RoleItem[]>([])

// 角色 code → 中文名 映射（用于显示）
const roleLabelMap = ref<Record<string, string>>({})

async function fetchData() {
  loading.value = true
  try {
    const data = await getUserPage({
      page: currentPage.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined,
      roleCode: roleCode.value || undefined,
    }) as any
    tableData.value = data.list
    total.value = data.total
  } finally {
    loading.value = false
  }
}

async function loadRoleLabels() {
  if (Object.keys(roleLabelMap.value).length > 0) return
  const roles = await getRoleList()
  const map: Record<string, string> = {}
  for (const r of roles) map[r.roleCode] = r.roleName
  roleLabelMap.value = map
  allRoles.value = roles
}

function handleSearch() { currentPage.value = 1; fetchData() }
function handleReset() { keyword.value = ''; roleCode.value = ''; currentPage.value = 1; fetchData() }
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
    await ElMessageBox.confirm(
      `确定要重置 ${row.displayName} 的密码吗？重置后用户首次登录时必须修改密码。`,
      '重置密码',
      { type: 'warning' },
    )
    const res = (await resetUserPassword(row.id)) as any
    const tempPwd = res?.tempPassword || 'Nature@2026'
    await ElMessageBox.alert(
      `临时密码：<strong style="color:#f56c6c;font-size:16px">${tempPwd}</strong><br/><br/>请将此临时密码告知 <strong>${row.displayName}</strong>，用户首次登录后将被强制修改密码。`,
      '重置成功',
      { dangerouslyUseHTMLString: true, confirmButtonText: '我已记录' },
    )
  } catch { /* cancelled or error */ }
}

async function openRoleDialog(row: UserItem) {
  roleTargetUserId.value = row.id
  await loadRoleLabels()
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

onMounted(() => {
  fetchData()
  loadRoleLabels()
})
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

      <div style="margin-bottom: 16px; display: flex; gap: 12px; flex-wrap: wrap">
        <el-input v-model="keyword" placeholder="搜索用户名/姓名/手机号" clearable style="width: 260px" :prefix-icon="Search" @keyup.enter="handleSearch" />
        <el-select v-model="roleCode" placeholder="按角色筛选" clearable filterable style="width: 200px" @change="handleSearch">
          <el-option v-for="role in allRoles" :key="role.roleCode" :label="role.roleName" :value="role.roleCode" />
        </el-select>
        <el-button :icon="Search" type="primary" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="handleReset">重置</el-button>
      </div>

      <div style="text-align: right; color: #909399; font-size: 12px; margin-bottom: 6px">&larr; 可左右滑动查看更多信息 &rarr;</div>
      <el-table v-loading="loading" :data="tableData" stripe border style="width: 100%">
        <el-table-column prop="username" label="用户名" min-width="120" />
        <el-table-column prop="displayName" label="姓名" min-width="100" />
        <el-table-column prop="mobile" label="手机号" min-width="130" />
        <el-table-column label="状态" min-width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'danger'" size="small">{{ row.enabled ? '启用' : '禁用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="证书编号" min-width="200">
          <template #default="{ row }">
            <template v-if="row.certificateNo">
              <span style="font-family: 'SF Mono', Consolas, monospace; white-space: normal; word-break: break-all">
                {{ revealedCerts.has(row.id) ? row.certificateNo : maskCertificateNo(row.certificateNo) }}
              </span>
              <el-button
                link
                size="small"
                :icon="revealedCerts.has(row.id) ? Hide : View"
                @click="toggleCertVisibility(row.id)"
                style="margin-left: 4px; padding: 0"
                :title="revealedCerts.has(row.id) ? '隐藏' : '显示完整'"
              />
            </template>
            <span v-else style="color: #c0c4cc">--</span>
          </template>
        </el-table-column>
        <el-table-column label="角色" min-width="180">
          <template #default="{ row }">
            <div style="display: flex; flex-wrap: wrap; gap: 4px">
              <el-tag
                v-for="code in (row.roles || [])"
                :key="code"
                size="small"
                :type="code === 'super_admin' ? 'danger' : 'info'"
              >
                {{ roleLabelMap[code] || code }}
              </el-tag>
              <span v-if="!(row.roles && row.roles.length)" style="color: #c0c4cc">无</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="钉钉绑定" min-width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.dingUnionId ? 'success' : 'info'" size="small">{{ row.dingUnionId ? '已绑定' : '未绑定' }}</el-tag>
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
          {{ role.roleName }}
          <el-tag v-if="role.systemFlag" size="small" type="warning" style="margin-left: 8px">系统</el-tag>
        </el-checkbox>
      </el-checkbox-group>
      <template #footer>
        <el-button @click="roleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleAssignRoles">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>
