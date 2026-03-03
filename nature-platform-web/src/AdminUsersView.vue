<template>
  <div class="page-shell page section-stack">
    <header class="page-header">
      <div>
        <h2>用户管理</h2>
        <p>维护平台账号、启用状态与角色绑定，权限变更即时生效。</p>
      </div>
      <el-space>
        <el-button v-permission="'user:manage'" :loading="loading" @click="loadUsers">刷新</el-button>
        <el-button v-permission="'user:manage'" type="primary" @click="openCreate">新建用户</el-button>
      </el-space>
    </header>

    <el-card class="tip-card">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="建议至少保留 1 个启用中的超级管理员账号，避免管理入口不可用。"
      />
    </el-card>

    <el-card class="table-card">
      <el-table :data="users" v-loading="loading" empty-text="暂无用户数据">
        <el-table-column prop="username" label="用户名" min-width="140" />
        <el-table-column prop="displayName" label="显示名称" min-width="160" />
        <el-table-column prop="deptName" label="所属部门" min-width="160" />
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? "启用" : "停用" }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="sourceType" label="来源" width="110" />
        <el-table-column label="角色" min-width="320">
          <template #default="{ row }">
            <el-space wrap>
              <el-tag v-for="role in row.roles" :key="`${row.username}-${role}`" size="small">{{ role }}</el-tag>
            </el-space>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button v-permission="'user:manage'" size="small" @click="openEdit(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="editingUsername ? `编辑用户：${editingUsername}` : '新建用户'"
      width="660px"
    >
      <el-form label-width="110px">
        <el-form-item label="用户名" required>
          <el-input v-model="form.username" :disabled="Boolean(editingUsername)" placeholder="3-64 位字母数字或 ._-" />
        </el-form-item>

        <el-form-item label="显示名称" required>
          <el-input v-model="form.displayName" placeholder="请输入显示名称" />
        </el-form-item>

        <el-form-item :label="editingUsername ? '重置密码' : '登录密码'" :required="!editingUsername">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            :placeholder="editingUsername ? '不修改请留空' : '请输入登录密码'"
          />
        </el-form-item>

        <el-form-item label="启用状态">
          <el-switch v-model="form.enabled" />
        </el-form-item>

        <el-form-item label="角色">
          <el-select v-model="form.roles" multiple filterable clearable style="width: 100%" placeholder="选择角色">
            <el-option v-for="role in roleCodes" :key="role" :label="role" :value="role" />
          </el-select>
        </el-form-item>

        <el-form-item label="所属部门">
          <el-select v-model="form.deptId" filterable clearable style="width: 100%" placeholder="选择部门">
            <el-option
              v-for="dept in departments"
              :key="dept.id"
              :label="`${dept.deptName}（${dept.deptCode}）`"
              :value="dept.id"
            />
          </el-select>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button v-permission="'user:manage'" type="primary" :loading="submitting" @click="saveUser">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * @input Admin IAM API wrappers and Element Plus table/form/dialog components
 * @output User-management page supporting account list, creation, and update operations
 * @position Admin UI page for user lifecycle and role-binding maintenance
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import {
  createAdminUser,
  fetchAdminDepartments,
  fetchAdminUserRoleCodes,
  fetchAdminUsers,
  updateAdminUser,
  type AdminDepartmentRecord,
  type AdminUserRecord
} from "./admin-service";

interface UserFormModel {
  username: string;
  displayName: string;
  password: string;
  enabled: boolean;
  deptId?: number;
  roles: string[];
}

const loading = ref(false);
const submitting = ref(false);
const dialogVisible = ref(false);
const editingUsername = ref<string>("");
const users = ref<AdminUserRecord[]>([]);
const roleCodes = ref<string[]>([]);
const departments = ref<AdminDepartmentRecord[]>([]);

const form = reactive<UserFormModel>({
  username: "",
  displayName: "",
  password: "",
  enabled: true,
  deptId: undefined,
  roles: []
});

function readErrorMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof message === "string" && message.trim() ? message : fallback;
}

function resetForm() {
  form.username = "";
  form.displayName = "";
  form.password = "";
  form.enabled = true;
  form.deptId = undefined;
  form.roles = [];
}

function openCreate() {
  editingUsername.value = "";
  resetForm();
  dialogVisible.value = true;
}

function openEdit(row: AdminUserRecord) {
  editingUsername.value = row.username;
  form.username = row.username;
  form.displayName = row.displayName;
  form.password = "";
  form.enabled = row.enabled;
  form.deptId = row.deptId;
  form.roles = [...row.roles];
  dialogVisible.value = true;
}

async function loadUsers() {
  loading.value = true;
  try {
    users.value = await fetchAdminUsers();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "加载用户列表失败"));
  } finally {
    loading.value = false;
  }
}

async function loadRoleCodes() {
  try {
    roleCodes.value = await fetchAdminUserRoleCodes();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "加载角色选项失败"));
  }
}

async function loadDepartments() {
  try {
    departments.value = await fetchAdminDepartments();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "加载部门选项失败"));
  }
}

async function saveUser() {
  if (!form.displayName.trim()) {
    ElMessage.warning("显示名称不能为空");
    return;
  }
  if (!editingUsername.value && !form.username.trim()) {
    ElMessage.warning("用户名不能为空");
    return;
  }
  if (!editingUsername.value && !form.password.trim()) {
    ElMessage.warning("新建用户时必须设置密码");
    return;
  }

  submitting.value = true;
  try {
    if (editingUsername.value) {
      await updateAdminUser(editingUsername.value, {
        displayName: form.displayName.trim(),
        password: form.password.trim() || undefined,
        enabled: form.enabled,
        deptId: form.deptId,
        roles: form.roles
      });
      ElMessage.success("用户更新成功");
    } else {
      await createAdminUser({
        username: form.username.trim(),
        displayName: form.displayName.trim(),
        password: form.password.trim(),
        enabled: form.enabled,
        deptId: form.deptId,
        roles: form.roles
      });
      ElMessage.success("用户创建成功");
    }
    dialogVisible.value = false;
    await loadUsers();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "保存用户失败"));
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  void Promise.all([loadUsers(), loadRoleCodes(), loadDepartments()]);
});
</script>
