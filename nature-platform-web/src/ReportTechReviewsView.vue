<template>
  <div class="page-shell page section-stack">
    <header class="page-header">
      <div>
        <h2>报告技术审核</h2>
        <p>节点 11：审核人由现场测评阶段预先分配，本页仅提交进入待办审核</p>
      </div>
      <el-space>
        <el-button :loading="loading" @click="loadRows">刷新</el-button>
        <el-button type="primary" @click="goWorkflow">打开待办审批</el-button>
      </el-space>
    </header>

    <el-card>
      <el-table :data="rows" v-loading="loading" empty-text="暂无可处理项">
        <el-table-column prop="projectRegisterId" label="项目ID" width="90" />
        <el-table-column prop="applicationName" label="申请单名称" min-width="260" show-overflow-tooltip />
        <el-table-column prop="onSitePackageObjectKey" label="现场测评压缩" min-width="280" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.onSitePackageObjectKey || "-" }}
          </template>
        </el-table-column>
        <el-table-column prop="reviewer" label="审核人" width="140" />
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="workflowNode" label="流程节点" width="200" show-overflow-tooltip />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              type="success"
              :disabled="!canSubmit(row)"
              @click="submitRow(row)"
            >
              提交审核
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
/**
 * @input Report tech review APIs and router navigation for submit-to-workflow transitions
 * @output Node-11 technical review submission board with reviewer/status visibility and guarded submit action
 * @position Report technical review page bridging pre-assigned reviewer context and workflow approval entry
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useRouter } from "vue-router";
import {
  fetchReportTechReviews,
  submitReportTechReview,
  type ReportTechReviewRecord
} from "./report-tech-review-service";

const router = useRouter();
const loading = ref(false);
const rows = ref<ReportTechReviewRecord[]>([]);

function statusLabel(status?: string) {
  if (status === "DRAFT") return "草稿";
  if (status === "SUBMITTED") return "已提交";
  if (status === "APPROVED") return "已通过";
  if (status === "REJECTED") return "已驳回";
  return status || "-";
}

function statusTagType(status?: string) {
  if (status === "APPROVED") return "success";
  if (status === "SUBMITTED") return "warning";
  if (status === "REJECTED") return "danger";
  return "info";
}

function canSubmit(row: ReportTechReviewRecord) {
  return !!row.reviewer && row.status !== "SUBMITTED";
}

function readErrorMessage(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof message === "string" && message.trim().length > 0 ? message : fallback;
}

async function loadRows() {
  loading.value = true;
  try {
    rows.value = await fetchReportTechReviews();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "加载技术审核列表失败"));
  } finally {
    loading.value = false;
  }
}

async function submitRow(row: ReportTechReviewRecord) {
  try {
    await ElMessageBox.confirm(`确认提交项目 ${row.projectRegisterId} 的技术审核吗？`, "提交确认", {
      type: "warning",
      confirmButtonText: "确认",
      cancelButtonText: "取消"
    });
  } catch {
    return;
  }

  try {
    await submitReportTechReview(row.projectRegisterId);
    ElMessage.success("技术审核已提交");
    await loadRows();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "提交技术审核失败"));
  }
}

function goWorkflow() {
  void router.push("/workflow");
}

onMounted(() => {
  void loadRows();
});
</script>

<style scoped>
.page {
  max-width: 1260px;
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
</style>
