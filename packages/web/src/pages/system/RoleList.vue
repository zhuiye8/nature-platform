<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Top, Bottom, Delete } from '@element-plus/icons-vue'
import { getRoleList, getRoleDetail, deleteRole, assignRolePermissions, getAllPermissions, getRoleUsers, updateRoleUsers } from '@/api/role'
import type { RoleItem, PermissionItem, RoleMember } from '@/api/role'
import { getCategoryLabel } from '@/utils/status-map'
import { getSimpleUserList } from '@/api/user'
import RoleForm from './RoleForm.vue'

const tableData = ref<RoleItem[]>([])
const loading = ref(false)
const formVisible = ref(false)
const editRoleId = ref<number | null>(null)

// Permission assignment dialog
const permDialogVisible = ref(false)
const permTargetRoleCode = ref('')
const permTargetRoleName = ref('')
const checkedPerms = ref<string[]>([])
const permGroups = ref<Record<string, PermissionItem[]>>({})

// Member management dialog
const memberDialogVisible = ref(false)
const memberTargetRoleCode = ref('')
const memberTargetRoleName = ref('')
const memberList = ref<RoleMember[]>([])
const memberLoading = ref(false)
const memberSaving = ref(false)
const allUsers = ref<{ id: number; displayName: string; username: string }[]>([])
const addUserId = ref<number | undefined>(undefined)

async function fetchData() {
  loading.value = true
  try {
    tableData.value = await getRoleList()
  } finally {
    loading.value = false
  }
}

function handleCreate() { editRoleId.value = null; formVisible.value = true }
function handleEdit(row: RoleItem) { editRoleId.value = row.id; formVisible.value = true }

async function handleDelete(row: RoleItem) {
  try {
    await ElMessageBox.confirm('确定要删除该角色吗？', '确认', { type: 'warning' })
    await deleteRole(row.id)
    ElMessage.success('删除成功')
    fetchData()
  } catch { /* cancelled or handled */ }
}

// Permission dialog
async function openPermDialog(row: RoleItem) {
  permTargetRoleCode.value = row.roleCode
  permTargetRoleName.value = row.roleName
  if (Object.keys(permGroups.value).length === 0) {
    permGroups.value = await getAllPermissions()
  }
  const detail = await getRoleDetail(row.id)
  checkedPerms.value = detail.permissionCodes
  permDialogVisible.value = true
}

async function handleAssignPerms() {
  try {
    await assignRolePermissions(permTargetRoleCode.value, checkedPerms.value)
    ElMessage.success('权限分配成功')
    permDialogVisible.value = false
  } catch { /* handled */ }
}

// Member dialog
async function openMemberDialog(row: RoleItem) {
  memberTargetRoleCode.value = row.roleCode
  memberTargetRoleName.value = row.roleName
  memberLoading.value = true
  memberDialogVisible.value = true
  addUserId.value = undefined
  try {
    memberList.value = await getRoleUsers(row.roleCode)
    if (allUsers.value.length === 0) {
      allUsers.value = (await getSimpleUserList()) as any
    }
  } finally {
    memberLoading.value = false
  }
}

// Users not yet in this role
function availableUsers() {
  const existing = new Set(memberList.value.map(m => m.userId))
  return allUsers.value.filter(u => !existing.has(u.id))
}

function handleAddMember() {
  if (!addUserId.value) return
  const user = allUsers.value.find(u => u.id === addUserId.value)
  if (!user) return
  const maxOrder = memberList.value.length > 0 ? Math.max(...memberList.value.map(m => m.sortOrder)) + 1 : 0
  memberList.value.push({
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    mobile: null,
    sortOrder: maxOrder,
  })
  addUserId.value = undefined
}

function handleRemoveMember(index: number) {
  memberList.value.splice(index, 1)
  reindex()
}

function handleMoveUp(index: number) {
  if (index <= 0) return
  const temp = memberList.value[index]
  memberList.value[index] = memberList.value[index - 1]
  memberList.value[index - 1] = temp
  reindex()
}

function handleMoveDown(index: number) {
  if (index >= memberList.value.length - 1) return
  const temp = memberList.value[index]
  memberList.value[index] = memberList.value[index + 1]
  memberList.value[index + 1] = temp
  reindex()
}

function reindex() {
  memberList.value = memberList.value.map((m, i) => ({ ...m, sortOrder: i }))
}

async function handleSaveMembers() {
  memberSaving.value = true
  try {
    await updateRoleUsers(
      memberTargetRoleCode.value,
      memberList.value.map((m, i) => ({ userId: m.userId, sortOrder: i })),
    )
    ElMessage.success('成员保存成功')
    memberDialogVisible.value = false
  } finally {
    memberSaving.value = false
  }
}

onMounted(() => fetchData())
</script>

<template>
  <div>
    <el-card shadow="never">
      <template #header>
        <div style="display: flex; align-items: center; justify-content: space-between">
          <span style="font-weight: 600; font-size: 16px">角色管理</span>
          <el-button v-permission="'role:create'" type="primary" :icon="Plus" @click="handleCreate">新建角色</el-button>
        </div>
      </template>

      <el-table v-loading="loading" :data="tableData" stripe border style="width: 100%">
        <el-table-column prop="roleCode" label="角色编码" min-width="150" />
        <el-table-column prop="roleName" label="角色名称" min-width="120" />
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column label="系统角色" min-width="90" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.systemFlag" type="warning" size="small">系统</el-tag>
            <el-tag v-else type="info" size="small">自定义</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" min-width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'danger'" size="small">{{ row.enabled ? '启用' : '禁用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button v-permission="'role:update'" type="primary" link size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button v-permission="'role:update'" link size="small" @click="openPermDialog(row)">权限</el-button>
            <el-button v-permission="'role:manage'" type="warning" link size="small" @click="openMemberDialog(row)">成员</el-button>
            <el-button v-if="!row.systemFlag" v-permission="'role:delete'" type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <RoleForm v-model:visible="formVisible" :role-id="editRoleId" @saved="fetchData" />

    <!-- Permission Assignment Dialog -->
    <el-dialog v-model="permDialogVisible" :title="`分配权限 - ${permTargetRoleName}`" width="600px">
      <div v-for="(perms, category) in permGroups" :key="category" style="margin-bottom: 16px">
        <div style="font-weight: 600; margin-bottom: 8px; color: #606266">{{ getCategoryLabel(String(category)) }}</div>
        <el-checkbox-group v-model="checkedPerms">
          <el-checkbox v-for="p in perms" :key="p.permissionCode" :label="p.permissionCode" :value="p.permissionCode" style="margin-bottom: 4px">
            {{ p.permissionName }}
          </el-checkbox>
        </el-checkbox-group>
      </div>
      <template #footer>
        <el-button @click="permDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleAssignPerms">确定</el-button>
      </template>
    </el-dialog>

    <!-- Member Management Dialog -->
    <el-dialog v-model="memberDialogVisible" :title="`${memberTargetRoleName} — 成员管理`" width="640px" :close-on-click-modal="false">
      <div v-loading="memberLoading">
        <p style="color: #909399; font-size: 12px; margin: 0 0 12px">排序越靠前，自动分配任务时优先级越高</p>

        <el-table :data="memberList" border size="small" style="width: 100%; margin-bottom: 16px">
          <el-table-column label="#" width="50" align="center">
            <template #default="{ $index }">{{ $index + 1 }}</template>
          </el-table-column>
          <el-table-column prop="displayName" label="姓名" min-width="90" />
          <el-table-column prop="username" label="用户名" min-width="110" />
          <el-table-column label="操作" width="130" align="center">
            <template #default="{ $index }">
              <el-button :icon="Top" link size="small" :disabled="$index === 0" @click="handleMoveUp($index)" title="上移" />
              <el-button :icon="Bottom" link size="small" :disabled="$index === memberList.length - 1" @click="handleMoveDown($index)" title="下移" />
              <el-button :icon="Delete" type="danger" link size="small" @click="handleRemoveMember($index)" title="移除" />
            </template>
          </el-table-column>
        </el-table>

        <div v-if="memberList.length === 0" style="text-align: center; color: #909399; padding: 16px 0; font-size: 13px">暂无成员</div>

        <!-- Add member -->
        <div style="display: flex; gap: 8px; align-items: center">
          <el-select
            v-model="addUserId"
            filterable
            placeholder="搜索用户添加"
            style="flex: 1"
          >
            <el-option
              v-for="u in availableUsers()"
              :key="u.id"
              :label="`${u.displayName}（${u.username}）`"
              :value="u.id"
            />
          </el-select>
          <el-button type="primary" :icon="Plus" @click="handleAddMember" :disabled="!addUserId">添加</el-button>
        </div>
      </div>
      <template #footer>
        <el-button @click="memberDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="memberSaving" @click="handleSaveMembers">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
