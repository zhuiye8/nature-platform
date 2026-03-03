<template>
  <div class="page-shell page section-stack">
    <header class="page-header">
      <div>
        <h2>角色管理</h2>
        <p>维护角色基本信息、页面资源权限与用户分配，支持新增自定义角色。</p>
      </div>
      <el-space>
        <el-button v-permission="'role:manage'" :loading="loading" @click="loadAll">刷新</el-button>
        <el-button v-permission="'role:manage'" type="primary" @click="openCreate">新建角色</el-button>
      </el-space>
    </header>

    <el-card class="tip-card">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="系统角色不可删除。修改角色资源后，用户在下一次请求时按新配置生效。"
      />
    </el-card>

    <el-card class="table-card">
      <el-table :data="roles" v-loading="loading" empty-text="暂无角色数据">
        <el-table-column prop="roleCode" label="角色编码" min-width="180" />
        <el-table-column prop="roleName" label="角色名称" min-width="160" />
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? "启用" : "停用" }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="120">
          <template #default="{ row }">
            <el-tag :type="row.systemFlag ? 'warning' : 'success'">{{ row.systemFlag ? "系统" : "自定义" }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="数据范围" width="160">
          <template #default="{ row }">
            <el-tag size="small">{{ dataScopeLabel[row.dataScope] || row.dataScope }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="项目视图" width="140">
          <template #default="{ row }">
            <el-tag :type="row.projectViewAll ? 'success' : 'info'" size="small">
              {{ row.projectViewAll ? "全部项目" : "仅本人项目" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="同级销售可见" width="160">
          <template #default="{ row }">
            <el-tag :type="row.peerSalesLimited ? 'warning' : 'info'" size="small">
              {{ row.peerSalesLimited ? "开启" : "关闭" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="资源权限" min-width="320">
          <template #default="{ row }">
            <el-space wrap>
              <el-tag v-for="code in row.resourceKeys" :key="`${row.roleCode}-${code}`" size="small">{{ code }}</el-tag>
            </el-space>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-space>
              <el-button v-permission="'role:manage'" size="small" @click="openEdit(row)">编辑</el-button>
              <el-button v-permission="'role:manage'" size="small" @click="openAssignUsers(row)">分配用户</el-button>
              <el-button
                v-permission="'role:manage'"
                size="small"
                type="danger"
                :disabled="row.systemFlag"
                @click="removeRole(row.roleCode)"
              >
                删除
              </el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="editingRoleCode ? `编辑角色：${editingRoleCode}` : '新建角色'"
      width="720px"
    >
      <el-form label-width="110px">
        <el-form-item label="角色编码" required>
          <el-input v-model="form.roleCode" :disabled="Boolean(editingRoleCode)" placeholder="例如 ROLE_MANAGER" />
        </el-form-item>

        <el-form-item label="角色名称" required>
          <el-input v-model="form.roleName" placeholder="请输入角色名称" />
        </el-form-item>

        <el-form-item label="启用状态">
          <el-switch v-model="form.enabled" />
        </el-form-item>

        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="角色职责描述（可选）" />
        </el-form-item>

        <el-form-item label="数据范围">
          <el-select v-model="form.dataScope" style="width: 100%">
            <el-option v-for="option in dataScopeOptions" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
        </el-form-item>

        <el-form-item v-if="form.dataScope === 'CUSTOM'" label="可见部门">
          <el-select
            v-model="form.dataScopeDeptIds"
            multiple
            filterable
            clearable
            style="width: 100%"
            placeholder="选择可见部门"
          >
            <el-option
              v-for="dept in departmentOptions"
              :key="dept.id"
              :label="`${dept.deptName}（${dept.deptCode}）`"
              :value="dept.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="项目可见开关">
          <el-switch v-model="form.projectViewAll" active-text="可查看全部项目" inactive-text="仅查看本人项目" />
        </el-form-item>

        <el-form-item label="同级销售开关">
          <el-switch
            v-model="form.peerSalesLimited"
            active-text="同角色可见他人列表"
            inactive-text="仅本人可见"
          />
        </el-form-item>

        <el-form-item label="资源权限">
          <el-select v-model="form.resourceKeys" multiple filterable clearable style="width: 100%" placeholder="选择页面资源">
            <el-option
              v-for="resource in assignableResources"
              :key="resource.resourceKey"
              :label="`${resource.resourceKey} - ${resource.resourceName}`"
              :value="resource.resourceKey"
            />
          </el-select>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button v-permission="'role:manage'" type="primary" :loading="submitting" @click="saveRole">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="assignDialogVisible"
      width="min(960px, 96vw)"
      top="6vh"
      :title="assignDialogTitle"
      append-to-body
      class="assign-dialog"
    >
      <div class="assign-layout">
        <el-alert
          type="info"
          :closable="false"
          show-icon
          title="左侧为候选用户，右侧为当前角色已分配用户。保存后将按所选结果覆盖该角色用户映射。"
        />
        <div class="assign-toolbar">
          <el-space wrap>
            <el-tag size="small" type="info">候选用户：{{ roleUserTransferData.length }}</el-tag>
            <el-tag size="small" type="success">已分配：{{ assignedUsernames.length }}</el-tag>
          </el-space>
          <el-space>
            <el-button
              v-permission="'role:manage'"
              size="small"
              text
              :disabled="assignableEnabledUsernames.length === 0"
              @click="assignAllEnabledUsers"
            >
              一键分配全部启用用户
            </el-button>
            <el-button
              v-permission="'role:manage'"
              size="small"
              text
              :disabled="assignedUsernames.length === 0"
              @click="clearAssignedUsers"
            >
              清空分配
            </el-button>
          </el-space>
        </div>
        <el-transfer
          v-model="assignedUsernames"
          class="assign-transfer"
          filterable
          :filter-placeholder="'输入用户名或显示名称过滤'"
          :titles="['候选用户', '已分配用户']"
          target-order="push"
          :data="roleUserTransferData"
        />
        <el-card class="assign-order-card" shadow="never">
          <template #header>
            <div class="assign-order-header">
              <span>已分配顺序（保存后生效）</span>
              <el-text type="info">支持上移/下移，顺序将写入角色用户排序字段</el-text>
            </div>
          </template>
          <div v-if="assignedUsernames.length === 0" class="assign-order-empty">暂无已分配用户</div>
          <div v-else class="assign-order-list">
            <div v-for="(username, index) in assignedUsernames" :key="username" class="assign-order-item">
              <div class="assign-order-main">
                <span class="assign-order-index">{{ index + 1 }}</span>
                <span class="assign-order-name">{{ resolveUserDisplay(username) }}</span>
              </div>
              <el-space>
                <el-button
                  v-permission="'role:manage'"
                  size="small"
                  circle
                  :icon="ArrowUp"
                  :disabled="index === 0"
                  @click="moveAssignedUser(index, -1)"
                />
                <el-button
                  v-permission="'role:manage'"
                  size="small"
                  circle
                  :icon="ArrowDown"
                  :disabled="index === assignedUsernames.length - 1"
                  @click="moveAssignedUser(index, 1)"
                />
                <el-button
                  v-permission="'role:manage'"
                  size="small"
                  circle
                  type="danger"
                  plain
                  :icon="Close"
                  @click="removeAssignedUser(username)"
                />
              </el-space>
            </div>
          </div>
        </el-card>
      </div>
      <template #footer>
        <el-space>
          <el-button @click="assignDialogVisible = false">取消</el-button>
          <el-button
            v-permission="'role:manage'"
            type="primary"
            :loading="assignSubmitting"
            :disabled="!assigningRoleCode"
            @click="saveRoleUsers"
          >
            保存分配
          </el-button>
        </el-space>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * @input Admin role/resource/user-allocation APIs and Element Plus table/form/dialog actions
 * @output Role-management page for role CRUD, resource binding, and role-user assignment modal
 * @position Admin UI page handling role governance and transfer-based user/resource allocation operations
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { computed, onMounted, reactive, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { ArrowDown, ArrowUp, Close } from "@element-plus/icons-vue";
import {
  createAdminRole,
  deleteAdminRole,
  fetchAdminDepartments,
  fetchAdminResources,
  fetchAdminRoleUserOptions,
  fetchAdminRoleUsers,
  fetchAdminRoles,
  updateAdminRoleUsers,
  type AdminDepartmentRecord,
  type AdminRoleUserOptionRecord,
  updateAdminRole,
  type AdminResourceRecord,
  type AdminRoleRecord
} from "./admin-service";

interface RoleFormModel {
  roleCode: string;
  roleName: string;
  description: string;
  enabled: boolean;
  dataScope: "SELF" | "DEPT" | "DEPT_AND_SUB" | "CUSTOM" | "ALL";
  projectViewAll: boolean;
  peerSalesLimited: boolean;
  dataScopeDeptIds: number[];
  resourceKeys: string[];
}

const loading = ref(false);
const submitting = ref(false);
const assignSubmitting = ref(false);
const dialogVisible = ref(false);
const assignDialogVisible = ref(false);
const editingRoleCode = ref<string>("");
const assigningRoleCode = ref<string>("");
const assigningRoleName = ref<string>("");
const roles = ref<AdminRoleRecord[]>([]);
const resources = ref<AdminResourceRecord[]>([]);
const departments = ref<AdminDepartmentRecord[]>([]);
const roleUserOptions = ref<AdminRoleUserOptionRecord[]>([]);
const assignedUsernames = ref<string[]>([]);

const form = reactive<RoleFormModel>({
  roleCode: "",
  roleName: "",
  description: "",
  enabled: true,
  dataScope: "SELF",
  projectViewAll: false,
  peerSalesLimited: false,
  dataScopeDeptIds: [],
  resourceKeys: []
});

const dataScopeOptions = [
  { value: "SELF", label: "仅本人" },
  { value: "DEPT", label: "本部门" },
  { value: "DEPT_AND_SUB", label: "本部门及下级" },
  { value: "CUSTOM", label: "自定义部门" },
  { value: "ALL", label: "全部数据" }
] as const;

const dataScopeLabel: Record<string, string> = {
  SELF: "仅本人",
  DEPT: "本部门",
  DEPT_AND_SUB: "本部门及下级",
  CUSTOM: "自定义部门",
  ALL: "全部数据"
};

const assignableResources = computed(() =>
  resources.value
    .filter((item) => item.resourceType === "PAGE" && item.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder)
);

const departmentOptions = computed(() =>
  [...departments.value].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
);

const roleUserTransferData = computed(() =>
  roleUserOptions.value.map((item) => ({
    key: item.username,
    label: `${item.username}${item.displayName ? `（${item.displayName}）` : ""}${
      item.deptName ? ` - ${item.deptName}` : ""
    }${item.enabled ? "" : " [停用]"}`
  }))
);

const assignableEnabledUsernames = computed(() =>
  roleUserOptions.value.filter((item) => item.enabled).map((item) => item.username)
);

const roleUserOptionMap = computed(() => {
  const map = new Map<string, AdminRoleUserOptionRecord>();
  for (const item of roleUserOptions.value) {
    map.set(item.username, item);
  }
  return map;
});

const assignDialogTitle = computed(
  () => `分配角色：${assigningRoleName.value || assigningRoleCode.value || "-"}`
);

function readErrorMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof message === "string" && message.trim() ? message : fallback;
}

function resetForm() {
  form.roleCode = "";
  form.roleName = "";
  form.description = "";
  form.enabled = true;
  form.dataScope = "SELF";
  form.projectViewAll = false;
  form.peerSalesLimited = false;
  form.dataScopeDeptIds = [];
  form.resourceKeys = [];
}

function openCreate() {
  editingRoleCode.value = "";
  resetForm();
  dialogVisible.value = true;
}

function openEdit(row: AdminRoleRecord) {
  editingRoleCode.value = row.roleCode;
  form.roleCode = row.roleCode;
  form.roleName = row.roleName;
  form.description = row.description || "";
  form.enabled = row.enabled;
  form.dataScope = row.dataScope || "SELF";
  form.projectViewAll = row.projectViewAll || false;
  form.peerSalesLimited = Boolean(row.peerSalesLimited);
  form.dataScopeDeptIds = [...(row.dataScopeDeptIds || [])];
  form.resourceKeys = [...row.resourceKeys];
  dialogVisible.value = true;
}

async function loadAll() {
  loading.value = true;
  try {
    const [roleRows, resourceRows] = await Promise.all([
      fetchAdminRoles(),
      fetchAdminResources({ enabled: true })
    ]);
    let departmentRows: AdminDepartmentRecord[] = [];
    try {
      departmentRows = await fetchAdminDepartments();
    } catch {
      departmentRows = [];
    }
    roles.value = roleRows;
    resources.value = resourceRows;
    departments.value = departmentRows;
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "加载角色数据失败"));
  } finally {
    loading.value = false;
  }
}

async function saveRole() {
  if (!form.roleCode.trim()) {
    ElMessage.warning("角色编码不能为空");
    return;
  }
  if (!form.roleName.trim()) {
    ElMessage.warning("角色名称不能为空");
    return;
  }

  submitting.value = true;
  try {
    if (editingRoleCode.value) {
      await updateAdminRole(editingRoleCode.value, {
        roleName: form.roleName.trim(),
        description: form.description.trim() || undefined,
        enabled: form.enabled,
        dataScope: form.dataScope,
        projectViewAll: form.projectViewAll,
        peerSalesLimited: form.peerSalesLimited,
        dataScopeDeptIds: form.dataScope === "CUSTOM" ? form.dataScopeDeptIds : [],
        resourceKeys: form.resourceKeys
      });
      ElMessage.success("角色更新成功");
    } else {
      await createAdminRole({
        roleCode: form.roleCode.trim(),
        roleName: form.roleName.trim(),
        description: form.description.trim() || undefined,
        enabled: form.enabled,
        dataScope: form.dataScope,
        projectViewAll: form.projectViewAll,
        peerSalesLimited: form.peerSalesLimited,
        dataScopeDeptIds: form.dataScope === "CUSTOM" ? form.dataScopeDeptIds : [],
        resourceKeys: form.resourceKeys
      });
      ElMessage.success("角色创建成功");
    }
    dialogVisible.value = false;
    await loadAll();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "保存角色失败"));
  } finally {
    submitting.value = false;
  }
}

async function openAssignUsers(row: AdminRoleRecord) {
  assigningRoleCode.value = row.roleCode;
  assigningRoleName.value = row.roleName;
  assignDialogVisible.value = true;
  assignSubmitting.value = false;
  try {
    const [userOptions, users] = await Promise.all([
      fetchAdminRoleUserOptions(),
      fetchAdminRoleUsers(row.roleCode)
    ]);
    roleUserOptions.value = userOptions;
    assignedUsernames.value = users;
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "加载角色用户分配信息失败"));
    assignDialogVisible.value = false;
    assigningRoleName.value = "";
  }
}

async function saveRoleUsers() {
  if (!assigningRoleCode.value) {
    return;
  }
  assignSubmitting.value = true;
  try {
    const users = await updateAdminRoleUsers(assigningRoleCode.value, assignedUsernames.value);
    assignedUsernames.value = users;
    ElMessage.success("角色用户分配已保存");
    assignDialogVisible.value = false;
    assigningRoleName.value = "";
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "保存角色用户分配失败"));
  } finally {
    assignSubmitting.value = false;
  }
}

function assignAllEnabledUsers() {
  assignedUsernames.value = [...assignableEnabledUsernames.value];
}

function clearAssignedUsers() {
  assignedUsernames.value = [];
}

function moveAssignedUser(index: number, delta: number) {
  const target = index + delta;
  if (index < 0 || target < 0 || target >= assignedUsernames.value.length) {
    return;
  }
  const next = [...assignedUsernames.value];
  const [item] = next.splice(index, 1);
  if (!item) {
    return;
  }
  next.splice(target, 0, item);
  assignedUsernames.value = next;
}

function removeAssignedUser(username: string) {
  assignedUsernames.value = assignedUsernames.value.filter((item) => item !== username);
}

function resolveUserDisplay(username: string): string {
  const option = roleUserOptionMap.value.get(username);
  if (!option) {
    return username;
  }
  const name = option.displayName ? `${username}（${option.displayName}）` : username;
  return option.deptName ? `${name} - ${option.deptName}` : name;
}

async function removeRole(roleCode: string) {
  try {
    await ElMessageBox.confirm(`确认删除角色 ${roleCode} 吗？`, "删除确认", {
      type: "warning",
      confirmButtonText: "确认",
      cancelButtonText: "取消"
    });
  } catch {
    return;
  }

  try {
    await deleteAdminRole(roleCode);
    ElMessage.success("角色已删除");
    await loadAll();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "删除角色失败"));
  }
}

onMounted(() => {
  void loadAll();
});

watch(
  () => form.dataScope,
  (value) => {
    if (value !== "CUSTOM") {
      form.dataScopeDeptIds = [];
    }
  }
);
</script>

<style scoped>
.assign-layout {
  display: grid;
  gap: 14px;
}

.assign-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding: 10px 12px;
  border: 1px solid rgba(198, 212, 220, 0.72);
  border-radius: 10px;
  background: linear-gradient(180deg, rgba(248, 251, 252, 0.92), rgba(241, 247, 248, 0.82));
}

.assign-transfer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 16px;
  align-items: center;
  width: 100%;
}

.assign-transfer :deep(.el-transfer-panel) {
  width: 100%;
  min-width: 0;
  max-width: none;
  height: 440px;
  border-radius: 12px;
  border-color: rgba(198, 212, 220, 0.8);
  background: linear-gradient(180deg, #fdfefe, #f7fafb);
}

.assign-transfer :deep(.el-transfer-panel__header) {
  background: rgba(238, 244, 246, 0.82);
}

.assign-transfer :deep(.el-transfer-panel__list) {
  height: 320px;
}

.assign-transfer :deep(.el-transfer__buttons) {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0;
}

.assign-transfer :deep(.el-transfer__button) {
  margin: 0;
}

.assign-order-card {
  border-radius: 12px;
  border-color: rgba(198, 212, 220, 0.8);
  background: linear-gradient(180deg, #ffffff, #f7fafb);
}

.assign-order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.assign-order-empty {
  color: rgba(88, 102, 118, 0.76);
  font-size: 13px;
}

.assign-order-list {
  display: grid;
  gap: 8px;
}

.assign-order-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(198, 212, 220, 0.66);
  background: rgba(249, 252, 252, 0.9);
}

.assign-order-main {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.assign-order-index {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(33, 179, 150, 0.12);
  color: #15795f;
  font-weight: 600;
  font-size: 12px;
}

.assign-order-name {
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.assign-transfer :deep(.el-transfer-panel__item .el-checkbox__label) {
  white-space: normal;
  word-break: break-all;
  line-height: 1.35;
}

@media (max-width: 1080px) {
  .assign-transfer {
    grid-template-columns: 1fr;
  }

  .assign-transfer :deep(.el-transfer__buttons) {
    flex-direction: row;
    justify-content: center;
  }
}
</style>
