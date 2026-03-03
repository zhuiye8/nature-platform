<template>
  <div class="page-shell page section-stack">
    <header class="page-header">
      <div>
        <h2>报告编制任务分配</h2>
        <p>节点 13：分配单人编制任务，提交后进入报告编制上传</p>
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
        title="每个项目仅分配 1 名编制人；建议保存后再提交进入下一节点。"
      />
    </el-card>

    <el-card class="table-card">
      <el-table :data="rows" v-loading="loading" empty-text="暂无可处理项">
        <el-table-column prop="projectRegisterId" label="项目ID" width="90" />
        <el-table-column prop="applicationName" label="申请单名称" min-width="240" show-overflow-tooltip />
        <el-table-column prop="onSitePackageObjectKey" label="现场测评压缩" min-width="260" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.onSitePackageObjectKey || "-" }}
          </template>
        </el-table-column>
        <el-table-column prop="assignee" label="编制人" width="130">
          <template #default="{ row }">
            {{ row.assignee || "-" }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="versionNo" label="版本" width="90" />
        <el-table-column prop="workflowNode" label="流程节点" width="180" show-overflow-tooltip />
        <el-table-column label="操作" width="340" fixed="right">
          <template #default="{ row }">
            <el-space>
              <el-button
                v-permission="'report-compile-assignment:save'"
                size="small"
                @click="openDialog(row)"
              >
                编辑分配
              </el-button>
              <el-button
                v-permission="'report-compile-assignment:submit'"
                size="small"
                type="success"
                :disabled="!canSubmit(row)"
                @click="submitRow(row)"
              >
                提交分配
              </el-button>
              <el-button size="small" @click="openEntityDetail(row.projectRegisterId)">业务详情</el-button>
              <el-button size="small" @click="openTaskDetail(row.projectRegisterId)">审核详情</el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" title="编制任务分配" width="620px">
      <el-form label-width="120px">
        <el-form-item label="项目ID">
          <el-input :model-value="form.projectRegisterId" disabled />
        </el-form-item>
        <el-form-item label="编制" required>
          <el-select v-model="form.assignee" style="width: 100%" filterable>
            <el-option v-for="user in candidates" :key="user" :label="user" :value="user" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button
          v-permission="'report-compile-assignment:save'"
          type="primary"
          :loading="saving"
          @click="saveForm"
        >
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * @input Report compile assignment APIs, permission helper, conditional candidate pool query, and router navigation for node-13 actions
 * @output Node-13 assignment board supporting permission-gated assignee save/submit transitions
 * @position Report compile assignment page connecting review completion and compile submission stages with button-level RBAC
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useRouter } from "vue-router";
import { hasPermission } from "./permission";
import {
  fetchReportCompileAssignments,
  fetchReportCompileCandidates,
  saveReportCompileAssignment,
  submitReportCompileAssignment,
  type ReportCompileAssignmentRecord
} from "./report-compile-service";
import { toTaskDetailPath } from "./task-detail-service";

interface FormState {
  projectRegisterId: number;
  assignee: string;
  versionNo: number;
}

const router = useRouter();
const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const rows = ref<ReportCompileAssignmentRecord[]>([]);
const candidates = ref<string[]>([]);
const canLoadCandidates = computed(() =>
  hasPermission("report-compile-assignment:candidate:view")
);

const form = reactive<FormState>({
  projectRegisterId: 0,
  assignee: "",
  versionNo: 0
});

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

function readErrorMessage(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof message === "string" && message.trim().length > 0 ? message : fallback;
}

function canSubmit(row: ReportCompileAssignmentRecord) {
  return !!row.assignee && row.status !== "SUBMITTED";
}

async function loadRows() {
  loading.value = true;
  try {
    const [list, users] = await Promise.all([
      fetchReportCompileAssignments(),
      canLoadCandidates.value ? fetchReportCompileCandidates() : Promise.resolve([])
    ]);
    rows.value = list;
    candidates.value = users;
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "加载报告编制分配失败"));
  } finally {
    loading.value = false;
  }
}

function openDialog(row: ReportCompileAssignmentRecord) {
  form.projectRegisterId = row.projectRegisterId;
  form.assignee = row.assignee || "";
  form.versionNo = row.versionNo || 0;
  dialogVisible.value = true;
}

async function saveForm() {
  if (!form.projectRegisterId) {
    return;
  }
  if (!form.assignee.trim()) {
    ElMessage.warning("请选择编制");
    return;
  }
  saving.value = true;
  try {
    await saveReportCompileAssignment(form.projectRegisterId, {
      assignee: form.assignee.trim(),
      versionNo: form.versionNo
    });
    ElMessage.success("编制任务分配已保存");
    dialogVisible.value = false;
    await loadRows();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "保存编制任务分配失败"));
  } finally {
    saving.value = false;
  }
}

async function submitRow(row: ReportCompileAssignmentRecord) {
  try {
    await ElMessageBox.confirm(
      `确认提交项目 ${row.projectRegisterId} 的报告编制分配吗？`,
      "提交确认",
      {
        type: "warning",
        confirmButtonText: "确认",
        cancelButtonText: "取消"
      }
    );
  } catch {
    return;
  }

  try {
    await submitReportCompileAssignment(row.projectRegisterId);
    ElMessage.success("编制任务分配已提交");
    await loadRows();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "提交编制任务分配失败"));
  }
}

function goWorkflow() {
  void router.push("/workflow");
}

function openTaskDetail(projectId: number) {
  void router.push(toTaskDetailPath("PROJECT_REGISTER", projectId));
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
