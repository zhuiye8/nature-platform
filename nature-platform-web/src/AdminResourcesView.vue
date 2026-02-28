<template>
  <div class="page-shell page section-stack">
    <header class="page-header">
      <div>
        <h2>资源管理</h2>
        <p>维护菜单与页面资源，角色通过资源键控制菜单可见性与页面访问权限。</p>
      </div>
      <el-space>
        <el-button v-permission="'permission:view'" :loading="loading" @click="loadResources">刷新</el-button>
        <el-button v-permission="'permission:view'" type="primary" @click="openCreateDialog">新建资源</el-button>
      </el-space>
    </header>

    <el-card class="filter-card np-info-strip">
      <el-form :inline="true" class="filter-form" @submit.prevent>
        <el-form-item label="类型">
          <el-select v-model="filters.resourceType" style="width: 140px" clearable>
            <el-option label="分组" value="GROUP" />
            <el-option label="页面" value="PAGE" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.enabled" style="width: 140px">
            <el-option label="全部" value="ALL" />
            <el-option label="启用" value="ENABLED" />
            <el-option label="停用" value="DISABLED" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键字">
          <el-input
            v-model="filters.keyword"
            clearable
            placeholder="资源键 / 名称 / 描述"
            @keyup.enter="loadResources"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="loadResources">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="table-card">
      <el-table :data="resources" v-loading="loading" empty-text="暂无资源数据">
        <el-table-column prop="resourceKey" label="资源键" min-width="220" />
        <el-table-column prop="resourceName" label="名称" min-width="160" />
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.resourceType === 'GROUP' ? 'warning' : 'success'">
              {{ row.resourceType === "GROUP" ? "分组" : "页面" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="parentKey" label="父级资源" min-width="170" />
        <el-table-column prop="routePath" label="路由" min-width="170" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? "启用" : "停用" }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.builtIn ? 'warning' : 'primary'">{{ row.builtIn ? "内置" : "自定义" }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="220" show-overflow-tooltip />
        <el-table-column label="操作" width="170" fixed="right">
          <template #default="{ row }">
            <el-space>
              <el-button v-permission="'permission:view'" size="small" @click="openEditDialog(row)">编辑</el-button>
              <el-button
                v-permission="'permission:view'"
                size="small"
                type="danger"
                :disabled="row.builtIn"
                @click="deleteResource(row)"
              >
                删除
              </el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="createDialogVisible" title="新建资源" width="680px">
      <el-form label-width="110px">
        <el-form-item label="资源键" required>
          <el-input v-model="createForm.resourceKey" placeholder="例如 page.customers" />
        </el-form-item>
        <el-form-item label="资源名称" required>
          <el-input v-model="createForm.resourceName" placeholder="请输入中文名称" />
        </el-form-item>
        <el-form-item label="资源类型" required>
          <el-select v-model="createForm.resourceType" style="width: 100%">
            <el-option label="分组" value="GROUP" />
            <el-option label="页面" value="PAGE" />
          </el-select>
        </el-form-item>
        <el-form-item label="父级资源">
          <el-select v-model="createForm.parentKey" clearable filterable style="width: 100%" placeholder="页面资源请选择父级分组">
            <el-option v-for="item in groupResources" :key="item.resourceKey" :label="`${item.resourceKey} - ${item.resourceName}`" :value="item.resourceKey" />
          </el-select>
        </el-form-item>
        <el-form-item label="路由路径">
          <el-input v-model="createForm.routePath" placeholder="例如 /customers" />
        </el-form-item>
        <el-form-item label="图标">
          <el-input v-model="createForm.icon" placeholder="例如 User" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="createForm.sortOrder" :min="0" :max="9999" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="createForm.enabled" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="createForm.description" type="textarea" :rows="2" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button v-permission="'permission:view'" type="primary" :loading="submittingCreate" @click="submitCreate">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="editDialogVisible" title="编辑资源" width="680px">
      <el-form label-width="110px">
        <el-form-item label="资源键">
          <el-input :model-value="editingResourceKey" disabled />
        </el-form-item>
        <el-form-item label="资源名称" required>
          <el-input v-model="editForm.resourceName" />
        </el-form-item>
        <el-form-item label="资源类型" required>
          <el-select v-model="editForm.resourceType" style="width: 100%">
            <el-option label="分组" value="GROUP" />
            <el-option label="页面" value="PAGE" />
          </el-select>
        </el-form-item>
        <el-form-item label="父级资源">
          <el-select v-model="editForm.parentKey" clearable filterable style="width: 100%">
            <el-option v-for="item in groupResources" :key="item.resourceKey" :label="`${item.resourceKey} - ${item.resourceName}`" :value="item.resourceKey" />
          </el-select>
        </el-form-item>
        <el-form-item label="路由路径">
          <el-input v-model="editForm.routePath" />
        </el-form-item>
        <el-form-item label="图标">
          <el-input v-model="editForm.icon" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="editForm.sortOrder" :min="0" :max="9999" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="editForm.enabled" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editForm.description" type="textarea" :rows="2" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button v-permission="'permission:view'" type="primary" :loading="submittingEdit" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * @input Admin resource CRUD APIs and Element Plus form/table/dialog components
 * @output Resource management page supporting query/create/edit/delete of page/group resources
 * @position Admin UI page for page-level RBAC resource catalog governance
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  createAdminResource,
  deleteAdminResource,
  fetchAdminResources,
  updateAdminResource,
  type AdminResourceRecord
} from "./admin-service";

interface FilterState {
  keyword: string;
  resourceType: "" | "GROUP" | "PAGE";
  enabled: "ALL" | "ENABLED" | "DISABLED";
}

interface ResourceFormState {
  resourceKey: string;
  resourceName: string;
  resourceType: "GROUP" | "PAGE";
  parentKey: string;
  routePath: string;
  icon: string;
  sortOrder: number;
  enabled: boolean;
  description: string;
}

const loading = ref(false);
const submittingCreate = ref(false);
const submittingEdit = ref(false);
const resources = ref<AdminResourceRecord[]>([]);

const createDialogVisible = ref(false);
const editDialogVisible = ref(false);
const editingResourceKey = ref("");

const filters = reactive<FilterState>({
  keyword: "",
  resourceType: "",
  enabled: "ALL"
});

const createForm = reactive<ResourceFormState>({
  resourceKey: "",
  resourceName: "",
  resourceType: "PAGE",
  parentKey: "",
  routePath: "",
  icon: "",
  sortOrder: 0,
  enabled: true,
  description: ""
});

const editForm = reactive<ResourceFormState>({
  resourceKey: "",
  resourceName: "",
  resourceType: "PAGE",
  parentKey: "",
  routePath: "",
  icon: "",
  sortOrder: 0,
  enabled: true,
  description: ""
});

const groupResources = computed(() =>
  resources.value.filter((item) => item.resourceType === "GROUP" && item.enabled)
);

function readErrorMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof message === "string" && message.trim() ? message : fallback;
}

function resolveEnabledFilter() {
  if (filters.enabled === "ENABLED") {
    return true;
  }
  if (filters.enabled === "DISABLED") {
    return false;
  }
  return undefined;
}

function resetCreateForm() {
  createForm.resourceKey = "";
  createForm.resourceName = "";
  createForm.resourceType = "PAGE";
  createForm.parentKey = "";
  createForm.routePath = "";
  createForm.icon = "";
  createForm.sortOrder = 0;
  createForm.enabled = true;
  createForm.description = "";
}

async function loadResources() {
  loading.value = true;
  try {
    const rows = await fetchAdminResources({
      keyword: filters.keyword.trim() || undefined,
      resourceType: filters.resourceType || undefined,
      enabled: resolveEnabledFilter()
    });
    resources.value = rows;
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "加载资源列表失败"));
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  filters.keyword = "";
  filters.resourceType = "";
  filters.enabled = "ALL";
  void loadResources();
}

function openCreateDialog() {
  resetCreateForm();
  createDialogVisible.value = true;
}

function openEditDialog(row: AdminResourceRecord) {
  editingResourceKey.value = row.resourceKey;
  editForm.resourceKey = row.resourceKey;
  editForm.resourceName = row.resourceName;
  editForm.resourceType = row.resourceType;
  editForm.parentKey = row.parentKey || "";
  editForm.routePath = row.routePath || "";
  editForm.icon = row.icon || "";
  editForm.sortOrder = row.sortOrder;
  editForm.enabled = row.enabled;
  editForm.description = row.description || "";
  editDialogVisible.value = true;
}

function validateForm(formState: ResourceFormState, checkResourceKey = false): boolean {
  if (checkResourceKey && !formState.resourceKey.trim()) {
    ElMessage.warning("资源键不能为空");
    return false;
  }
  if (!formState.resourceName.trim()) {
    ElMessage.warning("资源名称不能为空");
    return false;
  }
  if (formState.resourceType === "PAGE" && !formState.routePath.trim()) {
    ElMessage.warning("页面资源的路由路径不能为空");
    return false;
  }
  return true;
}

async function submitCreate() {
  if (!validateForm(createForm, true)) {
    return;
  }
  submittingCreate.value = true;
  try {
    await createAdminResource({
      resourceKey: createForm.resourceKey.trim(),
      resourceName: createForm.resourceName.trim(),
      resourceType: createForm.resourceType,
      parentKey: createForm.parentKey.trim() || undefined,
      routePath: createForm.routePath.trim() || undefined,
      icon: createForm.icon.trim() || undefined,
      sortOrder: createForm.sortOrder,
      enabled: createForm.enabled,
      description: createForm.description.trim() || undefined
    });
    ElMessage.success("资源创建成功");
    createDialogVisible.value = false;
    await loadResources();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "创建资源失败"));
  } finally {
    submittingCreate.value = false;
  }
}

async function submitEdit() {
  if (!editingResourceKey.value || !validateForm(editForm, false)) {
    return;
  }
  submittingEdit.value = true;
  try {
    await updateAdminResource(editingResourceKey.value, {
      resourceName: editForm.resourceName.trim(),
      resourceType: editForm.resourceType,
      parentKey: editForm.parentKey.trim() || undefined,
      routePath: editForm.routePath.trim() || undefined,
      icon: editForm.icon.trim() || undefined,
      sortOrder: editForm.sortOrder,
      enabled: editForm.enabled,
      description: editForm.description.trim() || undefined
    });
    ElMessage.success("资源更新成功");
    editDialogVisible.value = false;
    await loadResources();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "更新资源失败"));
  } finally {
    submittingEdit.value = false;
  }
}

async function deleteResource(row: AdminResourceRecord) {
  try {
    await ElMessageBox.confirm(`确认删除资源 ${row.resourceKey} 吗？`, "删除确认", {
      type: "warning",
      confirmButtonText: "确认",
      cancelButtonText: "取消"
    });
  } catch {
    return;
  }

  try {
    await deleteAdminResource(row.resourceKey);
    ElMessage.success("资源删除成功");
    await loadResources();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "删除资源失败"));
  }
}

onMounted(() => {
  void loadResources();
});
</script>

<style scoped>
.filter-card {
  border: 1px solid rgba(31, 152, 122, 0.18);
  background: linear-gradient(102deg, rgba(45, 184, 146, 0.08), rgba(47, 110, 162, 0.06));
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
}

.table-card {
  background: linear-gradient(180deg, #ffffff, #fbfcfc);
}

@media (max-width: 900px) {
  .filter-form {
    display: block;
  }

  .filter-form :deep(.el-form-item) {
    margin-right: 0;
  }
}
</style>
