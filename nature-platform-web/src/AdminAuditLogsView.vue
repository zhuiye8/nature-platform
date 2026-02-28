<template>
  <div class="page-shell page section-stack">
    <header class="page-header">
      <div>
        <h2>审计日志</h2>
        <p>查询后台管理操作轨迹，支持按动作类型、操作人和目标类型过滤。</p>
      </div>
      <el-button v-permission="'audit:view'" :loading="loading" @click="loadLogs">刷新</el-button>
    </header>

    <el-card class="filter-card">
      <el-form inline>
        <el-form-item label="动作类型">
          <el-input v-model="filters.actionType" placeholder="例如 ADMIN_USER_UPDATE" clearable />
        </el-form-item>
        <el-form-item label="操作人">
          <el-input v-model="filters.operator" placeholder="用户名" clearable />
        </el-form-item>
        <el-form-item label="目标类型">
          <el-input v-model="filters.targetType" placeholder="例如 ROLE" clearable />
        </el-form-item>
        <el-form-item label="返回条数">
          <el-input-number v-model="filters.limit" :min="1" :max="500" />
        </el-form-item>
        <el-form-item>
          <el-button v-permission="'audit:view'" type="primary" :loading="loading" @click="loadLogs">查询</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="table-card">
      <el-table :data="logs" v-loading="loading" empty-text="暂无审计日志">
        <el-table-column prop="id" label="ID" width="90" />
        <el-table-column prop="createdAt" label="时间" min-width="180" />
        <el-table-column prop="operator" label="操作人" width="140" />
        <el-table-column prop="actionType" label="动作" min-width="220" />
        <el-table-column prop="targetType" label="目标类型" width="140" />
        <el-table-column prop="targetId" label="目标标识" min-width="180" />
        <el-table-column label="明细" min-width="360">
          <template #default="{ row }">
            <el-text class="log-detail" truncated>{{ row.detailJson || "-" }}</el-text>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
/**
 * @input Admin audit-log API and Element Plus filter/table controls
 * @output Audit-log page with query filters and operation timeline list
 * @position Admin UI page for management operation traceability
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { fetchAdminAuditLogs, type AdminAuditLogRecord } from "./admin-service";

const loading = ref(false);
const logs = ref<AdminAuditLogRecord[]>([]);

const filters = reactive({
  actionType: "",
  operator: "",
  targetType: "",
  limit: 100
});

function readErrorMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof message === "string" && message.trim() ? message : fallback;
}

async function loadLogs() {
  loading.value = true;
  try {
    logs.value =
      (await fetchAdminAuditLogs({
        actionType: filters.actionType.trim() || undefined,
        operator: filters.operator.trim() || undefined,
        targetType: filters.targetType.trim() || undefined,
        limit: filters.limit
      })) || [];
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "加载审计日志失败"));
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadLogs();
});
</script>

<style scoped>
.log-detail {
  width: 100%;
}
</style>
