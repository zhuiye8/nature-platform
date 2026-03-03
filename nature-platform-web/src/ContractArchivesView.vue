<template>
  <div class="page-shell page section-stack">
    <header class="page-header">
      <div>
        <h2>合同归档</h2>
        <p>用于归档审核通过的合同，归档完成后可在项目登记中被选择。</p>
      </div>
      <el-space>
        <el-button v-permission="'contract:archive'" :loading="loading" @click="loadContracts">刷新</el-button>
      </el-space>
    </header>

    <el-card class="tip-card">
      <el-alert
        type="info"
        show-icon
        :closable="false"
        title="归档链路：仅“审核通过”且“未归档”的合同可执行归档操作。"
      />
    </el-card>

    <el-card class="table-card">
      <el-table :data="contracts" v-loading="loading" empty-text="暂无可归档合同数据">
        <el-table-column prop="id" label="ID" width="90" />
        <el-table-column prop="projectName" label="项目名称" min-width="220" />
        <el-table-column prop="customerName" label="客户名称" min-width="220" />
        <el-table-column prop="contractNo" label="合同编号" min-width="170" />
        <el-table-column prop="reviewStatus" label="审核状态" width="120">
          <template #default="{ row }">
            <el-tag :type="reviewTagType(row.reviewStatus)">{{ reviewStatusLabel(row.reviewStatus) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="archiveStatus" label="归档状态" width="120">
          <template #default="{ row }">
            <el-tag :type="archiveTagType(row.archiveStatus)">{{ archiveStatusLabel(row.archiveStatus) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdBy" label="创建人" width="120" />
        <el-table-column prop="createdAt" label="创建时间" min-width="170" />
        <el-table-column label="操作" min-width="220" fixed="right">
          <template #default="{ row }">
            <el-space>
              <el-button v-if="row.canViewDetail !== false" size="small" @click="openDetail(row)">查看详情</el-button>
              <el-button
                v-permission="'contract:archive'"
                size="small"
                type="warning"
                :disabled="!canArchive(row)"
                @click="openArchive(row)"
              >
                合同归档
              </el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="archiveDialogVisible" title="合同归档" width="760px">
      <el-form label-width="120px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="签订时间">
              <el-date-picker
                v-model="archiveForm.signedAt"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="请选择签订时间"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="文件份数">
              <el-input-number v-model="archiveForm.fileCount" :min="1" :max="999" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="存放位置" required>
          <el-input v-model="archiveForm.storageLocation" placeholder="例如：档案柜 A-03" />
        </el-form-item>

        <el-form-item label="扫描件对象键">
          <el-space wrap>
            <el-input
              v-model="archiveForm.archiveScanObjectKey"
              placeholder="可上传后自动回填，也可手工录入"
              style="min-width: 420px"
            />
            <el-button v-permission="'contract:archive'" :loading="uploadingArchive" @click="triggerArchiveUpload">
              上传扫描件
            </el-button>
          </el-space>
          <input ref="archiveFileInputRef" type="file" style="display: none" @change="handleArchiveFileChange" />
        </el-form-item>

        <el-form-item label="归档备注">
          <el-input v-model="archiveForm.remark" type="textarea" :rows="3" maxlength="300" show-word-limit />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="archiveDialogVisible = false">取消</el-button>
        <el-button v-permission="'contract:archive'" type="primary" :loading="archiving" @click="saveArchive">
          确认归档
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailDialogVisible" title="合同详情" width="980px">
      <template v-if="detailContract">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="合同名称">
            {{ detailContract.contractName || detailContract.projectName || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="合同编号">
            {{ detailContract.contractNo || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="项目名称">{{ detailContract.projectName || "-" }}</el-descriptions-item>
          <el-descriptions-item label="客户名称">{{ detailContract.customerName || "-" }}</el-descriptions-item>
          <el-descriptions-item label="联系人">{{ detailContract.contactName || "-" }}</el-descriptions-item>
          <el-descriptions-item label="联系方式">{{ detailContract.mobilePhone || "-" }}</el-descriptions-item>
          <el-descriptions-item label="服务年份">
            {{ detailContract.serviceYears?.length ? detailContract.serviceYears.join("、") : "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="回款状态">
            {{ paymentStatusLabel(detailContract.paymentStatus) }}
          </el-descriptions-item>
          <el-descriptions-item label="审核状态">
            <el-tag :type="reviewTagType(detailContract.reviewStatus)">
              {{ reviewStatusLabel(detailContract.reviewStatus) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="归档状态">
            <el-tag :type="archiveTagType(detailContract.archiveStatus)">
              {{ archiveStatusLabel(detailContract.archiveStatus) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="创建人">{{ detailContract.createdBy || "-" }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ detailContract.createdAt || "-" }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ detailContract.remark || "-" }}</el-descriptions-item>
        </el-descriptions>

        <el-divider>系统清单</el-divider>
        <el-table
          :data="detailContract.systemItems || []"
          size="small"
          border
          empty-text="暂无系统清单"
        >
          <el-table-column prop="systemLevel" label="等级" width="90" />
          <el-table-column prop="systemName" label="系统名称" min-width="240" show-overflow-tooltip />
        </el-table>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * @input Contract archive list/action APIs, upload API, and Element Plus table/dialog/form widgets
 * @output Contract archive page for listing approved contracts, permission-aware detail snapshots, and archive metadata submission
 * @position Contract lifecycle back-half page dedicated to archive-stage execution with detail-entry visibility control
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { apiClient, type ApiResponse } from "./api";
import {
  archiveContract,
  fetchContractArchiveList,
  type ContractArchivePayload,
  type ContractRecord
} from "./contract-service";

interface UploadResponse {
  objectKey: string;
}

interface ArchiveFormState extends ContractArchivePayload {
  contractId: number;
}

const loading = ref(false);
const archiving = ref(false);
const uploadingArchive = ref(false);
const archiveDialogVisible = ref(false);
const detailDialogVisible = ref(false);
const contracts = ref<ContractRecord[]>([]);
const detailContract = ref<ContractRecord | null>(null);
const archiveFileInputRef = ref<HTMLInputElement | null>(null);

const archiveForm = reactive<ArchiveFormState>({
  contractId: 0,
  signedAt: "",
  fileCount: 1,
  storageLocation: "",
  remark: "",
  archiveScanObjectKey: ""
});

function readErrorMessage(error: unknown, fallback: string) {
  const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof msg === "string" && msg.trim() ? msg : fallback;
}

function reviewStatusLabel(status: string) {
  if (status === "SUBMITTED") return "待审核";
  if (status === "APPROVED") return "已通过";
  if (status === "REJECTED") return "已驳回";
  if (status === "DRAFT") return "草稿";
  return status || "-";
}

function reviewTagType(status: string) {
  if (status === "SUBMITTED") return "warning";
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "danger";
  return "info";
}

function archiveStatusLabel(status: string) {
  if (status === "ARCHIVED") return "已归档";
  if (status === "PENDING_ARCHIVE") return "待归档";
  return status || "-";
}

function archiveTagType(status: string) {
  if (status === "ARCHIVED") return "success";
  if (status === "PENDING_ARCHIVE") return "warning";
  return "info";
}

function canArchive(row: ContractRecord) {
  return row.reviewStatus === "APPROVED" && row.archiveStatus !== "ARCHIVED";
}

function paymentStatusLabel(status?: string) {
  if (status === "PAID") return "已回款";
  if (status === "UNPAID") return "未回款";
  return status || "-";
}

async function loadContracts() {
  loading.value = true;
  try {
    contracts.value = await fetchContractArchiveList();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "加载归档合同列表失败"));
  } finally {
    loading.value = false;
  }
}

function resetArchiveForm() {
  archiveForm.contractId = 0;
  archiveForm.signedAt = "";
  archiveForm.fileCount = 1;
  archiveForm.storageLocation = "";
  archiveForm.remark = "";
  archiveForm.archiveScanObjectKey = "";
}

function openArchive(row: ContractRecord) {
  if (!canArchive(row)) {
    ElMessage.warning("仅审核通过且未归档的合同可执行归档。");
    return;
  }
  resetArchiveForm();
  archiveForm.contractId = row.id;
  archiveDialogVisible.value = true;
}

function openDetail(row: ContractRecord) {
  if (row.canViewDetail === false) {
    ElMessage.warning("当前角色仅可查看列表，无法查看合同详情");
    return;
  }
  detailContract.value = row;
  detailDialogVisible.value = true;
}

function triggerArchiveUpload() {
  archiveFileInputRef.value?.click();
}

async function handleArchiveFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) {
    return;
  }
  const formData = new FormData();
  formData.append("file", file);
  uploadingArchive.value = true;
  try {
    const response = await apiClient.post<ApiResponse<UploadResponse>>("/files/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    });
    archiveForm.archiveScanObjectKey = response.data.data.objectKey;
    ElMessage.success("扫描件上传成功，已回填对象键。");
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "上传扫描件失败"));
  } finally {
    uploadingArchive.value = false;
    input.value = "";
  }
}

async function saveArchive() {
  if (!archiveForm.contractId) {
    ElMessage.warning("缺少合同 ID。");
    return;
  }
  if (!archiveForm.storageLocation?.trim()) {
    ElMessage.warning("请填写存放位置。");
    return;
  }
  if ((archiveForm.fileCount ?? 0) <= 0) {
    ElMessage.warning("文件份数必须大于 0。");
    return;
  }

  archiving.value = true;
  try {
    await archiveContract(archiveForm.contractId, {
      signedAt: archiveForm.signedAt || undefined,
      fileCount: archiveForm.fileCount,
      storageLocation: archiveForm.storageLocation.trim(),
      remark: archiveForm.remark?.trim() || undefined,
      archiveScanObjectKey: archiveForm.archiveScanObjectKey?.trim() || undefined
    });
    ElMessage.success("合同归档成功。");
    archiveDialogVisible.value = false;
    await loadContracts();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "合同归档失败"));
  } finally {
    archiving.value = false;
  }
}

onMounted(() => {
  void loadContracts();
});
</script>

<style scoped>
.tip-card {
  border: 1px solid rgba(201, 136, 34, 0.26);
  background: linear-gradient(90deg, rgba(255, 243, 215, 0.58), rgba(255, 251, 243, 0.9));
}

.table-card {
  background: linear-gradient(180deg, #ffffff, #fbfcfc);
  border: 1px solid rgba(211, 225, 230, 0.86);
}
</style>
