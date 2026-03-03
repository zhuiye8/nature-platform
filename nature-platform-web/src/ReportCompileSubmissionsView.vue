<template>
  <div class="page-shell page section-stack">
    <header class="page-header">
      <div>
        <h2>报告编制与上传</h2>
        <p>节点 14：编制人上传报告文件并提交，流程进入最终审核。</p>
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
        title="建议先上传并保存草稿，再执行提交；提交后系统会根据最终审核节点规则自动创建待办。"
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
        <el-table-column prop="assignee" label="编制人" width="120">
          <template #default="{ row }">
            {{ row.assignee || "-" }}
          </template>
        </el-table-column>
        <el-table-column prop="reportObjectKey" label="报告对象键" min-width="260" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.reportObjectKey || "-" }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="workflowNode" label="流程节点" width="180" show-overflow-tooltip />
        <el-table-column label="操作" width="340" fixed="right">
          <template #default="{ row }">
            <el-space>
              <el-button v-permission="'report-compile-submission:save'" size="small" @click="openDialog(row)">
                编辑
              </el-button>
              <el-button
                v-permission="'report-compile-submission:submit'"
                size="small"
                type="success"
                :disabled="!canSubmit(row)"
                @click="submitRow(row)"
              >
                提交报告
              </el-button>
              <el-button size="small" @click="openEntityDetail(row.projectRegisterId)">业务详情</el-button>
              <el-button size="small" @click="openTaskDetail(row.projectRegisterId)">审核详情</el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" title="报告编制上传" width="760px">
      <el-form label-width="132px">
        <el-form-item label="项目ID">
          <el-input :model-value="form.projectRegisterId" disabled />
        </el-form-item>
        <el-form-item label="报告文件对象" required>
          <el-input v-model="form.reportObjectKey" placeholder="请上传文件或填写对象键" />
          <div class="upload-row">
            <el-button
              v-permission="'report-compile-submission:save'"
              :loading="uploading"
              @click="triggerUpload"
            >
              上传报告文件
            </el-button>
            <span class="upload-tip">上传后自动回填对象键</span>
          </div>
          <input ref="fileInputRef" type="file" class="hidden-file-input" @change="handleFileChange" />
        </el-form-item>
        <el-form-item label="编制备注">
          <el-input
            v-model="form.reportRemark"
            type="textarea"
            :rows="4"
            maxlength="2000"
            show-word-limit
            placeholder="请输入编制备注"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button
          v-permission="'report-compile-submission:save'"
          type="primary"
          :loading="saving"
          @click="saveForm"
        >
          保存草稿
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * @input Report compile submission APIs, upload endpoint, and router navigation for node-14 operations
 * @output Node-14 compile/upload board with permission-gated draft save, file upload, and submit actions
 * @position Report compile submission page bridging compile output and final-review task creation
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useRouter } from "vue-router";
import { apiClient, type ApiResponse } from "./api";
import {
  fetchReportCompileSubmissionDetail,
  fetchReportCompileSubmissions,
  saveReportCompileSubmission,
  submitReportCompileSubmission,
  type ReportCompileSubmissionRecord
} from "./report-compile-service";
import { toTaskDetailPath } from "./task-detail-service";

interface UploadResponse {
  objectKey: string;
}

interface FormState {
  projectRegisterId: number;
  reportObjectKey: string;
  reportRemark: string;
}

const router = useRouter();
const loading = ref(false);
const saving = ref(false);
const uploading = ref(false);
const dialogVisible = ref(false);
const rows = ref<ReportCompileSubmissionRecord[]>([]);
const fileInputRef = ref<HTMLInputElement | null>(null);

const form = reactive<FormState>({
  projectRegisterId: 0,
  reportObjectKey: "",
  reportRemark: ""
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

function canSubmit(row: ReportCompileSubmissionRecord) {
  return !!row.reportObjectKey && row.status !== "SUBMITTED";
}

function triggerUpload() {
  fileInputRef.value?.click();
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) {
    return;
  }
  const formData = new FormData();
  formData.append("file", file);
  uploading.value = true;
  try {
    const response = await apiClient.post<ApiResponse<UploadResponse>>("/files/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    });
    form.reportObjectKey = response.data.data.objectKey;
    ElMessage.success("文件上传成功，已回填对象键");
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "上传文件失败"));
  } finally {
    uploading.value = false;
    input.value = "";
  }
}

async function loadRows() {
  loading.value = true;
  try {
    rows.value = await fetchReportCompileSubmissions();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "加载报告编制列表失败"));
  } finally {
    loading.value = false;
  }
}

async function openDialog(row: ReportCompileSubmissionRecord) {
  try {
    const detail = await fetchReportCompileSubmissionDetail(row.projectRegisterId);
    form.projectRegisterId = detail.projectRegisterId;
    form.reportObjectKey = detail.reportObjectKey || "";
    form.reportRemark = detail.reportRemark || "";
  } catch {
    form.projectRegisterId = row.projectRegisterId;
    form.reportObjectKey = row.reportObjectKey || "";
    form.reportRemark = row.reportRemark || "";
  }
  dialogVisible.value = true;
}

async function saveForm() {
  if (!form.projectRegisterId) {
    return;
  }
  saving.value = true;
  try {
    await saveReportCompileSubmission(form.projectRegisterId, {
      reportObjectKey: form.reportObjectKey.trim(),
      reportRemark: form.reportRemark.trim()
    });
    ElMessage.success("报告编制草稿已保存");
    dialogVisible.value = false;
    await loadRows();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "保存报告编制失败"));
  } finally {
    saving.value = false;
  }
}

async function submitRow(row: ReportCompileSubmissionRecord) {
  try {
    await ElMessageBox.confirm(
      `确认提交项目 ${row.projectRegisterId} 的报告编制吗？`,
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
    await submitReportCompileSubmission(row.projectRegisterId);
    ElMessage.success("报告编制已提交");
    await loadRows();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "提交报告编制失败"));
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

.upload-row {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.upload-tip {
  font-size: 12px;
  color: var(--np-color-text-muted);
}

.hidden-file-input {
  display: none;
}
</style>
