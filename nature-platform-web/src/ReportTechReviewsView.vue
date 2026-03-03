<template>
  <div class="page-shell page section-stack">
    <header class="page-header">
      <div class="page-title-group">
        <h2 class="page-title">报告技术审核</h2>
        <p class="page-subtitle">节点 11：现场测评提交后自动生成技术审核任务。</p>
      </div>
      <el-space>
        <el-button :loading="loading" @click="loadRows">刷新</el-button>
        <el-button v-permission="'workflow-task:view'" type="primary" @click="goWorkflow">打开待办审批</el-button>
      </el-space>
    </header>

    <el-card class="tip-card np-info-strip">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="本页用于查看技术审核状态，审核动作统一在“详情页”处理。"
      />
    </el-card>

    <el-card class="table-card">
      <el-table :data="rows" v-loading="loading" empty-text="暂无可处理项">
        <el-table-column prop="projectRegisterId" label="项目ID" width="90" />
        <el-table-column prop="applicationName" label="申请单名称" min-width="260" show-overflow-tooltip />
        <el-table-column prop="onSitePackageObjectKey" label="现场测评压缩包" min-width="280" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.onSitePackageObjectKey || "-" }}
          </template>
        </el-table-column>
        <el-table-column prop="reviewer" label="审核人" width="140" />
        <el-table-column label="任务状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusTagType(resolveStatus(row))">{{ statusLabel(resolveStatus(row)) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="workflowNode" label="流程节点" width="200" show-overflow-tooltip />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-space>
              <el-button size="small" @click="openEntityDetail(row.projectRegisterId)">业务详情</el-button>
              <el-button size="small" @click="openDetail(row)">审核详情</el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
/**
 * @input Report tech review list API, workflow todo API, and router navigation helper
 * @output Node-11 technical review board with status projection and detail-page handoff
 * @position Report technical review page for viewing tasks and entering unified review detail page
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { useRouter } from "vue-router";
import { fetchReportTechReviews, type ReportTechReviewRecord } from "./report-tech-review-service";
import { fetchTodoTasks } from "./workflow-service";
import { toTaskDetailPath } from "./task-detail-service";

const router = useRouter();
const loading = ref(false);
const rows = ref<ReportTechReviewRecord[]>([]);
const todoTaskKeyByProject = ref<Record<number, string>>({});

function statusLabel(status?: string) {
  if (status === "DRAFT") return "草稿";
  if (status === "SUBMITTED" || status === "PENDING") return "待审核";
  if (status === "APPROVED") return "已通过";
  if (status === "REJECTED") return "需整改";
  if (status === "CLOSED") return "已关闭";
  return status || "-";
}

function statusTagType(status?: string) {
  if (status === "APPROVED") return "success";
  if (status === "SUBMITTED" || status === "PENDING") return "warning";
  if (status === "REJECTED") return "danger";
  return "info";
}

function resolveStatus(row: ReportTechReviewRecord) {
  if (row.displayStatus) {
    return row.displayStatus;
  }
  if (row.taskStatus) {
    return row.taskStatus;
  }
  return row.status;
}

function resolveTaskKey(row: ReportTechReviewRecord) {
  if (row.taskId !== null && row.taskId !== undefined && String(row.taskId).trim().length > 0) {
    return `REPORT_TECH_REVIEW:${row.taskId}`;
  }
  return todoTaskKeyByProject.value[row.projectRegisterId] ?? "";
}

function readErrorMessage(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof message === "string" && message.trim().length > 0 ? message : fallback;
}

async function loadRows() {
  loading.value = true;
  try {
    const [listRows, todoRows] = await Promise.all([
      fetchReportTechReviews(),
      fetchTodoTasks({ type: "REPORT_TECH_REVIEW" }).catch(() => [])
    ]);
    rows.value = listRows;
    const nextMap: Record<number, string> = {};
    for (const task of todoRows) {
      if (task.taskType === "REPORT_TECH_REVIEW" && Number.isFinite(task.bizId)) {
        nextMap[task.bizId] = task.taskId;
      }
    }
    todoTaskKeyByProject.value = nextMap;
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "加载技术审核列表失败"));
  } finally {
    loading.value = false;
  }
}

function goWorkflow() {
  void router.push("/workflow");
}

function openDetail(row: ReportTechReviewRecord) {
  const taskKey = resolveTaskKey(row);
  void router.push(toTaskDetailPath("REPORT_TECH_REVIEW", row.projectRegisterId, taskKey || undefined));
}

function openEntityDetail(projectId: number) {
  void router.push(`/entity-detail/report/${projectId}`);
}

onMounted(() => {
  void loadRows();
});
</script>

<style scoped>
.tip-card {
  border: 1px solid rgba(31, 152, 122, 0.2);
  background: linear-gradient(92deg, rgba(45, 184, 146, 0.08), rgba(47, 110, 162, 0.05));
}

.table-card {
  background: linear-gradient(180deg, #ffffff, #fbfcfc);
  border: 1px solid rgba(211, 225, 230, 0.88);
}
</style>
