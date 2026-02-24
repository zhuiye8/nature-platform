<template>
  <div class="page-shell page section-stack">
    <header class="page-header">
      <div>
        <h2>项目登记</h2>
        <p>支持项目登记创建、提审流程审批回写和轨迹追踪</p>
      </div>
      <el-space>
        <el-button :loading="loading" @click="loadAll">刷新</el-button>
        <el-button type="primary" @click="openCreate">新建项目登记</el-button>
      </el-space>
    </header>

    <el-card class="tip-card">
      <el-alert
        type="info"
        show-icon
        :closable="false"
        title="仅允许选择“已归档合同”；同一合同同一年份只允许存在一条未删除项目登记" />
    </el-card>

    <el-card>
      <el-table :data="rows" v-loading="loading" empty-text="暂无项目登记数据">
        <el-table-column prop="id" label="ID" width="90" />
        <el-table-column prop="applicationName" label="申请单名称" min-width="280" show-overflow-tooltip />
        <el-table-column prop="contractName" label="合同名称" min-width="220" show-overflow-tooltip />
        <el-table-column prop="contractYear" label="合同年份" width="100" />
        <el-table-column label="业务状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="流程状态" width="120">
          <template #default="{ row }">
            <el-tag :type="workflowTagType(row.workflowStatus)">
              {{ workflowStatusLabel(row.workflowStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdBy" label="创建" width="120" />
        <el-table-column prop="createdAt" label="创建时间" min-width="170" />
        <el-table-column label="操作" min-width="340" fixed="right">
          <template #default="{ row }">
            <el-space>
              <el-button size="small" :disabled="!canEdit(row.status)" @click="openEdit(row)">编辑</el-button>
              <el-button
                size="small"
                type="success"
                :disabled="!canSubmit(row.status)"
                @click="submitReview(row)"
              >
                提交审核
              </el-button>
              <el-button size="small" @click="openTrace(row)">流程轨迹</el-button>
              <el-button size="small" type="danger" :disabled="!canDelete(row.status)" @click="removeRow(row)">
                删除
              </el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑项目登记' : '新建项目登记'" width="1180px">
      <el-form label-width="112px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="合同" required>
              <el-select
                v-model="form.contractId"
                filterable
                placeholder="请选择已归档合同" style="width: 100%"
              >
                <el-option
                  v-for="contract in archivedContracts"
                  :key="contract.id"
                  :label="contract.contractName || contract.projectName || `合同-${contract.id}`"
                  :value="contract.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="合同年份" required>
              <el-select v-model="form.contractYear" placeholder="请选择年份" style="width: 100%">
                <el-option
                  v-for="year in yearOptions"
                  :key="year"
                  :label="String(year)"
                  :value="year"
                  :disabled="isYearDisabled(year)"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-alert
          type="warning"
          :closable="false"
          show-icon
          title="附件字段请填写已上传文件对象键，每行一个，最多5行"
        />

        <div class="system-list">
          <el-card v-for="(item, index) in form.systemItems" :key="index" class="system-card" shadow="never">
            <template #header>
              <div class="system-card-header">
                <strong>系统明细 {{ index + 1 }}</strong>
                <el-button
                  type="danger"
                  plain
                  :disabled="form.systemItems.length <= 1"
                  @click="removeSystemItem(index)"
                >
                  删除明细
                </el-button>
              </div>
            </template>

            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="系统名称" required>
                  <el-input v-model="item.systemName" placeholder="请输入系统名" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="备案机关" required>
                  <el-input v-model="item.filingAgency" placeholder="请输入备案机关" />
                </el-form-item>
              </el-col>
            </el-row>

            <el-row :gutter="12">
              <el-col :span="8">
                <el-form-item label="安全保护等级" required>
                  <el-select v-model="item.securityLevel" style="width: 100%">
                    <el-option label="第二" value="SECOND_LEVEL" />
                    <el-option label="第三" value="THIRD_LEVEL" />
                    <el-option label="第四" value="FOURTH_LEVEL" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="是否复测" required>
                  <el-select v-model="item.reassessment" style="width: 100%">
                    <el-option label="是" :value="true" />
                    <el-option label="否" :value="false" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="要求入场时间" required>
                  <el-date-picker
                    v-model="item.requiredEntryDate"
                    type="date"
                    value-format="YYYY-MM-DD"
                    placeholder="请选择日期"
                    style="width: 100%"
                  />
                </el-form-item>
              </el-col>
            </el-row>

            <el-row :gutter="12">
              <el-col :span="8">
                <el-form-item label="报告交付日期" required>
                  <el-date-picker
                    v-model="item.requiredReportDeliveryDate"
                    type="date"
                    value-format="YYYY-MM-DD"
                    placeholder="请选择日期"
                    style="width: 100%"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="被测单位名称" required>
                  <el-input v-model="item.assessedUnitName" placeholder="请输入被测单位名称" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="被测单位行业" required>
                  <el-input v-model="item.assessedUnitIndustry" placeholder="请输入行业" />
                </el-form-item>
              </el-col>
            </el-row>

            <el-row :gutter="12">
              <el-col :span="8">
                <el-form-item label="被测单位联系" required>
                  <el-input v-model="item.assessedUnitContact" placeholder="请输入联系人" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="联系方式" required>
                  <el-input v-model="item.assessedUnitMobile" placeholder="请输入联系方式" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="项目地址" required>
                  <el-input v-model="item.assessedUnitAddress" placeholder="请输入地址" />
                </el-form-item>
              </el-col>
            </el-row>

            <el-row :gutter="12">
              <el-col :span="8">
                <el-form-item label="是否有备案证" required>
                  <el-select v-model="item.hasFilingCertificate" style="width: 100%">
                    <el-option label="是" :value="true" />
                    <el-option label="否" :value="false" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="备案证明编号">
                  <el-input
                    v-model="item.filingCertificateNo"
                    placeholder="有备案证明时建议填写证书号"
                    :disabled="!item.hasFilingCertificate"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="证明出具时间">
                  <el-date-picker
                    v-model="item.filingCertificateIssuedAt"
                    type="date"
                    value-format="YYYY-MM-DD"
                    placeholder="请选择日期"
                    style="width: 100%"
                    :disabled="!item.hasFilingCertificate"
                  />
                </el-form-item>
              </el-col>
            </el-row>

            <el-form-item label="备案证明附件" :required="item.hasFilingCertificate">
              <el-input
                v-model="item.filingCertificateFilesText"
                type="textarea"
                :rows="2"
                placeholder="每行一个文件对象键"
                :disabled="!item.hasFilingCertificate"
              />
            </el-form-item>

            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="是否有备案表" required>
                  <el-select v-model="item.hasFilingForm" style="width: 100%">
                    <el-option label="是" :value="true" />
                    <el-option label="否" :value="false" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="备案表附件" :required="item.hasFilingForm">
                  <el-input
                    v-model="item.filingFormFilesText"
                    type="textarea"
                    :rows="2"
                    placeholder="每行一个文件对象键"
                    :disabled="!item.hasFilingForm"
                  />
                </el-form-item>
              </el-col>
            </el-row>

            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="是否有定级报告" required>
                  <el-select v-model="item.hasClassificationReport" style="width: 100%">
                    <el-option label="是" :value="true" />
                    <el-option label="否" :value="false" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="定级报告附件" :required="item.hasClassificationReport">
                  <el-input
                    v-model="item.classificationReportFilesText"
                    type="textarea"
                    :rows="2"
                    placeholder="每行一个文件对象键"
                    :disabled="!item.hasClassificationReport"
                  />
                </el-form-item>
              </el-col>
            </el-row>
          </el-card>
        </div>

        <el-button plain @click="addSystemItem">新增系统明细</el-button>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="saveRow">保存</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="traceVisible" title="流程轨迹" size="600px">
      <el-empty v-if="traceRows.length === 0" description="暂无流程轨迹" />
      <el-timeline v-else>
        <el-timeline-item
          v-for="item in traceRows"
          :key="item.id"
          :timestamp="item.createdAt"
          :type="traceType(item.action)"
        >
          <div class="trace-title">{{ traceActionLabel(item.action) }}</div>
          <div class="trace-line">
            状态流转：{{ statusLabel(item.fromStatus || "-") }} -> {{ statusLabel(item.toStatus || "-") }}
          </div>
          <div class="trace-line">流程状态：{{ workflowStatusLabel(item.workflowStatus) }}</div>
          <div class="trace-line">处理人：{{ item.operator }}</div>
          <div class="trace-line" v-if="item.remark">备注：{{ item.remark }}</div>
        </el-timeline-item>
      </el-timeline>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
/**
 * @input Project register APIs, contract archive list, and workflow trace APIs for full node-5 lifecycle handling
 * @output Node-5 project register UI with create/edit/submit/delete actions and workflow trace visualization
 * @position Project registration stage page enforcing archived-contract selection and system-detail completeness
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { computed, onMounted, reactive, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  createProjectRegister,
  deleteProjectRegister,
  fetchProjectRegisterDetail,
  fetchProjectRegisterTrace,
  fetchProjectRegisters,
  submitProjectRegisterReview,
  updateProjectRegister,
  type ProjectRegisterPayload,
  type ProjectRegisterRecord,
  type ProjectSystemItemPayload,
  type WorkflowTraceRecord
} from "./project-register-service";
import { fetchContracts, type ContractRecord } from "./contract-service";

interface FormSystemItem extends ProjectSystemItemPayload {
  filingCertificateFilesText: string;
  filingFormFilesText: string;
  classificationReportFilesText: string;
}

interface FormState {
  contractId: number;
  contractYear: number;
  systemItems: FormSystemItem[];
}

const loading = ref(false);
const submitting = ref(false);
const rows = ref<ProjectRegisterRecord[]>([]);
const contracts = ref<ContractRecord[]>([]);
const dialogVisible = ref(false);
const editingId = ref<number | null>(null);
const traceVisible = ref(false);
const traceRows = ref<WorkflowTraceRecord[]>([]);

const form = reactive<FormState>({
  contractId: 0,
  contractYear: 0,
  systemItems: [newSystemItem()]
});

const archivedContracts = computed(() =>
  contracts.value.filter((item) => item.archiveStatus === "ARCHIVED")
);

const selectedContract = computed(() =>
  archivedContracts.value.find((item) => item.id === form.contractId)
);

const yearOptions = computed(() => selectedContract.value?.serviceYears ?? []);

const usedYearsByContract = computed(() => {
  const map = new Map<number, Set<number>>();
  rows.value.forEach((item) => {
    if (editingId.value && item.id === editingId.value) {
      return;
    }
    if (!map.has(item.contractId)) {
      map.set(item.contractId, new Set<number>());
    }
    map.get(item.contractId)?.add(item.contractYear);
  });
  return map;
});

watch(
  () => form.contractId,
  (value) => {
    if (!value) {
      form.contractYear = 0;
      return;
    }
    const options = yearOptions.value.filter((year) => !isYearDisabled(year));
    if (!options.includes(form.contractYear)) {
      form.contractYear = options[0] ?? 0;
    }
    form.systemItems.forEach((item) => applyContractPreset(item));
  }
);

function newSystemItem(): FormSystemItem {
  return {
    systemName: "",
    filingAgency: "",
    securityLevel: "",
    reassessment: false,
    requiredEntryDate: "",
    requiredReportDeliveryDate: "",
    assessedUnitName: "",
    assessedUnitIndustry: "",
    assessedUnitContact: "",
    assessedUnitMobile: "",
    assessedUnitAddress: "",
    hasFilingCertificate: false,
    filingCertificateFiles: [],
    filingCertificateNo: "",
    filingCertificateIssuedAt: "",
    hasFilingForm: false,
    filingFormFiles: [],
    hasClassificationReport: false,
    classificationReportFiles: [],
    filingCertificateFilesText: "",
    filingFormFilesText: "",
    classificationReportFilesText: ""
  };
}

function applyContractPreset(item: FormSystemItem) {
  const contract = selectedContract.value;
  if (!contract) {
    return;
  }
  if (!item.assessedUnitName.trim()) {
    item.assessedUnitName = contract.customerName || "";
  }
  if (!item.assessedUnitContact.trim()) {
    item.assessedUnitContact = contract.contactName || "";
  }
  if (!item.assessedUnitMobile.trim()) {
    item.assessedUnitMobile = contract.mobilePhone || "";
  }
}

function resetForm() {
  form.contractId = 0;
  form.contractYear = 0;
  form.systemItems = [newSystemItem()];
}

function openCreate() {
  editingId.value = null;
  resetForm();
  dialogVisible.value = true;
}

async function openEdit(row: ProjectRegisterRecord) {
  try {
    const detail = await fetchProjectRegisterDetail(row.id);
    editingId.value = row.id;
    form.contractId = detail.contractId;
    form.contractYear = detail.contractYear;
    form.systemItems = detail.systemItems.map((item) => ({
      ...item,
      filingCertificateFilesText: filesToText(item.filingCertificateFiles),
      filingFormFilesText: filesToText(item.filingFormFiles),
      classificationReportFilesText: filesToText(item.classificationReportFiles)
    }));
    if (form.systemItems.length === 0) {
      form.systemItems = [newSystemItem()];
    }
    dialogVisible.value = true;
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "加载项目登记详情失败"));
  }
}

function addSystemItem() {
  const item = newSystemItem();
  applyContractPreset(item);
  form.systemItems.push(item);
}

function removeSystemItem(index: number) {
  form.systemItems.splice(index, 1);
}

function parseFileLines(text: string) {
  const normalized = text.replace(/\r/g, "");
  const rows = normalized
    .split("\n")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return Array.from(new Set(rows));
}

function filesToText(files: string[] | undefined) {
  if (!files?.length) {
    return "";
  }
  return files.join("\n");
}

function normalizeSystemItem(item: FormSystemItem): ProjectSystemItemPayload {
  return {
    systemName: item.systemName.trim(),
    filingAgency: item.filingAgency.trim(),
    securityLevel: item.securityLevel,
    reassessment: !!item.reassessment,
    requiredEntryDate: item.requiredEntryDate,
    requiredReportDeliveryDate: item.requiredReportDeliveryDate,
    assessedUnitName: item.assessedUnitName.trim(),
    assessedUnitIndustry: item.assessedUnitIndustry.trim(),
    assessedUnitContact: item.assessedUnitContact.trim(),
    assessedUnitMobile: item.assessedUnitMobile.trim(),
    assessedUnitAddress: item.assessedUnitAddress.trim(),
    hasFilingCertificate: !!item.hasFilingCertificate,
    filingCertificateFiles: item.hasFilingCertificate
      ? parseFileLines(item.filingCertificateFilesText)
      : [],
    filingCertificateNo: item.hasFilingCertificate ? item.filingCertificateNo?.trim() : undefined,
    filingCertificateIssuedAt: item.hasFilingCertificate
      ? item.filingCertificateIssuedAt || undefined
      : undefined,
    hasFilingForm: !!item.hasFilingForm,
    filingFormFiles: item.hasFilingForm ? parseFileLines(item.filingFormFilesText) : [],
    hasClassificationReport: !!item.hasClassificationReport,
    classificationReportFiles: item.hasClassificationReport
      ? parseFileLines(item.classificationReportFilesText)
      : []
  };
}

function isYearDisabled(year: number) {
  const yearSet = usedYearsByContract.value.get(form.contractId);
  if (!yearSet) {
    return false;
  }
  return yearSet.has(year);
}

function statusLabel(status: string) {
  if (status === "SUBMITTED") return "待审核";
  if (status === "APPROVED") return "已通过";
  if (status === "REJECTED") return "已驳回";
  if (status === "DRAFT") return "草稿";
  return status || "-";
}

function statusTagType(status: string) {
  if (status === "SUBMITTED") return "warning";
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "danger";
  return "info";
}

function workflowStatusLabel(status?: string) {
  if (status === "PENDING") return "待审核";
  if (status === "APPROVED") return "已完成";
  if (status === "REJECTED") return "已驳回";
  return status || "-";
}

function workflowTagType(status?: string) {
  if (status === "PENDING") return "warning";
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "danger";
  return "info";
}

function canEdit(status: string) {
  return status === "DRAFT" || status === "REJECTED";
}

function canDelete(status: string) {
  return status === "DRAFT" || status === "REJECTED";
}

function canSubmit(status: string) {
  return status === "DRAFT" || status === "REJECTED";
}

function traceActionLabel(action: string) {
  if (action === "SUBMIT") return "提交审核";
  if (action === "RESUBMIT") return "重新提交";
  if (action === "APPROVE") return "审核通过";
  if (action === "REJECT") return "审核驳回";
  if (action === "POLICE_REGISTER_SAVE") return "公安登记保存";
  if (action === "POLICE_REGISTER_SUBMIT") return "公安登记提交";
  if (action === "ON_SITE_ASSESSMENT_SAVE") return "现场测评保存";
  if (action === "ON_SITE_ASSESSMENT_SUBMIT") return "现场测评提交";
  if (action === "QUALITY_ASSIGN_SAVE") return "质量审核人分配";
  if (action === "QUALITY_REVIEW_APPLY_SUBMIT") return "质量审核申请提交";
  if (action === "QUALITY_REVIEW_FINISH") return "质量审核完成";
  return action;
}

function traceType(action: string) {
  if (action === "APPROVE" || action.endsWith("_APPROVE") || action === "QUALITY_REVIEW_FINISH") {
    return "success";
  }
  if (action === "REJECT" || action.endsWith("_REJECT")) return "danger";
  return "primary";
}
function readErrorMessage(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof message === "string" && message.trim() ? message : fallback;
}

function validateItem(item: FormSystemItem, index: number) {
  const indexLabel = `第 ${index + 1} 条系统明细：`;
  if (!item.systemName.trim()) return `${indexLabel}缺少系统名称`;
  if (!item.filingAgency.trim()) return `${indexLabel}缺少备案机关`;
  if (!item.securityLevel) return `${indexLabel}缺少安全保护等级`;
  if (!item.requiredEntryDate) return `${indexLabel}缺少要求入场时间`;
  if (!item.requiredReportDeliveryDate) return `${indexLabel}缺少报告交付日期`;
  if (!item.assessedUnitName.trim()) return `${indexLabel}缺少被测单位名称`;
  if (!item.assessedUnitIndustry.trim()) return `${indexLabel}缺少被测单位行业`;
  if (!item.assessedUnitContact.trim()) return `${indexLabel}缺少被测单位联系人`;
  if (!item.assessedUnitMobile.trim()) return `${indexLabel}缺少联系方式`;
  if (!item.assessedUnitAddress.trim()) return `${indexLabel}缺少项目地址`;

  const filingCertificateFiles = parseFileLines(item.filingCertificateFilesText);
  const filingFormFiles = parseFileLines(item.filingFormFilesText);
  const classificationReportFiles = parseFileLines(item.classificationReportFilesText);

  if (item.hasFilingCertificate && filingCertificateFiles.length === 0) {
    return `${indexLabel}已选择有备案证明，必须填写备案证明附件`;
  }
  if (item.hasFilingForm && filingFormFiles.length === 0) {
    return `${indexLabel}已选择有备案表，必须填写备案表附件`;
  }
  if (item.hasClassificationReport && classificationReportFiles.length === 0) {
    return `${indexLabel}已选择有定级报告，必须填写定级报告附件`;
  }
  if (filingCertificateFiles.length > 5 || filingFormFiles.length > 5 || classificationReportFiles.length > 5) {
    return `${indexLabel}附件超过上限（每个附件字段最多5行）`;
  }
  return "";
}

async function saveRow() {
  if (!form.contractId) {
    ElMessage.warning("请选择合同");
    return;
  }
  if (!form.contractYear) {
    ElMessage.warning("请选择合同年份");
    return;
  }
  if (form.systemItems.length === 0) {
    ElMessage.warning("至少要一条系统明细");
    return;
  }
  const invalidMessage = form.systemItems.map(validateItem).find((item) => item.length > 0);
  if (invalidMessage) {
    ElMessage.warning(invalidMessage);
    return;
  }

  submitting.value = true;
  try {
    const payload: ProjectRegisterPayload = {
      contractId: form.contractId,
      contractYear: form.contractYear,
      systemItems: form.systemItems.map(normalizeSystemItem)
    };
    if (editingId.value) {
      await updateProjectRegister(editingId.value, payload);
      ElMessage.success("项目登记更新成功");
    } else {
      await createProjectRegister(payload);
      ElMessage.success("项目登记创建成功");
    }
    dialogVisible.value = false;
    await loadAll();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "保存项目登记失败"));
  } finally {
    submitting.value = false;
  }
}

async function submitReview(row: ProjectRegisterRecord) {
  try {
    await ElMessageBox.confirm(`确认提交审核：${row.applicationName} 吗？`, "提交审核", {
      type: "warning",
      confirmButtonText: "确认",
      cancelButtonText: "取消"
    });
  } catch {
    return;
  }
  try {
    await submitProjectRegisterReview(row.id);
    ElMessage.success("已提交审核，请在流程任务中心处理");
    await loadAll();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "提交审核失败"));
  }
}

async function removeRow(row: ProjectRegisterRecord) {
  try {
    await ElMessageBox.confirm(`确认删除项目登记 ${row.applicationName} 吗？`, "删除确认", {
      type: "warning",
      confirmButtonText: "确认",
      cancelButtonText: "取消"
    });
  } catch {
    return;
  }
  try {
    await deleteProjectRegister(row.id);
    ElMessage.success("项目登记已删除");
    await loadAll();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "删除项目登记失败"));
  }
}

async function openTrace(row: ProjectRegisterRecord) {
  try {
    traceRows.value = await fetchProjectRegisterTrace(row.id);
    traceVisible.value = true;
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "加载流程轨迹失败"));
  }
}

async function loadAll() {
  loading.value = true;
  try {
    const [projectRows, contractRows] = await Promise.all([
      fetchProjectRegisters(),
      fetchContracts()
    ]);
    rows.value = projectRows;
    contracts.value = contractRows;
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "加载项目登记数据失败"));
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadAll();
});
</script>

<style scoped>
.page {
  max-width: 1280px;
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

.system-list {
  margin: 16px 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.system-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.trace-title {
  font-weight: 600;
  margin-bottom: 4px;
}

.trace-line {
  line-height: 1.7;
  color: #4d5b69;
}
</style>
