<template>
  <div class="page-shell page section-stack">
    <header class="page-header">
      <div>
        <h2>合同管理</h2>
        <p>创建合同并提交审核，审核通过后在本页完成归档，归档后才可进入项目登记</p>
      </div>
      <el-space>
        <el-button :loading="loading" @click="loadAll">刷新</el-button>
        <el-button type="primary" @click="openCreate">新建合同</el-button>
      </el-space>
    </header>

    <el-card class="tip-card">
      <el-alert
        type="info"
        show-icon
        :closable="false"
        title="流程提示：客户管理 -> 合同管理提交审核 -> 合同归档 -> 项目登记。未归档合同不会出现在项目登记下拉中" />
    </el-card>

    <el-card>
      <el-table :data="contracts" v-loading="loading" empty-text="暂无合同数据">
        <el-table-column prop="id" label="ID" width="90" />
        <el-table-column prop="projectName" label="项目名称" min-width="200" />
        <el-table-column prop="customerName" label="客户名称" min-width="200" />
        <el-table-column prop="contractNo" label="合同编号" min-width="160" />
        <el-table-column prop="reviewStatus" label="审核状态" width="120">
          <template #default="{ row }">
            <el-tag :type="reviewTagType(row.reviewStatus)">{{ reviewStatusLabel(row.reviewStatus) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="archiveStatus" label="归档状态" width="130">
          <template #default="{ row }">
            <el-tag :type="archiveTagType(row.archiveStatus)">{{ archiveStatusLabel(row.archiveStatus) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdBy" label="创建" width="120" />
        <el-table-column prop="createdAt" label="创建时间" min-width="180" />
        <el-table-column label="操作" min-width="360" fixed="right">
          <template #default="{ row }">
            <el-space>
              <el-button size="small" @click="openEdit(row)">编辑</el-button>
              <el-button
                size="small"
                type="success"
                :disabled="!canSubmit(row.reviewStatus)"
                @click="submitReview(row.id)"
              >
                提交审核
              </el-button>
              <el-button
                size="small"
                type="warning"
                :disabled="!canArchive(row)"
                @click="openArchive(row)"
              >
                合同归档
              </el-button>
              <el-button size="small" type="danger" @click="removeContract(row.id)">删除</el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑合同' : '新建合同'" width="920px">
      <el-form label-width="110px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="客户" required>
              <el-select
                v-model="form.customerId"
                clearable
                filterable
                placeholder="请选择客户"
                style="width: 100%"
              >
                <el-option
                  v-for="customer in customers"
                  :key="customer.id"
                  :label="customer.fullName"
                  :value="customer.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="项目名称" required>
              <el-input v-model="form.projectName" placeholder="请输入项目名称" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="联系" required>
              <el-input v-model="form.contactName" placeholder="请输入联系人" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系电话" required>
              <el-input v-model="form.mobilePhone" placeholder="请输入联系电话" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="付款单位" required>
              <el-input v-model="form.paymentCompany" placeholder="请输入付款单位" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="付款金额">
              <el-input-number v-model="form.paymentAmount" :min="0" :precision="2" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="服务年份" required>
              <el-input
                v-model="serviceYearsInput"
                placeholder="例如2026,2027（支持中英文逗号）" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="回款状态">
              <el-select v-model="form.paymentStatus" placeholder="请选择" style="width: 100%">
                <el-option label="未支" value="UNPAID" />
                <el-option label="已支" value="PAID" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="系统" required>
          <div class="system-items">
            <div v-for="(item, idx) in form.systemItems" :key="idx" class="system-item-row">
              <el-select v-model="item.systemLevel" style="width: 130px">
                <el-option label="二级系统" :value="2" />
                <el-option label="三级系统" :value="3" />
              </el-select>
              <el-input v-model="item.systemName" placeholder="请输入系统名" />
              <el-button
                type="danger"
                plain
                :disabled="form.systemItems.length <= 1"
                @click="removeSystemItem(idx)"
              >
                删除
              </el-button>
            </div>
            <el-button plain @click="addSystemItem">新增系统</el-button>
          </div>
        </el-form-item>

        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="3" maxlength="300" show-word-limit />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="saveContract">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="archiveDialogVisible" title="合同归档" width="760px">
      <el-form label-width="120px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="签订时间">
              <el-date-picker
                v-model="archiveForm.signedAt"
                type="datetime"
                value-format="YYYY-MM-DD HH:mm:ss"
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
              placeholder="可上传后自动回填，也可手工录入" style="min-width: 420px"
            />
            <el-button :loading="uploadingArchive" @click="triggerArchiveUpload">上传扫描</el-button>
          </el-space>
          <input
            ref="archiveFileInputRef"
            type="file"
            style="display: none"
            @change="handleArchiveFileChange"
          />
        </el-form-item>

        <el-form-item label="归档备注">
          <el-input v-model="archiveForm.remark" type="textarea" :rows="3" maxlength="300" show-word-limit />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="archiveDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="archiving" @click="saveArchive">确认归档</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * @input Contract/customer services, upload API, and Element Plus form widgets
 * @output Contract CRUD/review/archive UI with guarded payload assembly before submit
 * @position Contract workflow page for contract management and archive handoff
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { apiClient, type ApiResponse } from "./api";
import {
  archiveContract,
  createContract,
  deleteContract,
  fetchContracts,
  submitContractReview,
  updateContract,
  type ContractArchivePayload,
  type ContractPayload,
  type ContractRecord,
  type ContractSystemItemPayload
} from "./contract-service";
import { fetchCustomers, type CustomerRecord } from "./customer-service";

interface UploadResponse {
  objectKey: string;
}

interface ArchiveFormState extends ContractArchivePayload {
  contractId: number;
}

interface ContractFormState extends Omit<ContractPayload, "customerId"> {
  customerId: number | null;
}

const loading = ref(false);
const submitting = ref(false);
const archiving = ref(false);
const uploadingArchive = ref(false);
const dialogVisible = ref(false);
const archiveDialogVisible = ref(false);
const editingId = ref<number | null>(null);
const customers = ref<CustomerRecord[]>([]);
const contracts = ref<ContractRecord[]>([]);
const serviceYearsInput = ref("");
const archiveFileInputRef = ref<HTMLInputElement | null>(null);

const form = reactive<ContractFormState>({
  customerId: null,
  projectName: "",
  contactName: "",
  mobilePhone: "",
  paymentCompany: "",
  paymentAmount: undefined,
  paymentMethod: "",
  partnerName: "",
  salesPerson: "",
  performanceCity: "",
  dealStatus: "",
  remark: "",
  contractType: "",
  contractFileObjectKey: "",
  serviceYearDetail: "",
  paymentStatus: "UNPAID",
  serviceYears: [],
  systemItems: [{ systemLevel: 2, systemName: "" }]
});

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

function canSubmit(status: string) {
  return status === "DRAFT" || status === "REJECTED";
}

function canArchive(row: ContractRecord) {
  return row.reviewStatus === "APPROVED" && row.archiveStatus !== "ARCHIVED";
}

function parseServiceYears(input: string): number[] {
  const years = input
    .split(/[,\uff0c\s]+/)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item >= 2000 && item <= 2100);
  return Array.from(new Set(years)).sort((a, b) => a - b);
}

async function loadAll() {
  loading.value = true;
  try {
    const [customerRows, contractRows] = await Promise.all([fetchCustomers(), fetchContracts()]);
    customers.value = customerRows;
    contracts.value = contractRows;
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "加载数据失败"));
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  form.customerId = null;
  form.projectName = "";
  form.contactName = "";
  form.mobilePhone = "";
  form.paymentCompany = "";
  form.paymentAmount = undefined;
  form.paymentMethod = "";
  form.partnerName = "";
  form.salesPerson = "";
  form.performanceCity = "";
  form.dealStatus = "";
  form.remark = "";
  form.contractType = "";
  form.contractFileObjectKey = "";
  form.serviceYearDetail = "";
  form.paymentStatus = "UNPAID";
  form.serviceYears = [];
  form.systemItems = [{ systemLevel: 2, systemName: "" }];
  serviceYearsInput.value = "";
}

function resetArchiveForm() {
  archiveForm.contractId = 0;
  archiveForm.signedAt = "";
  archiveForm.fileCount = 1;
  archiveForm.storageLocation = "";
  archiveForm.remark = "";
  archiveForm.archiveScanObjectKey = "";
}

function openCreate() {
  editingId.value = null;
  resetForm();
  dialogVisible.value = true;
}

function openEdit(row: ContractRecord) {
  editingId.value = row.id;
  form.customerId = row.customerId;
  form.projectName = row.projectName || "";
  form.contactName = row.contactName || "";
  form.mobilePhone = row.mobilePhone || "";
  form.paymentCompany = row.paymentCompany || "";
  form.paymentAmount = row.paymentAmount;
  form.paymentMethod = row.paymentMethod || "";
  form.partnerName = row.partnerName || "";
  form.salesPerson = row.salesPerson || "";
  form.performanceCity = row.performanceCity || "";
  form.dealStatus = row.dealStatus || "";
  form.remark = row.remark || "";
  form.contractType = row.contractType || "";
  form.contractFileObjectKey = row.contractFileObjectKey || "";
  form.serviceYearDetail = row.serviceYearDetail || "";
  form.paymentStatus = row.paymentStatus || "UNPAID";
  form.serviceYears = [...(row.serviceYears || [])];
  serviceYearsInput.value = form.serviceYears.join(",");
  form.systemItems = row.systemItems?.length
    ? row.systemItems.map((item) => ({
        systemLevel: item.systemLevel,
        systemName: item.systemName
      }))
    : [{ systemLevel: 2, systemName: "" }];
  dialogVisible.value = true;
}

function openArchive(row: ContractRecord) {
  if (!canArchive(row)) {
    ElMessage.warning("仅审核过且未归档的合同可执行归档");
    return;
  }
  resetArchiveForm();
  archiveForm.contractId = row.id;
  archiveDialogVisible.value = true;
}

function addSystemItem() {
  form.systemItems.push({ systemLevel: 2, systemName: "" });
}

function removeSystemItem(index: number) {
  form.systemItems.splice(index, 1);
}

function normalizeSystemItems(items: ContractSystemItemPayload[]) {
  return items
    .map((item) => ({
      systemLevel: item.systemLevel,
      systemName: (item.systemName || "").trim()
    }))
    .filter((item) => item.systemName.length > 0);
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
    ElMessage.success("扫描件上传成功，已回填对象键");
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "上传扫描件失败"));
  } finally {
    uploadingArchive.value = false;
    input.value = "";
  }
}

async function saveContract() {
  const customerId = form.customerId;
  if (typeof customerId !== "number" || customerId <= 0) {
    ElMessage.warning("请选择客户");
    return;
  }
  if (!form.projectName.trim()) {
    ElMessage.warning("项目名称不能为空");
    return;
  }
  if (!form.contactName?.trim()) {
    ElMessage.warning("联系人不能为空");
    return;
  }
  if (!form.mobilePhone?.trim()) {
    ElMessage.warning("联系电话不能为空");
    return;
  }
  if (!form.paymentCompany?.trim()) {
    ElMessage.warning("付款单位不能为空");
    return;
  }

  const parsedYears = parseServiceYears(serviceYearsInput.value);
  if (parsedYears.length === 0) {
    ElMessage.warning("请至少填写一个有效服务年份，例如 2026,2027");
    return;
  }

  const normalizedItems = normalizeSystemItems(form.systemItems);
  if (normalizedItems.length === 0) {
    ElMessage.warning("请至少填写一个系统项");
    return;
  }

  submitting.value = true;
  try {
    const payload: ContractPayload = {
      ...form,
      customerId,
      projectName: form.projectName.trim(),
      contactName: form.contactName?.trim(),
      mobilePhone: form.mobilePhone?.trim(),
      paymentCompany: form.paymentCompany?.trim(),
      serviceYears: parsedYears,
      systemItems: normalizedItems
    };
    if (editingId.value) {
      await updateContract(editingId.value, payload);
      ElMessage.success("合同更新成功");
    } else {
      await createContract(payload);
      ElMessage.success("合同创建成功");
    }
    dialogVisible.value = false;
    await loadAll();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "保存合同失败"));
  } finally {
    submitting.value = false;
  }
}

async function saveArchive() {
  if (!archiveForm.contractId) {
    ElMessage.warning("缺少合同ID");
    return;
  }
  if (!archiveForm.storageLocation?.trim()) {
    ElMessage.warning("请填写存放位置");
    return;
  }
  if ((archiveForm.fileCount ?? 0) <= 0) {
    ElMessage.warning("文件份数必须大于 0");
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
    ElMessage.success("合同归档成功，项目登记已可选择该合同");
    archiveDialogVisible.value = false;
    await loadAll();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "合同归档失败"));
  } finally {
    archiving.value = false;
  }
}

async function submitReview(id: number) {
  try {
    await submitContractReview(id);
    ElMessage.success("已提交审核，请到待办审批中处理");
    await loadAll();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "提交审核失败"));
  }
}

async function removeContract(id: number) {
  try {
    await ElMessageBox.confirm("确认删除该合同吗", "删除确认", {
      type: "warning",
      confirmButtonText: "确认",
      cancelButtonText: "取消"
    });
  } catch {
    return;
  }

  try {
    await deleteContract(id);
    ElMessage.success("合同已删除");
    await loadAll();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "删除合同失败"));
  }
}

onMounted(() => {
  void loadAll();
});
</script>

<style scoped>
.page {
  max-width: 1260px;
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

.tip-card {
  margin-bottom: 16px;
}

.system-items {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.system-item-row {
  display: grid;
  grid-template-columns: 130px 1fr auto;
  gap: 8px;
}
</style>
