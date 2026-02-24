<template>
  <div class="page-shell page section-stack">
    <header class="page-header">
      <div>
        <h2>报告编制任务分配</h2>
        <p>节点 13：分配单人编制任务，提交后进入报告编制上传</p>
      </div>
      <el-space>
        <el-button :loading="loading" @click="loadRows">刷新</el-button>
        <el-button type="primary" @click="goWorkflow">打开待办审批</el-button>
      </el-space>
    </header>

    <el-card>
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
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-space>
              <el-button size="small" @click="openDialog(row)">编辑分配</el-button>
              <el-button
                size="small"
                type="success"
                :disabled="!canSubmit(row)"
                @click="submitRow(row)"
              >
                提交分配
              </el-button>
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
        <el-button type="primary" :loading="saving" @click="saveForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * @input Report compile assignment APIs, candidate pool query, and router navigation for node-13 actions
 * @output Node-13 assignment board supporting assignee save and submit transitions
 * @position Report compile assignment page connecting review completion and compile submission stages
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useRouter } from "vue-router";
import {
  fetchReportCompileAssignments,
  fetchReportCompileCandidates,
  saveReportCompileAssignment,
  submitReportCompileAssignment,
  type ReportCompileAssignmentRecord
} from "./report-compile-service";

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
      fetchReportCompileCandidates()
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

onMounted(() => {
  void loadRows();
});
</script>

<style scoped>
.page {
  max-width: 1320px;
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
