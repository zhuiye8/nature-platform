<template>
  <div class="page-shell page section-stack">
    <header class="page-header">
      <div>
        <h2>合同提审</h2>
        <p>用于合同创建、编辑、提交审核，审核通过后进入合同归档页面处理。</p>
      </div>
      <el-space>
        <el-button v-permission="'contract:view'" :loading="loading" @click="loadAll">刷新</el-button>
        <el-button v-permission="'contract:create'" type="primary" @click="openCreate">新建合同</el-button>
      </el-space>
    </header>

    <el-card class="tip-card">
      <el-alert
        type="info"
        show-icon
        :closable="false"
        title="提审链路：合同创建/编辑 -> 提交审核；审核通过后请在“合同归档”页面完成归档。"
      />
    </el-card>

    <el-card class="table-card">
      <el-table :data="contracts" v-loading="loading" empty-text="暂无合同数据">
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
        <el-table-column label="操作" min-width="300" fixed="right">
          <template #default="{ row }">
            <el-space>
              <el-button
                v-permission="'contract:update'"
                size="small"
                :disabled="!canEdit(row.reviewStatus)"
                @click="openEdit(row)"
              >
                编辑
              </el-button>
              <el-button
                v-permission="'contract:submit'"
                size="small"
                type="success"
                :disabled="!canSubmit(row.reviewStatus)"
                @click="submitReview(row.id)"
              >
                提交审核
              </el-button>
              <el-button
                v-permission="'contract:delete'"
                size="small"
                type="danger"
                :disabled="!canDelete(row.reviewStatus)"
                @click="removeContract(row.id)"
              >
                删除
              </el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑合同' : '新建合同'" width="960px">
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
            <el-form-item label="联系人" required>
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
              <el-select
                v-model="form.serviceYears"
                multiple
                collapse-tags
                collapse-tags-tooltip
                placeholder="请选择服务年份"
                style="width: 100%"
              >
                <el-option
                  v-for="year in serviceYearOptions"
                  :key="year"
                  :label="String(year)"
                  :value="year"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="回款状态">
              <el-select v-model="form.paymentStatus" placeholder="请选择" style="width: 100%">
                <el-option label="未回款" value="UNPAID" />
                <el-option label="已回款" value="PAID" />
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
              <el-input v-model="item.systemName" placeholder="请输入系统名称" />
              <el-button
                v-permission="['contract:create', 'contract:update']"
                type="danger"
                plain
                :disabled="form.systemItems.length <= 1"
                @click="removeSystemItem(idx)"
              >
                删除
              </el-button>
            </div>
            <el-button v-permission="['contract:create', 'contract:update']" plain @click="addSystemItem">
              新增系统
            </el-button>
          </div>
        </el-form-item>

        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="3" maxlength="300" show-word-limit />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button
          v-permission="['contract:create', 'contract:update']"
          type="primary"
          :loading="submitting"
          @click="saveContract"
        >
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * @input Contract/customer APIs, permission helpers, and Element Plus table/dialog/form widgets
 * @output Contract submission page for list/create/edit/delete/submit-review operations with year selection and payment-status labels
 * @position Contract lifecycle front-half page responsible for draft management and review submission
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  createContract,
  deleteContract,
  fetchContractSubmissionList,
  submitContractReview,
  updateContract,
  type ContractPayload,
  type ContractRecord,
  type ContractSystemItemPayload
} from "./contract-service";
import { fetchCustomers, type CustomerRecord } from "./customer-service";
import { hasPermission } from "./permission";

interface ContractFormState extends Omit<ContractPayload, "customerId"> {
  customerId: number | null;
}

const loading = ref(false);
const submitting = ref(false);
const dialogVisible = ref(false);
const editingId = ref<number | null>(null);
const customers = ref<CustomerRecord[]>([]);
const contracts = ref<ContractRecord[]>([]);
const currentYear = new Date().getFullYear();
const serviceYearOptions = Array.from({ length: 11 }, (_, index) => currentYear - 1 + index);

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

function canEdit(status: string) {
  return status === "DRAFT" || status === "REJECTED";
}

function canDelete(status: string) {
  return status === "DRAFT" || status === "REJECTED";
}

async function loadAll() {
  loading.value = true;
  try {
    contracts.value = await fetchContractSubmissionList();
    if (
      hasPermission("customer:view") &&
      (hasPermission("contract:create") || hasPermission("contract:update"))
    ) {
      customers.value = await fetchCustomers();
    } else {
      customers.value = [];
    }
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "加载合同数据失败"));
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
  form.systemItems = row.systemItems?.length
    ? row.systemItems.map((item) => ({
        systemLevel: item.systemLevel,
        systemName: item.systemName
      }))
    : [{ systemLevel: 2, systemName: "" }];
  dialogVisible.value = true;
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
  if (!Array.isArray(form.serviceYears) || form.serviceYears.length === 0) {
    ElMessage.warning("请至少选择一个服务年份");
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
      serviceYears: [...new Set(form.serviceYears)].sort((a, b) => a - b),
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

async function submitReview(id: number) {
  try {
    await submitContractReview(id);
    ElMessage.success("已提交审核，请在待办审批中处理");
    await loadAll();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "提交审核失败"));
  }
}

async function removeContract(id: number) {
  try {
    await ElMessageBox.confirm("确认删除该合同吗？删除后不可恢复。", "删除确认", {
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
.tip-card {
  border: 1px solid rgba(31, 152, 122, 0.2);
  background: linear-gradient(90deg, rgba(45, 184, 146, 0.08), rgba(47, 110, 162, 0.04));
}

.table-card {
  background: linear-gradient(180deg, #ffffff, #fbfcfc);
  border: 1px solid rgba(211, 225, 230, 0.86);
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

@media (max-width: 960px) {
  .system-item-row {
    grid-template-columns: 1fr;
  }
}
</style>
