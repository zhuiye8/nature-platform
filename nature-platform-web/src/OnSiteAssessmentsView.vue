<template>
  <div class="page-shell page section-stack">
    <header class="page-header">
      <div class="page-title-group">
        <h2 class="page-title">{{ isExecutionMode ? "现场测评实施" : "现场测评结果" }}</h2>
        <p class="page-subtitle">
          {{
            isExecutionMode
              ? "测评人员维护现场测评附件与说明，提交后进入审核流程。"
              : "项目经理查看现场测评结果并发起提交审核。"
          }}
        </p>
      </div>
      <el-button
        v-permission="['page.on-site-assessment-executions', 'page.on-site-assessment-results']"
        :loading="loading"
        @click="loadRows"
      >
        刷新
      </el-button>
    </header>

    <el-card class="tip-card np-info-strip">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="现场测评在审核中不可编辑，仅当审核节点标记“需要整改”后允许修改并重新提交。"
      />
    </el-card>

    <el-card class="table-card">
      <el-table :data="rows" v-loading="loading" empty-text="暂无可处理项">
        <el-table-column prop="projectRegisterId" label="项目ID" width="100" />
        <el-table-column prop="applicationName" label="申请单名称" min-width="260" show-overflow-tooltip />
        <el-table-column label="测评附件" min-width="280" show-overflow-tooltip>
          <template #default="{ row }">
            <span>{{ evidencePreview(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="附件数" width="90">
          <template #default="{ row }">
            {{ row.evidenceFiles?.length || 0 }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusTagType(displayStatus(row))">{{ statusLabel(displayStatus(row)) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="workflowNode" label="流程节点" width="180" />
        <el-table-column prop="updatedAt" label="更新时间" min-width="180" />
        <el-table-column label="操作" width="300" fixed="right">
          <template #default="{ row }">
            <el-space>
              <el-button
                v-permission="['page.on-site-assessment-executions', 'page.on-site-assessment-results']"
                size="small"
                :disabled="!canEdit(row)"
                @click="openAssessmentDialog(row)"
              >
                编辑测评
              </el-button>
              <el-button
                v-permission="['page.on-site-assessment-executions', 'page.on-site-assessment-results']"
                size="small"
                type="success"
                :disabled="!canSubmit(row)"
                @click="submitRow(row)"
              >
                提交审核
              </el-button>
              <el-button size="small" @click="openTaskDetail(row.projectRegisterId)">详情</el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="assessmentDialogVisible" title="现场测评信息" width="760px">
      <el-form label-width="132px">
        <el-form-item label="项目ID">
          <el-input :model-value="assessmentForm.projectRegisterId" disabled />
        </el-form-item>
        <el-form-item label="测评附件" required>
          <el-input
            v-model="assessmentForm.evidenceFilesText"
            type="textarea"
            :rows="4"
            maxlength="4000"
            show-word-limit
            placeholder="每行一个对象键"
          />
          <div class="upload-row">
            <el-button
              v-permission="['page.on-site-assessment-executions', 'page.on-site-assessment-results']"
              :loading="uploading"
              @click="triggerUpload"
            >
              上传附件
            </el-button>
            <span class="upload-tip">上传后自动追加到文本框，每行一个对象键。</span>
          </div>
          <input ref="fileInputRef" type="file" class="hidden-file-input" @change="handleFileChange" />
        </el-form-item>
        <el-form-item label="现场测评结果说明">
          <el-input
            v-model="assessmentForm.assessmentRemark"
            type="textarea"
            :rows="4"
            maxlength="2000"
            show-word-limit
            placeholder="可选，记录现场测评结果与补充说明"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assessmentDialogVisible = false">取消</el-button>
        <el-button
          v-permission="['page.on-site-assessment-executions', 'page.on-site-assessment-results']"
          type="primary"
          :loading="savingAssessment"
          @click="saveAssessment"
        >
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * @input On-site assessment APIs, auth permissions, upload endpoint, and workflow context
 * @output Unified on-site assessment page supporting execution/result route modes with evidence-file upload and submit flow
 * @position On-site assessment stage page enforcing "under-review cannot edit" guardrails and unified resubmit entry
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useRoute, useRouter } from "vue-router";
import { apiClient, type ApiResponse } from "./api";
import {
  fetchOnSiteAssessmentDetail,
  fetchOnSiteAssessments,
  saveOnSiteAssessment,
  submitOnSiteAssessment,
  type OnSiteAssessmentMode,
  type OnSiteAssessmentRecord
} from "./on-site-assessment-service";
import { toTaskDetailPath } from "./task-detail-service";

interface UploadResponse {
  objectKey: string;
}

interface AssessmentFormState {
  projectRegisterId: number;
  evidenceFilesText: string;
  assessmentRemark: string;
}

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const savingAssessment = ref(false);
const uploading = ref(false);
const assessmentDialogVisible = ref(false);
const rows = ref<OnSiteAssessmentRecord[]>([]);
const fileInputRef = ref<HTMLInputElement | null>(null);

const assessmentForm = reactive<AssessmentFormState>({
  projectRegisterId: 0,
  evidenceFilesText: "",
  assessmentRemark: ""
});

const isExecutionMode = computed(() => route.path.includes("/on-site-assessment-executions"));
const mode = computed<OnSiteAssessmentMode>(() => (isExecutionMode.value ? "execution" : "result"));

function statusLabel(status?: string) {
  if (status === "REJECTED") return "待整改";
  if (status === "SUBMITTED" || status === "PENDING") return "待审核";
  if (status === "APPROVED") return "已通过";
  if (status === "DRAFT") return "草稿";
  return status || "草稿";
}

function statusTagType(status?: string) {
  if (status === "REJECTED") return "warning";
  if (status === "SUBMITTED" || status === "PENDING") return "warning";
  if (status === "APPROVED") return "success";
  return "info";
}

function readErrorMessage(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof message === "string" && message.trim() ? message : fallback;
}

function listToText(values: string[] | undefined) {
  return (values || []).join("\n");
}

function textToList(value: string) {
  const items =
    value
      ?.split(/\r?\n/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0) || [];
  return Array.from(new Set(items));
}

function evidencePreview(row: OnSiteAssessmentRecord) {
  const files = row.evidenceFiles || [];
  if (files.length === 0) {
    return "-";
  }
  if (files.length === 1) {
    return files[0];
  }
  return `${files[0]} 等 ${files.length} 个附件`;
}

function fillAssessmentForm(row: OnSiteAssessmentRecord) {
  assessmentForm.projectRegisterId = row.projectRegisterId;
  assessmentForm.evidenceFilesText = listToText(row.evidenceFiles);
  assessmentForm.assessmentRemark = row.assessmentRemark || row.assessmentDetail || "";
}

function isRectification(row: OnSiteAssessmentRecord) {
  return row.workflowStatus === "REJECTED";
}

function displayStatus(row: OnSiteAssessmentRecord) {
  return isRectification(row) ? "REJECTED" : row.status;
}

function canEdit(row: OnSiteAssessmentRecord) {
  if (row.status !== "SUBMITTED") {
    return true;
  }
  return isRectification(row);
}

function canSubmit(row: OnSiteAssessmentRecord) {
  return canEdit(row) && (row.evidenceFiles?.length || 0) > 0;
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
    const objectKey = response.data.data.objectKey;
    const next = textToList([assessmentForm.evidenceFilesText, objectKey].filter(Boolean).join("\n"));
    assessmentForm.evidenceFilesText = next.join("\n");
    ElMessage.success("上传成功，已追加对象键");
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "上传附件失败"));
  } finally {
    uploading.value = false;
    input.value = "";
  }
}

async function loadRows() {
  loading.value = true;
  try {
    rows.value = await fetchOnSiteAssessments(mode.value);
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "加载现场测评列表失败"));
  } finally {
    loading.value = false;
  }
}

async function openAssessmentDialog(row: OnSiteAssessmentRecord) {
  try {
    const detail = await fetchOnSiteAssessmentDetail(row.projectRegisterId);
    fillAssessmentForm(detail);
  } catch {
    fillAssessmentForm(row);
  }
  assessmentDialogVisible.value = true;
}

async function saveAssessment() {
  if (!assessmentForm.projectRegisterId) {
    return;
  }
  const evidenceFiles = textToList(assessmentForm.evidenceFilesText);
  if (evidenceFiles.length === 0) {
    ElMessage.warning("请至少上传一个测评附件");
    return;
  }

  savingAssessment.value = true;
  try {
    await saveOnSiteAssessment(assessmentForm.projectRegisterId, {
      evidenceFiles,
      packageObjectKey: evidenceFiles[0],
      assessmentRemark: assessmentForm.assessmentRemark.trim(),
      assessmentDetail: assessmentForm.assessmentRemark.trim()
    });
    ElMessage.success("现场测评草稿已保存");
    assessmentDialogVisible.value = false;
    await loadRows();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "保存现场测评失败"));
  } finally {
    savingAssessment.value = false;
  }
}

async function submitRow(row: OnSiteAssessmentRecord) {
  try {
    await ElMessageBox.confirm(`确认提交项目 ${row.projectRegisterId} 的现场测评吗？`, "提交确认", {
      type: "warning",
      confirmButtonText: "确认",
      cancelButtonText: "取消"
    });
  } catch {
    return;
  }

  try {
    await submitOnSiteAssessment(row.projectRegisterId);
    ElMessage.success("现场测评已提交");
    await loadRows();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "提交审核失败"));
  }
}

function openTaskDetail(projectId: number) {
  void router.push(toTaskDetailPath("PROJECT_REGISTER", projectId));
}

onMounted(() => {
  void loadRows();
});
</script>

<style scoped>
.page {
  padding-top: 24px;
}

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

@media (max-width: 900px) {
  .upload-row {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
