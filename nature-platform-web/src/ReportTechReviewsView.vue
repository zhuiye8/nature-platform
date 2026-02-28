<template>
  <div class="page-shell page section-stack">
    <header class="page-header">
      <div>
        <h2>报告技术审核</h2>
        <p>节点 11：审核任务由现场测评提交自动创建，本页用于查看技术审核状态与详情信息。</p>
      </div>
      <el-space>
        <el-button :loading="loading" @click="loadRows">刷新</el-button>
        <el-button v-permission="'workflow-task:view'" type="primary" @click="goWorkflow">打开待办审批</el-button>
      </el-space>
    </header>

    <el-card class="tip-card">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="技术审核任务已自动入待办，本页不再提供手工提交入口。"
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
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-space>
              <el-button
                v-if="canReview(row)"
                size="small"
                type="success"
                :loading="actionLoading && actionTaskKey === buildTaskKey(row)"
                @click="approveRow(row)"
              >
                通过
              </el-button>
              <el-button
                v-if="canReview(row)"
                size="small"
                type="danger"
                :loading="actionLoading && actionTaskKey === buildTaskKey(row)"
                @click="rejectRow(row)"
              >
                需要整改
              </el-button>
              <el-button size="small" @click="openDetail(row)">详情</el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
/**
 * @input Report tech review list API and router navigation for workflow/task inspection
 * @output Node-11 technical review task board with displayStatus-based rendering, approve/reject actions, and unified detail-page entry
 * @position Report technical review page for reviewing auto-created task progress with task-detail route handoff
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useRouter } from "vue-router";
import {
  fetchReportTechReviews,
  type ReportTechReviewRecord
} from "./report-tech-review-service";
import { approveTask, fetchTodoTasks, rejectTask } from "./workflow-service";
import { toTaskDetailPath } from "./task-detail-service";

const router = useRouter();
const loading = ref(false);
const actionLoading = ref(false);
const actionTaskKey = ref("");
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

function canReview(row: ReportTechReviewRecord) {
  if (!resolveTaskKey(row)) {
    return false;
  }
  const status = normalizeStatusValue(resolveStatus(row));
  if (status === "PENDING" || status === "SUBMITTED" || status === "待审核") {
    return true;
  }
  if (status === "") {
    const workflow = normalizeStatusValue(row.workflowStatus);
    const node = normalizeStatusValue(row.workflowNode);
    return workflow === "PENDING" && node.includes("REPORT_TECH_REVIEW_TASK");
  }
  return false;
}

function hasTaskId(row: ReportTechReviewRecord) {
  return row.taskId !== null && row.taskId !== undefined && String(row.taskId).trim().length > 0;
}

function resolveTaskKey(row: ReportTechReviewRecord) {
  if (hasTaskId(row)) {
    return `REPORT_TECH_REVIEW:${row.taskId ?? ""}`;
  }
  return todoTaskKeyByProject.value[row.projectRegisterId] ?? "";
}

function normalizeStatusValue(value?: string) {
  if (!value) {
    return "";
  }
  return String(value).trim().toUpperCase();
}

function buildTaskKey(row: ReportTechReviewRecord) {
  return resolveTaskKey(row);
}

async function approveRow(row: ReportTechReviewRecord) {
  if (!canReview(row)) {
    return;
  }
  const taskKey = buildTaskKey(row);
  if (!taskKey) {
    ElMessage.error("未找到技术审核任务编号，请在待办审批中处理");
    return;
  }
  try {
    await ElMessageBox.confirm("通过后流程将推进到下一节点，当前操作不可撤销。", "审核通过确认", {
      type: "warning",
      confirmButtonText: "确认通过",
      cancelButtonText: "取消"
    });
  } catch {
    return;
  }
  actionLoading.value = true;
  actionTaskKey.value = taskKey;
  try {
    await approveTask(taskKey);
    ElMessage.success("技术审核已通过");
    await loadRows();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "技术审核通过失败"));
  } finally {
    actionLoading.value = false;
    actionTaskKey.value = "";
  }
}

async function rejectRow(row: ReportTechReviewRecord) {
  if (!canReview(row)) {
    return;
  }
  const taskKey = buildTaskKey(row);
  if (!taskKey) {
    ElMessage.error("未找到技术审核任务编号，请在待办审批中处理");
    return;
  }
  let remark = "";
  try {
    const prompt = await ElMessageBox.prompt("请填写整改要求", "标记需要整改", {
      inputType: "textarea",
      inputPlaceholder: "请输入整改要求",
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return "整改要求不能为空";
        }
        return true;
      },
      confirmButtonText: "确认整改",
      cancelButtonText: "取消"
    });
    remark = prompt.value.trim();
  } catch {
    return;
  }
  actionLoading.value = true;
  actionTaskKey.value = taskKey;
  try {
    await rejectTask(taskKey, remark);
    ElMessage.success("已标记需要整改");
    await loadRows();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "提交整改要求失败"));
  } finally {
    actionLoading.value = false;
    actionTaskKey.value = "";
  }
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
  const taskKey = buildTaskKey(row);
  void router.push(toTaskDetailPath("REPORT_TECH_REVIEW", row.projectRegisterId, taskKey || undefined));
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
