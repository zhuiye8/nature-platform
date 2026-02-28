<template>
  <div class="page-shell page section-stack">
    <header class="page-header">
      <div class="page-title-group">
        <h2 class="page-title">现场测评实施</h2>
        <p class="page-subtitle">节点 8：上传现场测评 ZIP，配置审核人并统一发起审核流程；整改后在本页修订重提。</p>
      </div>
      <el-button v-permission="'on-site-assessment:view'" :loading="loading" @click="loadRows">刷新</el-button>
    </header>

    <el-card class="tip-card np-info-strip">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="提交审核入口统一在现场测评：首次提交进入技术审核，整改后将直达触发整改的审核节点。"
      />
    </el-card>

    <el-card class="table-card">
      <el-table :data="rows" v-loading="loading" empty-text="暂无可处理项目">
        <el-table-column prop="projectRegisterId" label="项目ID" width="100" />
        <el-table-column prop="applicationName" label="申请单名称" min-width="260" show-overflow-tooltip />
        <el-table-column prop="packageObjectKey" label="测评压缩包" min-width="280" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.packageObjectKey || "-" }}
          </template>
        </el-table-column>
        <el-table-column label="审核人分配" min-width="360" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="assignment-line">报告技术：{{ row.techReviewer || "-" }}</div>
            <div class="assignment-line">
              内容技术/管理/网络：
              {{ `${row.contentReviewerTech || "-"}/${row.contentReviewerManagement || "-"}/${row.contentReviewerNetwork || "-"}` }}
            </div>
            <div v-if="row.rectificationNode" class="assignment-line rectification-line">
              整改节点：{{ rectificationNodeLabel(row.rectificationNode) }}
            </div>
            <div v-if="row.rectificationRemark" class="assignment-line rectification-line">
              整改要求：{{ row.rectificationRemark }}
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusTagType(displayStatus(row))">{{ statusLabel(displayStatus(row)) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="workflowNode" label="流程节点" width="180" />
        <el-table-column label="操作" width="420" fixed="right">
          <template #default="{ row }">
            <el-space>
              <el-button v-permission="'on-site-assessment:save'" size="small" @click="openAssessmentDialog(row)">
                编辑测评
              </el-button>
              <el-button
                v-permission="'on-site-assessment:assign'"
                size="small"
                :disabled="!canAssign(row)"
                @click="openAssignDialog(row)"
              >
                分配审核人
              </el-button>
              <el-button
                v-permission="'on-site-assessment:submit'"
                size="small"
                type="success"
                :disabled="!canSubmit(row)"
                @click="submitRow(row)"
              >
                提交审核
              </el-button>
              <el-button size="small" @click="openProcessOverview(row.projectRegisterId)">流程详情</el-button>
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
            <el-button v-permission="'on-site-assessment:save'" :loading="uploading" @click="triggerUpload">
              上传 ZIP
            </el-button>
            <span class="upload-tip">仅允许 .zip，上传后自动回填对象键。</span>
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
            placeholder="可选，记录现场测评过程说明"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assessmentDialogVisible = false">取消</el-button>
        <el-button v-permission="'on-site-assessment:save'" type="primary" :loading="savingAssessment" @click="saveAssessment">
          保存
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="assignDialogVisible" title="分配审核人" width="680px">
      <el-alert
        type="warning"
        :closable="false"
        show-icon
        title="四个角色必须全部选择后才允许保存分配。"
      />
      <el-form label-width="150px" class="assign-form">
        <el-form-item label="项目ID">
          <el-input :model-value="assignForm.projectRegisterId" disabled />
        </el-form-item>
        <el-form-item label="报告技术审核" required>
          <el-select v-model="assignForm.techReviewer" style="width: 100%" filterable>
            <el-option v-for="user in candidates.techReviewers" :key="`tech-${user}`" :label="user" :value="user" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容审核-技术" required>
          <el-select v-model="assignForm.contentReviewerTech" style="width: 100%" filterable>
            <el-option
              v-for="user in candidates.contentReviewersTech"
              :key="`content-tech-${user}`"
              :label="user"
              :value="user"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="内容审核-管理" required>
          <el-select v-model="assignForm.contentReviewerManagement" style="width: 100%" filterable>
            <el-option
              v-for="user in candidates.contentReviewersManagement"
              :key="`content-management-${user}`"
              :label="user"
              :value="user"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="内容审核-网络" required>
          <el-select v-model="assignForm.contentReviewerNetwork" style="width: 100%" filterable>
            <el-option
              v-for="user in candidates.contentReviewersNetwork"
              :key="`content-network-${user}`"
              :label="user"
              :value="user"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignDialogVisible = false">取消</el-button>
        <el-button
          v-permission="'on-site-assessment:assign'"
          type="primary"
          :loading="savingAssign"
          @click="saveAssign"
        >
          保存分配
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * @input On-site assessment APIs, reviewer candidate pools, auth permissions, upload endpoint, and workflow context
 * @output Node-8 implementation UI with permission-aware ZIP upload, reviewer assignment, and rectification-aware submit routing
 * @position On-site assessment stage page enforcing ZIP-first guardrails and acting as the unified review submission/rework entry
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useRouter } from "vue-router";
import { apiClient, type ApiResponse } from "./api";
import { useAuthStore } from "./auth-store";
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
import { toProcessOverviewPath } from "./process-overview-service";

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
  contentReviewerTech: string;
  contentReviewerManagement: string;
  contentReviewerNetwork: string;
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
  contentReviewersTech: [],
  contentReviewersManagement: [],
  contentReviewersNetwork: []
});
const fileInputRef = ref<HTMLInputElement | null>(null);
const authStore = useAuthStore();
const router = useRouter();

const assessmentForm = reactive<AssessmentFormState>({
  projectRegisterId: 0,
  packageObjectKey: "",
  assessmentDetail: ""
});

const assignForm = reactive<AssignFormState>({
  projectRegisterId: 0,
  techReviewer: "",
  contentReviewerTech: "",
  contentReviewerManagement: "",
  contentReviewerNetwork: "",
  versionNo: 0
});

function statusLabel(status?: string) {
  if (status === "REJECTED") return "待整改";
  if (status === "SUBMITTED") return "已提交";
  if (status === "DRAFT") return "草稿";
  return status || "草稿";
}

function statusTagType(status?: string) {
  if (status === "REJECTED") return "warning";
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
  assignForm.contentReviewerTech = row.contentReviewerTech || "";
  assignForm.contentReviewerManagement = row.contentReviewerManagement || "";
  assignForm.contentReviewerNetwork = row.contentReviewerNetwork || "";
  assignForm.versionNo = row.assignmentVersionNo || 0;
}

function hasZip(row: OnSiteAssessmentRecord) {
  return !!row.packageObjectKey && row.packageObjectKey.toLowerCase().endsWith(".zip");
}

function hasAllReviewers(row: OnSiteAssessmentRecord) {
  return (
    !!row.techReviewer &&
    !!row.contentReviewerTech &&
    !!row.contentReviewerManagement &&
    !!row.contentReviewerNetwork
  );
}

function isRectification(row: OnSiteAssessmentRecord) {
  return row.workflowStatus === "REJECTED";
}

function displayStatus(row: OnSiteAssessmentRecord) {
  return isRectification(row) ? "REJECTED" : row.status;
}

function canAssign(row: OnSiteAssessmentRecord) {
  return (row.status !== "SUBMITTED" || isRectification(row)) && hasZip(row);
}

function canSubmit(row: OnSiteAssessmentRecord) {
  return (row.status !== "SUBMITTED" || isRectification(row)) && hasZip(row) && hasAllReviewers(row);
}

function rectificationNodeLabel(node?: string) {
  if (node === "REPORT_TECH_REVIEW_TASK") return "技术审核";
  if (node === "REPORT_CONTENT_REVIEW_TASK") return "内容审核";
  if (node === "REPORT_FINAL_REVIEW_TASK") return "最终审核";
  return node || "-";
}

function submitTargetLabel(row: OnSiteAssessmentRecord) {
  if (row.rectificationNode) {
    return rectificationNodeLabel(row.rectificationNode);
  }
  return "技术审核";
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
    rows.value = await fetchOnSiteAssessments();
    if (
      authStore.hasPermission("on-site-assessment:assign") ||
      authStore.hasPermission("on-site-assessment:candidate:view")
    ) {
      candidates.value = await fetchOnSiteAssessmentReviewerCandidates();
    } else {
      candidates.value = {
        techReviewers: [],
        contentReviewersTech: [],
        contentReviewersManagement: [],
        contentReviewersNetwork: []
      };
    }
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
    !assignForm.contentReviewerTech ||
    !assignForm.contentReviewerManagement ||
    !assignForm.contentReviewerNetwork
  ) {
    ElMessage.warning("请完整选择报告技术与内容（技术/管理/网络）审核人");
    return;
  }
  savingAssign.value = true;
  try {
    await saveOnSiteReviewAssignment(assignForm.projectRegisterId, {
      techReviewer: assignForm.techReviewer,
      contentReviewerTech: assignForm.contentReviewerTech,
      contentReviewerManagement: assignForm.contentReviewerManagement,
      contentReviewerNetwork: assignForm.contentReviewerNetwork,
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
  const targetLabel = submitTargetLabel(row);
  try {
    await ElMessageBox.confirm(
      `确认提交项目 ${row.projectRegisterId} 的现场测评吗？提交后将进入${targetLabel}。`,
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
    ElMessage.success(`现场测评已提交，流程已进入${targetLabel}`);
    await loadRows();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "提交审核失败"));
  }
}

function openProcessOverview(projectId: number) {
  void router.push(toProcessOverviewPath(projectId));
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

.assignment-line {
  line-height: 1.6;
  color: var(--np-color-text-secondary);
}

.rectification-line {
  color: #c87a1f;
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
