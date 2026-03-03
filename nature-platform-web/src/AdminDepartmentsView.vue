<template>
  <div class="page-shell page section-stack">
    <header class="page-header">
      <div>
        <h2>部门管理</h2>
        <p>维护本地部门结构，支持钉钉组织一键同步。</p>
      </div>
      <el-space>
        <el-button v-permission="'department:manage'" :loading="loading" @click="loadDepartments">刷新</el-button>
        <el-button v-permission="'dingtalk:sync'" :loading="syncing" @click="syncDingTalk">钉钉同步</el-button>
        <el-button v-permission="'department:manage'" type="primary" @click="openCreate">新建部门</el-button>
      </el-space>
    </header>

    <el-card class="tip-card">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="钉钉同步来源部门为只读；本地新增部门可编辑。"
      />
    </el-card>

    <el-card class="table-card">
      <el-table :data="departments" row-key="id" v-loading="loading" empty-text="暂无部门数据">
        <el-table-column prop="deptCode" label="部门编码" min-width="140" />
        <el-table-column prop="deptName" label="部门名称" min-width="180" />
        <el-table-column prop="parentName" label="上级部门" min-width="160">
          <template #default="{ row }">
            {{ row.parentName || "-" }}
          </template>
        </el-table-column>
        <el-table-column label="来源" width="120">
          <template #default="{ row }">
            <el-tag :type="row.sourceType === 'DINGTALK' ? 'warning' : 'success'" size="small">
              {{ row.sourceType === "DINGTALK" ? "钉钉同步" : "本地维护" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'" size="small">
              {{ row.enabled ? "启用" : "停用" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="默认角色" min-width="180">
          <template #default="{ row }">
            {{ row.defaultRoleName || row.defaultRoleCode || "-" }}
          </template>
        </el-table-column>
        <el-table-column prop="sortOrder" label="排序" width="100" />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button
              v-permission="'department:manage'"
              size="small"
              :disabled="row.sourceType === 'DINGTALK'"
              @click="openEdit(row)"
            >
              编辑
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑部门' : '新建部门'"
      width="620px"
    >
      <el-form label-width="110px">
        <el-form-item label="部门编码" required>
          <el-input v-model="form.deptCode" :disabled="Boolean(editingId)" placeholder="例如 SALES_NORTH" />
        </el-form-item>
        <el-form-item label="部门名称" required>
          <el-input v-model="form.deptName" placeholder="请输入部门名称" />
        </el-form-item>
        <el-form-item label="上级部门">
          <el-select v-model="form.parentId" clearable filterable style="width: 100%" placeholder="不选则为顶级部门">
            <el-option
              v-for="dept in selectableParents"
              :key="dept.id"
              :label="`${dept.deptName}（${dept.deptCode}）`"
              :value="dept.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sortOrder" :min="0" :max="9999" />
        </el-form-item>
        <el-form-item label="默认角色">
          <el-select
            v-model="form.defaultRoleCode"
            clearable
            filterable
            style="width: 100%"
            placeholder="可选：用于首次钉钉建号自动分配"
          >
            <el-option
              v-for="role in roleOptions"
              :key="role.roleCode"
              :label="`${role.roleName}（${role.roleCode}）`"
              :value="role.roleCode"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="启用状态">
          <el-switch v-model="form.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button v-permission="'department:manage'" type="primary" :loading="submitting" @click="saveDepartment">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * @input Admin department/dingtalk sync APIs and Element Plus table/form/dialog interactions
 * @output Department-management page for local department CRUD and DingTalk organization synchronization
 * @position Admin UI page handling organization structure governance and sync execution feedback
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import {
  createAdminDepartment,
  fetchAdminDepartments,
  fetchAdminRoles,
  syncAdminDingTalkOrg,
  type AdminDepartmentRecord,
  type AdminRoleRecord,
  updateAdminDepartment
} from "./admin-service";

interface DepartmentFormModel {
  deptCode: string;
  deptName: string;
  parentId?: number;
  enabled: boolean;
  sortOrder: number;
  defaultRoleCode?: string;
}

const loading = ref(false);
const syncing = ref(false);
const submitting = ref(false);
const dialogVisible = ref(false);
const editingId = ref<number>();
const departments = ref<AdminDepartmentRecord[]>([]);
const roles = ref<AdminRoleRecord[]>([]);

const form = reactive<DepartmentFormModel>({
  deptCode: "",
  deptName: "",
  parentId: undefined,
  enabled: true,
  sortOrder: 0
});

const selectableParents = computed(() =>
  departments.value
    .filter((item) => item.id !== editingId.value)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
);

const roleOptions = computed(() =>
  roles.value
    .filter((item) => item.enabled)
    .sort((a, b) => a.roleCode.localeCompare(b.roleCode))
);

function readErrorMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof message === "string" && message.trim() ? message : fallback;
}

function buildDingTalkSyncErrorMessage(error: unknown): string {
  const response = (error as { response?: { status?: number; data?: { message?: string } } })?.response;
  const status = response?.status;
  const message = response?.data?.message || "";
  if (status === 400 && message.includes("appKey/appSecret")) {
    return "钉钉同步失败：后端未配置 app.dingtalk.app-key / app-secret，请先配置后重试。";
  }
  if (status === 404) {
    return "钉钉同步接口不可用：后端尚未部署 /api/v1/admin/dingtalk/sync 或服务未重启。";
  }
  if (status === 502) {
    return "钉钉同步失败：调用钉钉接口异常，请检查网络连通性与钉钉应用权限。";
  }
  return readErrorMessage(error, "钉钉同步失败");
}

function resetForm() {
  form.deptCode = "";
  form.deptName = "";
  form.parentId = undefined;
  form.enabled = true;
  form.sortOrder = 0;
  form.defaultRoleCode = undefined;
}

function openCreate() {
  editingId.value = undefined;
  resetForm();
  dialogVisible.value = true;
}

function openEdit(row: AdminDepartmentRecord) {
  editingId.value = row.id;
  form.deptCode = row.deptCode;
  form.deptName = row.deptName;
  form.parentId = row.parentId;
  form.enabled = row.enabled;
  form.sortOrder = row.sortOrder;
  form.defaultRoleCode = row.defaultRoleCode;
  dialogVisible.value = true;
}

async function loadDepartments() {
  loading.value = true;
  try {
    departments.value = await fetchAdminDepartments();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "加载部门列表失败"));
  } finally {
    loading.value = false;
  }
}

async function syncDingTalk() {
  syncing.value = true;
  try {
    const result = await syncAdminDingTalkOrg();
    ElMessage.success(
      `同步完成：部门${result.departmentTotal}条（新增${result.departmentInserted}、更新${result.departmentUpdated}），用户${result.userTotal}条（新增${result.userInserted}、更新${result.userUpdated}、停用${result.userDisabled}）`
    );
    await loadDepartments();
  } catch (error) {
    ElMessage.error(buildDingTalkSyncErrorMessage(error));
  } finally {
    syncing.value = false;
  }
}

async function saveDepartment() {
  if (!form.deptCode.trim()) {
    ElMessage.warning("部门编码不能为空");
    return;
  }
  if (!form.deptName.trim()) {
    ElMessage.warning("部门名称不能为空");
    return;
  }

  submitting.value = true;
  try {
    const payload = {
      deptCode: form.deptCode.trim(),
      deptName: form.deptName.trim(),
      parentId: form.parentId,
      enabled: form.enabled,
      sortOrder: form.sortOrder,
      defaultRoleCode: form.defaultRoleCode
    };
    if (editingId.value) {
      await updateAdminDepartment(editingId.value, payload);
      ElMessage.success("部门更新成功");
    } else {
      await createAdminDepartment(payload);
      ElMessage.success("部门创建成功");
    }
    dialogVisible.value = false;
    await loadDepartments();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "保存部门失败"));
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  void loadDepartments();
  fetchAdminRoles()
    .then((rows) => {
      roles.value = rows;
    })
    .catch(() => {
      roles.value = [];
    });
});
</script>
