<template>
  <div class="page-shell page section-stack">
    <header class="page-header">
      <div>
        <h2>材料归档</h2>
        <p>节点 16：上传报告与表单材料，提交后项目流程闭环。</p>
      </div>
      <el-button :loading="loading" @click="loadRows">刷新</el-button>
    </header>

    <el-card class="tip-card np-info-strip">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="请先维护材料状态，再补充报告/表单附件；每行填写一个对象键。"
      />
    </el-card>

    <el-card class="table-card">
      <el-table :data="rows" v-loading="loading" empty-text="暂无可处理项">
        <el-table-column prop="projectRegisterId" label="项目ID" width="90" />
        <el-table-column prop="applicationName" label="申请单名称" min-width="220" show-overflow-tooltip />
        <el-table-column prop="onSitePackageObjectKey" label="现场测评压缩包" min-width="240" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.onSitePackageObjectKey || "-" }}
          </template>
        </el-table-column>
        <el-table-column label="材料状态" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            {{ formatMaterialStatusCodes(row.materialStatusCodes) }}
          </template>
        </el-table-column>
        <el-table-column label="报告文件" width="100">
          <template #default="{ row }">
            {{ row.reportFiles?.length || 0 }} 项
          </template>
        </el-table-column>
        <el-table-column label="表单文件" width="100">
          <template #default="{ row }">
            {{ row.formFiles?.length || 0 }} 项
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
              <el-button v-permission="'material-archive:save'" size="small" @click="openDialog(row)">
                编辑
              </el-button>
              <el-button
                v-permission="'material-archive:submit'"
                size="small"
                type="success"
                :disabled="row.status === 'ARCHIVED'"
                @click="submitRow(row)"
              >
                提交归档
              </el-button>
              <el-button size="small" @click="openEntityDetail(row.projectRegisterId)">业务详情</el-button>
              <el-button size="small" @click="openTaskDetail(row.projectRegisterId)">审核详情</el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" title="材料归档" width="920px">
      <el-form label-width="140px">
        <el-form-item label="项目ID">
          <el-input :model-value="form.projectRegisterId" disabled />
        </el-form-item>

        <el-form-item label="材料状态" required>
          <el-select
            v-model="form.materialStatusCodes"
            multiple
            collapse-tags
            collapse-tags-tooltip
            placeholder="请选择材料状态"
            style="width: 100%"
          >
            <el-option
              v-for="item in materialStatusOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="报告文件对象键" required>
          <el-input
            v-model="form.reportFilesText"
            type="textarea"
            :rows="4"
            placeholder="每行一个对象键"
          />
          <div class="upload-row">
            <el-button
              v-permission="'material-archive:save'"
              :loading="uploadingType === 'report'"
              @click="triggerUpload('report')"
            >
              上传报告文件
            </el-button>
            <span class="upload-tip">上传后自动追加到文本框</span>
          </div>
        </el-form-item>

        <el-form-item label="表单文件对象键" required>
          <el-input
            v-model="form.formFilesText"
            type="textarea"
            :rows="4"
            placeholder="每行一个对象键"
          />
          <div class="upload-row">
            <el-button
              v-permission="'material-archive:save'"
              :loading="uploadingType === 'form'"
              @click="triggerUpload('form')"
            >
              上传表单文件
            </el-button>
            <span class="upload-tip">上传后自动追加到文本框</span>
          </div>
        </el-form-item>

        <el-form-item label="备注">
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="3"
            maxlength="2000"
            show-word-limit
            placeholder="请输入备注"
          />
        </el-form-item>
      </el-form>

      <input ref="fileInputRef" type="file" class="hidden-file-input" @change="handleFileChange" />

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button
          v-permission="'material-archive:save'"
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
 * @input Material archive APIs, upload endpoint, and Element Plus form components for node-16 operations
 * @output Node-16 material archive board supporting enum-based material-status maintenance, draft save, file upload, and archive submit actions
 * @position Material archive stage page closing project workflow with material status checklist and report/form package persistence
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { apiClient, type ApiResponse } from "./api";
import {
  fetchMaterialArchiveDetail,
  fetchMaterialArchives,
  saveMaterialArchive,
  submitMaterialArchive,
  type MaterialArchiveRecord
} from "./material-archive-service";
import { toTaskDetailPath } from "./task-detail-service";

interface UploadResponse {
  objectKey: string;
}

interface FormState {
  projectRegisterId: number;
  materialStatusCodes: string[];
  reportFilesText: string;
  formFilesText: string;
  remark: string;
}

const materialStatusOptions = [
  { value: "MATERIAL_SUMMARY_PENDING_PRINT", label: "待打印材料汇总" },
  { value: "ASSESSMENT_REPORT", label: "测评报告" },
  { value: "ASSESSMENT_REPORT_REVIEW_RECORD", label: "测评报告评审记录" },
  { value: "VERIFICATION_TEST", label: "验证测试" },
  { value: "TOOL_SCAN", label: "工具扫描" },
  { value: "ASSESSMENT_PLAN", label: "测评方案" },
  { value: "ASSESSMENT_PLAN_REVIEW_RECORD", label: "测评方案评审记录" },
  { value: "ON_SITE_ASSESSMENT", label: "现场测评" },
  { value: "PROCESS_DOCUMENT", label: "过程文档" },
  { value: "INFORMATION_COLLECTION", label: "信息收集" },
  { value: "PROJECT_PLAN", label: "项目计划书" }
] as const;

const materialStatusLabelMap = new Map(materialStatusOptions.map((item) => [item.value, item.label]));

const router = useRouter();
const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const rows = ref<MaterialArchiveRecord[]>([]);
const fileInputRef = ref<HTMLInputElement | null>(null);
const uploadingType = ref<"report" | "form" | "">("");

const form = reactive<FormState>({
  projectRegisterId: 0,
  materialStatusCodes: [],
  reportFilesText: "",
  formFilesText: "",
  remark: ""
});

function statusLabel(status?: string) {
  if (status === "DRAFT") return "草稿";
  if (status === "ARCHIVED") return "已归档";
  return status || "-";
}

function statusTagType(status?: string) {
  if (status === "ARCHIVED") return "success";
  return "info";
}

function readErrorMessage(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof message === "string" && message.trim().length > 0 ? message : fallback;
}

function listToText(values: string[] | undefined) {
  return (values || []).join("\n");
}

function textToList(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function formatMaterialStatusCodes(codes?: string[]) {
  if (!codes || codes.length === 0) {
    return "-";
  }
  return codes.map((code) => materialStatusLabelMap.get(code) || code).join("、");
}

function fillForm(row: MaterialArchiveRecord) {
  form.projectRegisterId = row.projectRegisterId;
  form.materialStatusCodes = Array.isArray(row.materialStatusCodes) ? row.materialStatusCodes : [];
  form.reportFilesText = listToText(row.reportFiles);
  form.formFilesText = listToText(row.formFiles);
  form.remark = row.remark || "";
}

function triggerUpload(type: "report" | "form") {
  uploadingType.value = type;
  fileInputRef.value?.click();
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  const target = uploadingType.value;
  if (!file || !target) {
    return;
  }
  const formData = new FormData();
  formData.append("file", file);
  try {
    const response = await apiClient.post<ApiResponse<UploadResponse>>("/files/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    });
    const objectKey = response.data.data.objectKey;
    if (target === "report") {
      form.reportFilesText = [form.reportFilesText, objectKey].filter(Boolean).join("\n");
    } else {
      form.formFilesText = [form.formFilesText, objectKey].filter(Boolean).join("\n");
    }
    ElMessage.success("文件上传成功");
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "上传文件失败"));
  } finally {
    uploadingType.value = "";
    input.value = "";
  }
}

async function loadRows() {
  loading.value = true;
  try {
    rows.value = await fetchMaterialArchives();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "加载材料归档列表失败"));
  } finally {
    loading.value = false;
  }
}

async function openDialog(row: MaterialArchiveRecord) {
  try {
    const detail = await fetchMaterialArchiveDetail(row.projectRegisterId);
    fillForm(detail);
  } catch {
    fillForm(row);
  }
  dialogVisible.value = true;
}

async function saveForm() {
  if (!form.projectRegisterId) {
    return;
  }
  const reportFiles = textToList(form.reportFilesText);
  const formFiles = textToList(form.formFilesText);
  if (form.materialStatusCodes.length === 0) {
    ElMessage.warning("请至少选择一个材料状态");
    return;
  }
  if (reportFiles.length === 0) {
    ElMessage.warning("请至少上传一个报告文件");
    return;
  }
  if (formFiles.length === 0) {
    ElMessage.warning("请至少上传一个表单文件");
    return;
  }

  saving.value = true;
  try {
    await saveMaterialArchive(form.projectRegisterId, {
      materialStatusCodes: form.materialStatusCodes,
      reportFiles,
      formFiles,
      remark: form.remark.trim()
    });
    ElMessage.success("材料归档草稿已保存");
    dialogVisible.value = false;
    await loadRows();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "保存材料归档失败"));
  } finally {
    saving.value = false;
  }
}

function openTaskDetail(projectId: number) {
  void router.push(toTaskDetailPath("PROJECT_REGISTER", projectId));
}

function openEntityDetail(projectId: number) {
  void router.push(`/entity-detail/material/${projectId}`);
}

async function submitRow(row: MaterialArchiveRecord) {
  try {
    await ElMessageBox.confirm(`确认提交项目 ${row.projectRegisterId} 的材料归档吗？`, "提交确认", {
      type: "warning",
      confirmButtonText: "确认",
      cancelButtonText: "取消"
    });
  } catch {
    return;
  }

  try {
    await submitMaterialArchive(row.projectRegisterId);
    ElMessage.success("材料归档已提交");
    await loadRows();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "提交材料归档失败"));
  }
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
