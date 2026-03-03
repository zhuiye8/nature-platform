<template>
  <div class="page-shell page section-stack entity-detail-page">
    <header class="page-header">
      <div class="page-title-group">
        <h2 class="page-title">{{ pageTitle }}</h2>
        <p class="page-subtitle">{{ pageSubtitle }}</p>
      </div>
      <el-space>
        <el-button :loading="loading" @click="loadDetail">刷新</el-button>
        <el-button @click="goBack">返回</el-button>
      </el-space>
    </header>

    <el-alert v-if="errorText" type="error" :closable="false" show-icon :title="errorText" />

    <template v-if="entityType === 'customer' && customerDetail">
      <el-card class="section-card" header="客户基础信息" shadow="never" v-loading="loading">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="客户ID">{{ customerDetail.id }}</el-descriptions-item>
          <el-descriptions-item label="客户全称">{{ customerDetail.fullName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="客户行业">{{ customerDetail.industry || '-' }}</el-descriptions-item>
          <el-descriptions-item label="客户地区">{{ customerDetail.region || '-' }}</el-descriptions-item>
          <el-descriptions-item label="详细地址">{{ customerDetail.addressDetail || '-' }}</el-descriptions-item>
          <el-descriptions-item label="统一社会信用代码">{{ customerDetail.uscc || '-' }}</el-descriptions-item>
          <el-descriptions-item label="联系人">{{ customerDetail.contactName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="联系电话">{{ customerDetail.mobilePhone || '-' }}</el-descriptions-item>
          <el-descriptions-item label="创建人">{{ customerDetail.createdBy || '-' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ customerDetail.createdAt || '-' }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ customerDetail.remark || '-' }}</el-descriptions-item>
        </el-descriptions>
      </el-card>
    </template>

    <template v-else-if="entityType === 'contract' && contractDetail">
      <el-card class="section-card" header="合同基础信息" shadow="never" v-loading="loading">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="合同ID">{{ contractDetail.id }}</el-descriptions-item>
          <el-descriptions-item label="合同名称">{{ contractDetail.contractName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="合同编号">{{ contractDetail.contractNo || '-' }}</el-descriptions-item>
          <el-descriptions-item label="项目名称">{{ contractDetail.projectName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="客户名称">{{ contractDetail.customerName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="联系人">{{ contractDetail.contactName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="联系电话">{{ contractDetail.mobilePhone || '-' }}</el-descriptions-item>
          <el-descriptions-item label="服务年份">
            {{ contractDetail.serviceYears?.length ? contractDetail.serviceYears.join('、') : '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="回款状态">{{ paymentStatusLabel(contractDetail.paymentStatus) }}</el-descriptions-item>
          <el-descriptions-item label="审核状态">{{ statusLabel(contractDetail.reviewStatus) }}</el-descriptions-item>
          <el-descriptions-item label="归档状态">{{ statusLabel(contractDetail.archiveStatus) }}</el-descriptions-item>
          <el-descriptions-item label="创建人">{{ contractDetail.createdBy || '-' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ contractDetail.createdAt || '-' }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ contractDetail.remark || '-' }}</el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card class="section-card" header="系统清单" shadow="never" v-if="contractDetail.systemItems?.length">
        <el-table :data="contractDetail.systemItems" empty-text="暂无系统清单">
          <el-table-column prop="systemLevel" label="系统级别" width="120" />
          <el-table-column prop="systemName" label="系统名称" min-width="220" />
        </el-table>
      </el-card>
    </template>

    <template v-else-if="taskDetail">
      <el-card class="section-card" header="业务基础信息" shadow="never" v-loading="loading">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="项目ID">{{ taskDetail.projectRegisterId }}</el-descriptions-item>
          <el-descriptions-item label="申请单名称">{{ taskDetail.applicationName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="项目状态">{{ statusLabel(taskDetail.projectStatus) }}</el-descriptions-item>
          <el-descriptions-item label="流程节点">{{ taskDetail.workflowNode || '-' }}</el-descriptions-item>
          <el-descriptions-item label="流程状态">{{ statusLabel(taskDetail.workflowStatus) }}</el-descriptions-item>
          <el-descriptions-item label="合同名称">{{ taskDetail.projectRegister?.contractName || '-' }}</el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card class="section-card" header="项目登记" shadow="never" v-if="showProjectSections">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="创建人">{{ taskDetail.projectRegister?.createdBy || '-' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ taskDetail.projectRegister?.createdAt || '-' }}</el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card class="section-card" header="公安登记" shadow="never" v-if="showProjectSections && taskDetail.policeRegister">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="登记编号">{{ taskDetail.policeRegister.registerNo || '-' }}</el-descriptions-item>
          <el-descriptions-item label="备案机关">{{ taskDetail.policeRegister.filingAgency || '-' }}</el-descriptions-item>
          <el-descriptions-item label="项目经理">
            {{ taskDetail.policeRegister.projectManagerDisplayName || taskDetail.policeRegister.projectManagerUsername || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="备注">{{ taskDetail.policeRegister.remark || '-' }}</el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card class="section-card" header="现场测评" shadow="never" v-if="showProjectSections && taskDetail.onSiteAssessment">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="测评附件">
            {{ taskDetail.onSiteAssessment.evidenceFiles?.length ? taskDetail.onSiteAssessment.evidenceFiles.join('、') : '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="结果说明">
            {{ taskDetail.onSiteAssessment.assessmentRemark || taskDetail.onSiteAssessment.assessmentDetail || '-' }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card class="section-card" header="报告审核与编制" shadow="never" v-if="showReportSections">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="技术审核状态">{{ statusLabel(taskDetail.reportTechReview?.status) }}</el-descriptions-item>
          <el-descriptions-item label="技术审核人">{{ taskDetail.reportTechReview?.reviewer || '-' }}</el-descriptions-item>
          <el-descriptions-item label="内容审核状态">{{ statusLabel(taskDetail.reportContentReview?.status) }}</el-descriptions-item>
          <el-descriptions-item label="技术/管理/网络审核人">
            {{ [taskDetail.reportContentReview?.reviewerTech, taskDetail.reportContentReview?.reviewerManagement, taskDetail.reportContentReview?.reviewerNetwork].filter(Boolean).join(' / ') || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="编制分配状态">{{ statusLabel(taskDetail.reportCompileAssignment?.status) }}</el-descriptions-item>
          <el-descriptions-item label="编制人">{{ taskDetail.reportCompileAssignment?.assignee || '-' }}</el-descriptions-item>
          <el-descriptions-item label="报告编制状态">{{ statusLabel(taskDetail.reportCompileSubmission?.status) }}</el-descriptions-item>
          <el-descriptions-item label="报告文件">{{ taskDetail.reportCompileSubmission?.reportObjectKey || '-' }}</el-descriptions-item>
          <el-descriptions-item label="最终审核状态">{{ statusLabel(taskDetail.reportFinalReview?.status) }}</el-descriptions-item>
          <el-descriptions-item label="最终审核人">{{ taskDetail.reportFinalReview?.reviewer || '-' }}</el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card class="section-card" header="材料归档" shadow="never" v-if="showMaterialSection && taskDetail.materialArchive">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="归档状态">{{ statusLabel(taskDetail.materialArchive.status) }}</el-descriptions-item>
          <el-descriptions-item label="提交人">{{ taskDetail.materialArchive.submittedBy || '-' }}</el-descriptions-item>
          <el-descriptions-item label="材料状态" :span="2">
            {{ formatMaterialStatusCodes(taskDetail.materialArchive.materialStatusCodes) }}
          </el-descriptions-item>
          <el-descriptions-item label="归档报告" :span="2">
            {{ taskDetail.materialArchive.reportFiles?.length ? taskDetail.materialArchive.reportFiles.join('、') : '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="归档表单" :span="2">
            {{ taskDetail.materialArchive.formFiles?.length ? taskDetail.materialArchive.formFiles.join('、') : '-' }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card class="section-card" :header="`附件资料（${taskDetail.attachments?.length || 0}）`" shadow="never">
        <el-table :data="taskDetail.attachments || []" empty-text="暂无附件">
          <el-table-column prop="stage" label="来源阶段" width="140" />
          <el-table-column prop="field" label="业务字段" width="180" show-overflow-tooltip />
          <el-table-column prop="fileName" label="文件名" min-width="220" show-overflow-tooltip />
          <el-table-column prop="objectKey" label="对象键" min-width="280" show-overflow-tooltip />
        </el-table>
      </el-card>
    </template>

    <el-empty v-else description="暂无详情数据" :image-size="80" />
  </div>
</template>

<script setup lang="ts">
/**
 * @input Route entity params plus customer/contract/project aggregate detail APIs
 * @output Unified read-only business detail page for customer/contract/project/report/material entities
 * @position Global entity detail page used by list-name click and operation-column detail actions
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { computed, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { useRoute, useRouter } from "vue-router";
import { fetchContractDetail, type ContractRecord } from "./contract-service";
import { fetchCustomerDetail, type CustomerRecord } from "./customer-service";
import { fetchTaskDetail, type TaskDetailRecord } from "./task-details-service";

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const errorText = ref("");
const customerDetail = ref<CustomerRecord | null>(null);
const contractDetail = ref<ContractRecord | null>(null);
const taskDetail = ref<TaskDetailRecord | null>(null);

const entityType = computed(() => String(route.params.entityType || "").trim().toLowerCase());
const entityId = computed(() => {
  const raw = Number(route.params.id);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
});

const pageTitle = computed(() => {
  if (entityType.value === "customer") return "客户详情";
  if (entityType.value === "contract") return "合同详情";
  if (entityType.value === "project") return "项目详情";
  if (entityType.value === "report") return "报告详情";
  if (entityType.value === "material") return "材料详情";
  return "业务详情";
});

const pageSubtitle = computed(() => {
  if (entityType.value === "customer") return "查看客户基础信息。";
  if (entityType.value === "contract") return "查看合同业务字段与系统清单。";
  if (entityType.value === "project") return "查看项目节点信息与附件。";
  if (entityType.value === "report") return "查看报告审核与编制相关信息。";
  if (entityType.value === "material") return "查看材料归档状态与附件。";
  return "查看当前业务对象详情。";
});

const showProjectSections = computed(() => entityType.value === "project");
const showReportSections = computed(() => entityType.value === "project" || entityType.value === "report");
const showMaterialSection = computed(() => entityType.value === "project" || entityType.value === "material");

function readErrorMessage(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof message === "string" && message.trim().length > 0 ? message : fallback;
}

function normalizeStatus(status?: string) {
  if (!status) return "";
  return String(status).trim().toUpperCase();
}

function statusLabel(status?: string) {
  const normalized = normalizeStatus(status);
  if (!normalized) return "-";
  if (normalized === "DRAFT") return "草稿";
  if (normalized === "PENDING" || normalized === "SUBMITTED") return "待审核";
  if (normalized === "APPROVED") return "已通过";
  if (normalized === "REJECTED") return "需要整改";
  if (normalized === "ARCHIVED") return "已归档";
  if (normalized === "CLOSED") return "已关闭";
  return status || "-";
}

function paymentStatusLabel(status?: string) {
  const normalized = normalizeStatus(status);
  if (normalized === "PAID") return "已回款";
  if (normalized === "UNPAID") return "未回款";
  return status || "-";
}

function formatMaterialStatusCodes(codes?: string[]) {
  if (!codes || codes.length === 0) return "-";
  const dict: Record<string, string> = {
    MATERIAL_SUMMARY_PENDING_PRINT: "待打印材料汇总",
    ASSESSMENT_REPORT: "测评报告",
    ASSESSMENT_REPORT_REVIEW_RECORD: "测评报告评审记录",
    VERIFICATION_TEST: "验证测试",
    TOOL_SCAN: "工具扫描",
    ASSESSMENT_PLAN: "测评方案",
    ASSESSMENT_PLAN_REVIEW_RECORD: "测评方案评审记录",
    ON_SITE_ASSESSMENT: "现场测评",
    PROCESS_DOCUMENT: "过程文档",
    INFORMATION_COLLECTION: "信息收集",
    PROJECT_PLAN: "项目计划书"
  };
  return codes.map((code) => dict[code] || code).join("、");
}

async function loadDetail() {
  if (!entityId.value) {
    errorText.value = "业务ID无效";
    return;
  }
  loading.value = true;
  errorText.value = "";
  customerDetail.value = null;
  contractDetail.value = null;
  taskDetail.value = null;
  try {
    if (entityType.value === "customer") {
      customerDetail.value = await fetchCustomerDetail(entityId.value);
      return;
    }
    if (entityType.value === "contract") {
      contractDetail.value = await fetchContractDetail(entityId.value);
      return;
    }
    if (["project", "report", "material"].includes(entityType.value)) {
      taskDetail.value = await fetchTaskDetail("PROJECT_REGISTER", entityId.value);
      return;
    }
    throw new Error("unsupported entity type");
  } catch (error) {
    errorText.value = readErrorMessage(error, "加载详情失败");
    ElMessage.error(errorText.value);
  } finally {
    loading.value = false;
  }
}

function goBack() {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  void router.push("/dashboard");
}

onMounted(() => {
  void loadDetail();
});
</script>

<style scoped>
.entity-detail-page {
  padding-top: 24px;
}

.section-card {
  border: 1px solid rgba(205, 220, 230, 0.92);
  border-radius: 12px;
  background: linear-gradient(180deg, #ffffff, #fbfcfc);
}

.section-card :deep(.el-card__header) {
  font-weight: 600;
  border-left: 4px solid rgba(45, 184, 146, 0.7);
}
</style>
