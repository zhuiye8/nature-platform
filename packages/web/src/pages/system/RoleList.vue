<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { getRoleList, getRoleDetail, deleteRole, assignRolePermissions, getAllPermissions } from '@/api/role'
import type { RoleItem, PermissionItem } from '@/api/role'
import { getCategoryLabel } from '@/utils/status-map'
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
    await deleteRole(row.id)
    ElMessage.success('删除成功')
    fetchData()
  } catch { /* handled */ }
}

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
        <el-table-column label="操作" width="220">
          <template #default="{ row }">
            <el-button v-permission="'role:update'" type="primary" link size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button v-permission="'role:update'" link size="small" @click="openPermDialog(row)">权限</el-button>
            <el-popconfirm v-if="!row.systemFlag" title="确定要删除该角色吗？" @confirm="handleDelete(row)">
              <template #reference>
                <el-button v-permission="'role:delete'" type="danger" link size="small">删除</el-button>
              </template>
            </el-popconfirm>
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
  </div>
</template>
