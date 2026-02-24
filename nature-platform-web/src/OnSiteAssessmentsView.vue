<template>
  <div class="page-shell page section-stack">
    <header class="page-header">
      <div class="page-title-group">
        <h2 class="page-title">现场测评实施</h2>
        <p class="page-subtitle">节点 8：上传现场测评 ZIP，配置技术审核 + 内容 A/B/C 审核人。</p>
      </div>
      <el-button :loading="loading" @click="loadRows">刷新</el-button>
    </header>

    <el-card class="tip-card">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="仅在上传 ZIP 压缩包后允许分配审核人；提交后将直接进入报告技术审核。"
      />
    </el-card>

    <el-card>
      <el-table :data="rows" v-loading="loading" empty-text="暂无可处理项目">
        <el-table-column prop="projectRegisterId" label="项目ID" width="100" />
        <el-table-column prop="applicationName" label="申请单名称" min-width="260" show-overflow-tooltip />
        <el-table-column prop="packageObjectKey" label="测评压缩包" min-width="260" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.packageObjectKey || "-" }}
          </template>
        </el-table-column>
        <el-table-column label="审核人分配" min-width="280" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="assignment-line">技术：{{ row.techReviewer || "-" }}</div>
            <div class="assignment-line">
              内容 A/B/C：{{ `${row.contentReviewerA || "-"}/${row.contentReviewerB || "-"}/${row.contentReviewerC || "-"}` }}
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="workflowNode" label="流程节点" width="180" />
        <el-table-column label="操作" width="340" fixed="right">
          <template #default="{ row }">
            <el-space>
              <el-button size="small" @click="openAssessmentDialog(row)">编辑测评</el-button>
              <el-button size="small" :disabled="!canAssign(row)" @click="openAssignDialog(row)">
                分配审核人
              </el-button>
              <el-button size="small" type="success" :disabled="!canSubmit(row)" @click="submitRow(row)">
                提交
              </el-button>
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
        <el-form-item label="测评压缩包" required>
          <el-input v-model="assessmentForm.packageObjectKey" placeholder="请上传 ZIP 或粘贴对象键" />
          <div class="upload-row">
            <el-button :loading="uploading" @click="triggerUpload">上传 ZIP</el-button>
            <span class="upload-tip">仅允许 .zip，上传后自动回填对象键</span>
          </div>
          <input
            ref="fileInputRef"
            type="file"
            accept=".zip"
            class="hidden-file-input"
            @change="handleFileChange"
          />
        </el-form-item>
        <el-form-item label="实施说明">
          <el-input
            v-model="assessmentForm.assessmentDetail"
            type="textarea"
            :rows="4"
            maxlength="2000"
            show-word-limit
            placeholder="可选"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assessmentDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingAssessment" @click="saveAssessment">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="assignDialogVisible" title="分配审核人" width="640px">
      <el-alert type="warning" :closable="false" show-icon title="四个角色必须全部选择后才允许保存分配。" />
      <el-form label-width="130px" class="assign-form">
        <el-form-item label="项目ID">
          <el-input :model-value="assignForm.projectRegisterId" disabled />
        </el-form-item>
        <el-form-item label="技术审核" required>
          <el-select v-model="assignForm.techReviewer" style="width: 100%" filterable>
            <el-option v-for="user in candidates.techReviewers" :key="`tech-${user}`" :label="user" :value="user" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容审核 A" required>
          <el-select v-model="assignForm.contentReviewerA" style="width: 100%" filterable>
            <el-option v-for="user in candidates.contentReviewersA" :key="`a-${user}`" :label="user" :value="user" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容审核 B" required>
          <el-select v-model="assignForm.contentReviewerB" style="width: 100%" filterable>
            <el-option v-for="user in candidates.contentReviewersB" :key="`b-${user}`" :label="user" :value="user" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容审核 C" required>
          <el-select v-model="assignForm.contentReviewerC" style="width: 100%" filterable>
            <el-option v-for="user in candidates.contentReviewersC" :key="`c-${user}`" :label="user" :value="user" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingAssign" @click="saveAssign">保存分配</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * @input On-site assessment APIs, reviewer candidate pools, upload endpoint, and workflow navigation context
 * @output Node-8 implementation UI for ZIP upload, four-role assignment, and submit transition actions
 * @position On-site assessment stage page enforcing ZIP-first and complete reviewer assignment guardrails
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { apiClient, type ApiResponse } from "./api";
import {
  fetchOnSiteAssessmentDetail,
  fetchOnSiteAssessmentReviewerCandidates,
  fetchOnSiteAssessments,
  saveOnSiteAssessment,
  saveOnSiteReviewAssignment,
  submitOnSiteAssessment,
  type OnSiteAssessmentRecord,
  type ReviewerCandidates
} from "./on-site-assessment-service";

interface UploadResponse {
  objectKey: string;
}

interface AssessmentFormState {
  projectRegisterId: number;
  packageObjectKey: string;
  assessmentDetail: string;
}

interface AssignFormState {
  projectRegisterId: number;
  techReviewer: string;
  contentReviewerA: string;
  contentReviewerB: string;
  contentReviewerC: string;
  versionNo: number;
}

const loading = ref(false);
const savingAssessment = ref(false);
const savingAssign = ref(false);
const uploading = ref(false);
const assessmentDialogVisible = ref(false);
const assignDialogVisible = ref(false);
const rows = ref<OnSiteAssessmentRecord[]>([]);
const candidates = ref<ReviewerCandidates>({
  techReviewers: [],
  contentReviewersA: [],
  contentReviewersB: [],
  contentReviewersC: []
});
const fileInputRef = ref<HTMLInputElement | null>(null);

const assessmentForm = reactive<AssessmentFormState>({
  projectRegisterId: 0,
  packageObjectKey: "",
  assessmentDetail: ""
});

const assignForm = reactive<AssignFormState>({
  projectRegisterId: 0,
  techReviewer: "",
  contentReviewerA: "",
  contentReviewerB: "",
  contentReviewerC: "",
  versionNo: 0
});

function statusLabel(status?: string) {
  if (status === "SUBMITTED") return "已提交";
  if (status === "DRAFT") return "草稿";
  return status || "草稿";
}

function statusTagType(status?: string) {
  if (status === "SUBMITTED") return "success";
  return "info";
}

function readErrorMessage(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof message === "string" && message.trim() ? message : fallback;
}

function fillAssessmentForm(row: OnSiteAssessmentRecord) {
  assessmentForm.projectRegisterId = row.projectRegisterId;
  assessmentForm.packageObjectKey = row.packageObjectKey || "";
  assessmentForm.assessmentDetail = row.assessmentDetail || "";
}

function fillAssignForm(row: OnSiteAssessmentRecord) {
  assignForm.projectRegisterId = row.projectRegisterId;
  assignForm.techReviewer = row.techReviewer || "";
  assignForm.contentReviewerA = row.contentReviewerA || "";
  assignForm.contentReviewerB = row.contentReviewerB || "";
  assignForm.contentReviewerC = row.contentReviewerC || "";
  assignForm.versionNo = row.assignmentVersionNo || 0;
}

function hasZip(row: OnSiteAssessmentRecord) {
  return !!row.packageObjectKey && row.packageObjectKey.toLowerCase().endsWith(".zip");
}

function hasAllReviewers(row: OnSiteAssessmentRecord) {
  return !!row.techReviewer && !!row.contentReviewerA && !!row.contentReviewerB && !!row.contentReviewerC;
}

function canAssign(row: OnSiteAssessmentRecord) {
  return row.status !== "SUBMITTED" && hasZip(row);
}

function canSubmit(row: OnSiteAssessmentRecord) {
  return row.status !== "SUBMITTED" && hasZip(row) && hasAllReviewers(row);
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
  const isZip = file.name.toLowerCase().endsWith(".zip");
  if (!isZip) {
    ElMessage.warning("仅支持上传 ZIP 压缩包");
    input.value = "";
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
    assessmentForm.packageObjectKey = response.data.data.objectKey;
    ElMessage.success("上传成功，已回填对象键");
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "上传 ZIP 失败"));
  } finally {
    uploading.value = false;
    input.value = "";
  }
}

async function loadRows() {
  loading.value = true;
  try {
    const [list, users] = await Promise.all([
      fetchOnSiteAssessments(),
      fetchOnSiteAssessmentReviewerCandidates()
    ]);
    rows.value = list;
    candidates.value = users;
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

function openAssignDialog(row: OnSiteAssessmentRecord) {
  fillAssignForm(row);
  assignDialogVisible.value = true;
}

async function saveAssessment() {
  if (!assessmentForm.projectRegisterId) {
    return;
  }
  savingAssessment.value = true;
  try {
    await saveOnSiteAssessment(assessmentForm.projectRegisterId, {
      packageObjectKey: assessmentForm.packageObjectKey.trim(),
      assessmentDetail: assessmentForm.assessmentDetail.trim()
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

async function saveAssign() {
  if (!assignForm.projectRegisterId) {
    return;
  }
  if (
    !assignForm.techReviewer ||
    !assignForm.contentReviewerA ||
    !assignForm.contentReviewerB ||
    !assignForm.contentReviewerC
  ) {
    ElMessage.warning("请完整选择技术与内容 A/B/C 审核人");
    return;
  }
  savingAssign.value = true;
  try {
    await saveOnSiteReviewAssignment(assignForm.projectRegisterId, {
      techReviewer: assignForm.techReviewer,
      contentReviewerA: assignForm.contentReviewerA,
      contentReviewerB: assignForm.contentReviewerB,
      contentReviewerC: assignForm.contentReviewerC,
      versionNo: assignForm.versionNo
    });
    ElMessage.success("审核人分配已保存");
    assignDialogVisible.value = false;
    await loadRows();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "保存审核人分配失败"));
  } finally {
    savingAssign.value = false;
  }
}

async function submitRow(row: OnSiteAssessmentRecord) {
  try {
    await ElMessageBox.confirm(
      `确认提交项目 ${row.projectRegisterId} 的现场测评吗？提交后将进入报告技术审核。`,
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
    await submitOnSiteAssessment(row.projectRegisterId);
    ElMessage.success("现场测评已提交，流程已进入报告技术审核");
    await loadRows();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "提交现场测评失败"));
  }
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
  background: linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
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

.assignment-line {
  line-height: 1.6;
}

.assign-form {
  margin-top: 12px;
}

:deep(.el-alert) {
  margin-bottom: 6px;
}

@media (max-width: 900px) {
  .upload-row {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
