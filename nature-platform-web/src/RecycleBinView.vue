<template>
  <div class="page-shell page section-stack">
    <header class="page-header">
      <div>
        <h2>回收站</h2>
        <p>查看已删除的合同和项目登记，恢复操作仅允许超管执行</p>
      </div>
      <el-space>
        <el-tag :type="isAdmin ? 'success' : 'warning'">
          {{ isAdmin ? "超管可恢复" : "仅超管可恢复" }}
        </el-tag>
        <el-button :loading="loading" @click="loadAll">刷新</el-button>
      </el-space>
    </header>

    <el-card class="tip-card">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="恢复规则：项目登记若存在相同合同+年份的未删除记录，则不可恢复" />
    </el-card>

    <el-card>
      <el-tabs v-model="activeTab" type="border-card">
        <el-tab-pane label="合同回收" name="contracts">
          <el-table :data="contractItems" v-loading="loading" empty-text="暂无已删除合同">
            <el-table-column prop="bizId" label="合同ID" width="100" />
            <el-table-column prop="bizName" label="合同名称" min-width="260" show-overflow-tooltip />
            <el-table-column prop="extra" label="合同编号" min-width="180" show-overflow-tooltip />
            <el-table-column prop="deletedBy" label="删除人" width="130" />
            <el-table-column prop="deletedAt" label="删除时间" min-width="190">
              <template #default="{ row }">
                {{ formatShanghaiDateTime(row.deletedAt) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="130" fixed="right">
              <template #default="{ row }">
                <el-button
                  type="primary"
                  size="small"
                  :disabled="!isAdmin"
                  @click="restore('CONTRACT', row)"
                >
                  恢复
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="项目登记回收" name="projects">
          <el-table :data="projectItems" v-loading="loading" empty-text="暂无已删除项目登记">
            <el-table-column prop="bizId" label="项目ID" width="100" />
            <el-table-column prop="bizName" label="申请单名称" min-width="260" show-overflow-tooltip />
            <el-table-column prop="extra" label="合同/年份" min-width="210" show-overflow-tooltip />
            <el-table-column prop="deletedBy" label="删除人" width="130" />
            <el-table-column prop="deletedAt" label="删除时间" min-width="190">
              <template #default="{ row }">
                {{ formatShanghaiDateTime(row.deletedAt) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="130" fixed="right">
              <template #default="{ row }">
                <el-button
                  type="primary"
                  size="small"
                  :disabled="!isAdmin"
                  @click="restore('PROJECT_REGISTER', row)"
                >
                  恢复
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup lang="ts">
/**
 * @input Auth role state, recycle-bin APIs, and time formatter for deleted-item management
 * @output Recycle-bin UI for contract/project deleted lists and super-admin-only restore actions
 * @position Soft-delete recovery page with role-gated operations and conflict-aware restore feedback
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { computed, onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useAuthStore } from "./auth-store";
import { fetchCurrentUser } from "./auth-service";
import {
  fetchContractRecycleItems,
  fetchProjectRecycleItems,
  restoreRecycleItem,
  type RecycleItemRecord,
  type RecycleType
} from "./recycle-bin-service";
import { formatShanghaiDateTime } from "./time";

const authStore = useAuthStore();
const loading = ref(false);
const activeTab = ref("contracts");
const contractItems = ref<RecycleItemRecord[]>([]);
const projectItems = ref<RecycleItemRecord[]>([]);
const currentRoles = ref<string[]>([]);

const isAdmin = computed(() => {
  return currentRoles.value.includes("ROLE_SUPER_ADMIN");
});

function readErrorMessage(error: unknown, fallback: string) {
  const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof msg === "string" && msg.trim() ? msg : fallback;
}

async function loadAll() {
  loading.value = true;
  try {
    const [contracts, projects] = await Promise.all([
      fetchContractRecycleItems(),
      fetchProjectRecycleItems()
    ]);
    contractItems.value = contracts;
    projectItems.value = projects;
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "加载回收站失败"));
  } finally {
    loading.value = false;
  }
}

async function restore(type: RecycleType, row: RecycleItemRecord) {
  if (!isAdmin.value) {
    ElMessage.warning("仅超管可执行恢复");
    return;
  }
  try {
    await ElMessageBox.confirm(`确认恢复 ${row.bizName}（${row.bizId}）吗？`, "恢复确认", {
      type: "warning",
      confirmButtonText: "确认",
      cancelButtonText: "取消"
    });
  } catch {
    return;
  }

  try {
    await restoreRecycleItem(type, row.bizId);
    ElMessage.success("恢复成功");
    await loadAll();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "恢复失败"));
  }
}

onMounted(() => {
  if (!authStore.roles.length) {
    void fetchCurrentUser()
      .then((user) => {
        const roles = Array.isArray(user.roles) ? user.roles : [];
        currentRoles.value = roles;
        authStore.setRoles(roles);
      })
      .catch(() => {
        currentRoles.value = [];
      });
  } else {
    currentRoles.value = authStore.roles;
  }
  void loadAll();
});
</script>

<style scoped>
.page {
  max-width: 1280px;
  margin: 24px auto;
  padding: 0 12px;
}

.page-header {
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.page-header h2 {
  margin: 0;
}

.page-header p {
  margin: 6px 0 0;
  color: #6f7b8a;
}

.tip-card {
  margin-bottom: 16px;
}
</style>
