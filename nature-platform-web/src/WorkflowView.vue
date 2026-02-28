<template>
  <div class="page-shell workflow-page section-stack">
    <header class="page-header">
      <div class="page-title-group">
        <h2 class="page-title">流程任务中心</h2>
        <p class="page-subtitle">集中处理合同、项目、质量与报告审核待办任务。</p>
      </div>
      <el-space class="header-actions">
        <el-tag type="warning">待办 {{ tasks.length }}</el-tag>
        <el-button :loading="loading" @click="loadTasks">刷新</el-button>
      </el-space>
    </header>

    <el-card class="filter-card np-info-strip">
      <el-form :inline="true" class="filter-form" @submit.prevent>
        <el-form-item label="任务类型">
          <el-select v-model="filters.type" style="width: 220px">
            <el-option label="全部" value="" />
            <el-option label="合同审核" value="CONTRACT" />
            <el-option label="项目登记审核" value="PROJECT_REGISTER" />
            <el-option label="质量审核" value="QUALITY_REVIEW" />
            <el-option label="报告技术审核" value="REPORT_TECH_REVIEW" />
            <el-option label="报告内容审核" value="REPORT_CONTENT_REVIEW" />
            <el-option label="报告最终审核" value="REPORT_FINAL_REVIEW" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键字">
          <el-input
            v-model="filters.keyword"
            clearable
            placeholder="标题 / 提交人 / 业务ID"
            @keyup.enter="loadTasks"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="loadTasks">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>

      <el-alert
        v-if="noPermission"
        type="warning"
        show-icon
        :closable="false"
        :title="permissionMessage || '当前账号无审核权限，无法查看待办任务。'"
      />
    </el-card>

    <el-card class="task-table-card">
      <el-table :data="tasks" v-loading="loading" empty-text="暂无待办任务">
        <el-table-column prop="taskId" label="任务ID" min-width="170" />
        <el-table-column prop="bizTitle" label="任务标题" min-width="260" show-overflow-tooltip />
        <el-table-column prop="taskType" label="类型" width="170">
          <template #default="{ row }">
            {{ taskTypeLabel(row.taskType) }}
          </template>
        </el-table-column>
        <el-table-column prop="currentNode" label="流程节点" width="170">
          <template #default="{ row }">
            {{ row.currentNode || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="submittedBy" label="提交人" width="130" />
        <el-table-column prop="submittedAt" label="提交时间" min-width="180">
          <template #default="{ row }">
            {{ formatShanghaiDateTime(row.submittedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusTagType(resolveWorkflowStatus(row))">
              {{ statusLabel(resolveWorkflowStatus(row)) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="280" fixed="right">
          <template #default="{ row }">
            <el-space>
              <el-button size="small" @click="openDetail(row)">详情</el-button>
              <el-button size="small" type="success" @click="openApproveDialog(row)">
                通过
              </el-button>
              <el-button size="small" type="danger" @click="openRejectDialog(row)">
                需要整改
              </el-button>
            </el-space>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="noPermission ? '当前账号无审核权限。' : '当前没有待处理任务。'">
            <el-space>
              <el-button type="primary" @click="guideVisible = true">查看提交指引</el-button>
              <el-button @click="goWorkflowNodes">前往流程节点页</el-button>
              <el-button @click="loadTasks">刷新</el-button>
            </el-space>
          </el-empty>
        </template>
      </el-table>
    </el-card>

    <el-dialog v-model="approveDialogVisible" title="审核通过确认" width="560px">
      <div class="approve-panel" v-if="approveTaskRow">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="任务ID">{{ approveTaskRow.taskId }}</el-descriptions-item>
          <el-descriptions-item label="任务类型">{{ taskTypeLabel(approveTaskRow.taskType) }}</el-descriptions-item>
          <el-descriptions-item label="任务标题">{{ approveTaskRow.bizTitle }}</el-descriptions-item>
          <el-descriptions-item label="流程节点">{{ approveTaskRow.currentNode || "-" }}</el-descriptions-item>
          <el-descriptions-item label="提交人">{{ approveTaskRow.submittedBy || "-" }}</el-descriptions-item>
        </el-descriptions>
        <el-alert
          class="approve-alert"
          type="warning"
          :closable="false"
          show-icon
          title="通过后流程将推进到下一节点，当前操作不可撤销。"
        />
      </div>
      <template #footer>
        <el-button @click="approveDialogVisible = false">取消</el-button>
        <el-button type="success" :loading="submittingApprove" @click="submitApprove">确认通过</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="rejectDialogVisible" title="标记需要整改" width="520px">
      <el-form label-position="top">
        <el-form-item label="任务ID">
          <el-input :model-value="rejectForm.taskId" disabled />
        </el-form-item>
        <el-form-item label="整改要求">
          <el-input
            v-model="rejectForm.remark"
            type="textarea"
            :rows="4"
            maxlength="300"
            show-word-limit
            placeholder="请填写整改要求"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectDialogVisible = false">取消</el-button>
        <el-button type="danger" :loading="submittingReject" @click="submitReject">确认需要整改</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="guideVisible" title="如何生成待办审核任务" width="620px">
      <ol class="guide-list">
        <li>先在对应业务页面完成“保存 + 提交”。</li>
        <li>系统会自动生成待办任务并推送给被分配审核人。</li>
        <li>在本页点击“刷新”即可拉取最新待办。</li>
        <li>报告节点待办来源：技术审核、内容审核（技术/管理/网络）、最终审核。</li>
        <li>审核人点“需要整改”后，业务人员在现场测评页修订并重提。</li>
      </ol>
      <template #footer>
        <el-button type="primary" @click="guideVisible = false">我知道了</el-button>
      </template>
    </el-dialog>

  </div>
</template>

<script setup lang="ts">
/**
 * @input Workflow task APIs, permission helper, and router navigation for task-center operations
 * @output Unified workflow task center UI using displayStatus for consistent query/rendering, plus approve/rectification actions and unified detail-page jump
 * @position Workflow review hub page orchestrating cross-domain pending approvals with page-level RBAC and full-detail route handoff
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { useRouter } from "vue-router";
import { approveTask, fetchTodoTasks, rejectTask, type WorkflowTask } from "./workflow-service";
import { toTaskDetailPath } from "./task-detail-service";
import { formatShanghaiDateTime } from "./time";

const router = useRouter();
const loading = ref(false);
const tasks = ref<WorkflowTask[]>([]);
const noPermission = ref(false);
const permissionMessage = ref("");
const guideVisible = ref(false);

const filters = reactive({
  type: "",
  keyword: ""
});

const rejectDialogVisible = ref(false);
const submittingReject = ref(false);
const rejectForm = reactive({
  taskId: "",
  remark: ""
});
const approveDialogVisible = ref(false);
const submittingApprove = ref(false);
const approveTaskRow = ref<WorkflowTask | null>(null);

function taskTypeLabel(taskType: string) {
  if (taskType === "CONTRACT") return "合同审核";
  if (taskType === "PROJECT_REGISTER") return "项目登记审核";
  if (taskType === "QUALITY_REVIEW") return "质量审核";
  if (taskType === "REPORT_TECH_REVIEW") return "报告技术审核";
  if (taskType === "REPORT_CONTENT_REVIEW") return "报告内容审核";
  if (taskType === "REPORT_FINAL_REVIEW") return "报告最终审核";
  return taskType || "-";
}

function statusTagType(status: string) {
  if (status === "SUBMITTED" || status === "PENDING") return "warning";
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "danger";
  if (status === "CLOSED") return "info";
  return "info";
}

function statusLabel(status: string) {
  if (status === "SUBMITTED" || status === "PENDING") return "待审核";
  if (status === "APPROVED") return "已通过";
  if (status === "REJECTED") return "需要整改";
  if (status === "DRAFT") return "草稿";
  if (status === "CLOSED") return "已关闭";
  return status || "未知";
}

function resolveWorkflowStatus(row: WorkflowTask) {
  return row.displayStatus || row.status;
}

function readErrorStatus(error: unknown) {
  return (error as { response?: { status?: number } })?.response?.status ?? 0;
}

function readErrorMessage(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof message === "string" && message.trim().length > 0 ? message : fallback;
}

async function loadTasks() {
  loading.value = true;
  try {
    tasks.value = await fetchTodoTasks({
      type: filters.type || undefined,
      keyword: filters.keyword.trim() || undefined
    });
    noPermission.value = false;
    permissionMessage.value = "";
  } catch (error) {
    const status = readErrorStatus(error);
    if (status === 403) {
      noPermission.value = true;
      permissionMessage.value = readErrorMessage(error, "当前账号无审核权限。");
      tasks.value = [];
      ElMessage.warning(permissionMessage.value);
    } else {
      ElMessage.error(readErrorMessage(error, "加载流程任务失败，请稍后重试。"));
    }
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  filters.type = "";
  filters.keyword = "";
  void loadTasks();
}

function goWorkflowNodes() {
  void router.push("/quality-reviews");
}

function openApproveDialog(row: WorkflowTask) {
  approveTaskRow.value = row;
  approveDialogVisible.value = true;
}

async function submitApprove() {
  const row = approveTaskRow.value;
  if (!row) {
    return;
  }
  submittingApprove.value = true;
  try {
    await approveTask(row.taskId);
    approveDialogVisible.value = false;
    approveTaskRow.value = null;
    ElMessage.success("审核已通过。");
    await loadTasks();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "审核通过失败。"));
  } finally {
    submittingApprove.value = false;
  }
}

function openRejectDialog(row: WorkflowTask) {
  rejectForm.taskId = row.taskId;
  rejectForm.remark = "";
  rejectDialogVisible.value = true;
}

async function submitReject() {
  if (!rejectForm.taskId) {
    return;
  }
  if (!rejectForm.remark.trim()) {
    ElMessage.warning("请填写整改要求。");
    return;
  }

  submittingReject.value = true;
  try {
    await rejectTask(rejectForm.taskId, rejectForm.remark.trim());
    rejectDialogVisible.value = false;
    ElMessage.success("任务已标记为需要整改。");
    await loadTasks();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "提交整改要求失败。"));
  } finally {
    submittingReject.value = false;
  }
}

function openDetail(row: WorkflowTask) {
  void router.push(toTaskDetailPath(row.taskType, row.bizId, row.taskId));
}

onMounted(() => {
  void loadTasks();
});
</script>

<style scoped>
.workflow-page {
  padding-top: 24px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-card {
  border: 1px solid rgba(31, 152, 122, 0.18);
  background: linear-gradient(102deg, rgba(45, 184, 146, 0.08), rgba(47, 110, 162, 0.06));
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
}

.task-table-card {
  background: linear-gradient(180deg, #ffffff, #fbfcfc);
}

.guide-list {
  margin: 0;
  padding-left: 20px;
  line-height: 1.8;
  color: var(--np-color-text-secondary);
}

.approve-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.approve-alert {
  border: 1px solid rgba(201, 136, 34, 0.22);
}

:deep(.el-table .cell) {
  line-height: 1.5;
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
