<template>
  <div class="page-shell page section-stack">
    <header class="page-header">
      <div>
        <h2>材料归档</h2>
        <p>节点 16：上传报告与表单材料，提交后项目流程闭环</p>
      </div>
      <el-button :loading="loading" @click="loadRows">刷新</el-button>
    </header>

    <el-card class="tip-card">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="归档前请确认报告文件与表单材料完整；每行填写一个对象键。"
      />
    </el-card>

    <el-card class="table-card">
      <el-table :data="rows" v-loading="loading" empty-text="暂无可处理项">
        <el-table-column prop="projectRegisterId" label="项目ID" width="90" />
        <el-table-column prop="applicationName" label="申请单名称" min-width="220" show-overflow-tooltip />
        <el-table-column prop="onSitePackageObjectKey" label="现场测评压缩" min-width="240" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.onSitePackageObjectKey || "-" }}
          </template>
        </el-table-column>
        <el-table-column label="报告文件" width="100">
          <template #default="{ row }">
            {{ row.reportFiles?.length || 0 }} 项          </template>
        </el-table-column>
        <el-table-column label="表单文件" width="100">
          <template #default="{ row }">
            {{ row.formFiles?.length || 0 }} 项          </template>
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
              <el-button size="small" @click="openProcessOverview(row.projectRegisterId)">流程详情</el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" title="材料归档" width="880px">
      <el-form label-width="140px">
        <el-form-item label="项目ID">
          <el-input :model-value="form.projectRegisterId" disabled />
        </el-form-item>

        <el-form-item label="报告文件对象">
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
            <span class="upload-tip">上传后自动追加到文本</span>
          </div>
        </el-form-item>

        <el-form-item label="表单文件对象">
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
            <span class="upload-tip">上传后自动追加到文本</span>
          </div>
        </el-form-item>

        <el-form-item label="备注">
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="3"
            maxlength="2000"
            show-word-limit
            placeholder="请输入备注" />
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
 * @output Node-16 material archive board supporting permission-gated draft save, file upload, and archive submit actions
 * @position Material archive stage page closing project workflow with report/form materials persistence and button-level RBAC
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
import { toProcessOverviewPath } from "./process-overview-service";

interface UploadResponse {
  objectKey: string;
}

interface FormState {
  projectRegisterId: number;
  reportFilesText: string;
  formFilesText: string;
  remark: string;
}

const router = useRouter();
const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const rows = ref<MaterialArchiveRecord[]>([]);
const fileInputRef = ref<HTMLInputElement | null>(null);
const uploadingType = ref<"report" | "form" | "">("");

const form = reactive<FormState>({
  projectRegisterId: 0,
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

function fillForm(row: MaterialArchiveRecord) {
  form.projectRegisterId = row.projectRegisterId;
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
  saving.value = true;
  try {
    await saveMaterialArchive(form.projectRegisterId, {
      reportFiles: textToList(form.reportFilesText),
      formFiles: textToList(form.formFilesText),
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

function openProcessOverview(projectId: number) {
  void router.push(toProcessOverviewPath(projectId));
}

async function submitRow(row: MaterialArchiveRecord) {
  try {
    await ElMessageBox.confirm(
      `确认提交项目 ${row.projectRegisterId} 的材料归档吗？`,
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
</style>


