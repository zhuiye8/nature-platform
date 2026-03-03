<template>
  <div class="task-detail page-shell page section-stack">
    <header class="page-header">
      <div class="page-title-group">
        <h2 class="page-title">审核详情</h2>
        <p class="page-subtitle">聚焦业务信息与附件，审核操作统一在本页完成。</p>
      </div>
      <el-space wrap>
        <el-button
          v-if="canReview"
          type="success"
          :loading="actionLoading === 'approve'"
          @click="approveCurrentTask"
        >
          通过
        </el-button>
        <el-button
          v-if="canReview"
          type="danger"
          :loading="actionLoading === 'reject'"
          @click="rejectDialogVisible = true"
        >
          需要整改
        </el-button>
        <el-button :loading="loading" @click="loadDetail">刷新</el-button>
        <el-button @click="goBack">返回</el-button>
      </el-space>
    </header>

    <el-alert v-if="errorText" type="error" :closable="false" show-icon :title="errorText" />

    <el-card class="progress-card" shadow="never" v-loading="loading">
      <div class="progress-head">
        <div class="progress-title-group">
          <h3>审核流程</h3>
          <p>当前节点：{{ currentStepLabel }}</p>
        </div>
        <el-tag :type="statusTagType(taskStatus)">{{ statusLabel(taskStatus) }}</el-tag>
      </div>
      <el-steps :active="stepActiveIndex" finish-status="success" align-center>
        <el-step v-for="step in displaySteps" :key="step.key" :title="step.label" />
      </el-steps>
    </el-card>

    <el-card class="summary-card" shadow="never" v-loading="loading">
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="业务标题">{{ activeTask?.bizTitle || summaryTitle || "-" }}</el-descriptions-item>
        <el-descriptions-item label="任务类型">{{ taskTypeLabel(taskType) }}</el-descriptions-item>
        <el-descriptions-item label="业务ID">{{ bizId }}</el-descriptions-item>
        <el-descriptions-item label="任务ID">{{ activeTaskId || "-" }}</el-descriptions-item>
        <el-descriptions-item label="提交人">{{ activeTask?.submittedBy || "-" }}</el-descriptions-item>
        <el-descriptions-item label="提交时间">{{ activeTask?.submittedAt || "-" }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-tabs class="detail-tabs">
      <el-tab-pane label="业务信息">
        <template v-if="isContractTask && contractDetail">
          <el-card class="section-card" header="合同业务信息" shadow="never">
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item v-for="field in contractFieldItems" :key="field.label" :label="field.label">
                {{ field.value }}
              </el-descriptions-item>
            </el-descriptions>
          </el-card>

          <el-card v-if="contractSystemItems.length" class="section-card" header="系统清单" shadow="never">
            <el-table :data="contractSystemItems" empty-text="暂无系统清单">
              <el-table-column prop="systemLevel" label="系统级别" width="140" />
              <el-table-column prop="systemName" label="系统名称" min-width="260" />
            </el-table>
          </el-card>
        </template>

        <template v-else-if="isProjectTask && projectSections.length > 0">
          <el-card
            v-for="section in projectSections"
            :key="section.key"
            class="section-card"
            :header="section.title"
            shadow="never"
          >
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item
                v-for="field in section.fields"
                :key="`${section.key}-${field.label}`"
                :label="field.label"
              >
                {{ field.value }}
              </el-descriptions-item>
            </el-descriptions>

            <el-table
              v-if="section.systemItems?.length"
              :data="section.systemItems"
              style="margin-top: 12px"
              empty-text="暂无系统明细"
            >
              <el-table-column prop="systemName" label="系统名称" min-width="180" />
              <el-table-column prop="filingAgency" label="备案机关" min-width="140" />
              <el-table-column prop="securityLevel" label="定级" width="90" />
              <el-table-column prop="reassessment" label="复测" width="80">
                <template #default="{ row }">{{ booleanLabel(row.reassessment) }}</template>
              </el-table-column>
              <el-table-column prop="requiredEntryDate" label="计划进场" width="120" />
              <el-table-column prop="requiredReportDeliveryDate" label="计划交付" width="120" />
              <el-table-column prop="assessedUnitName" label="被测单位" min-width="180" />
              <el-table-column prop="assessedUnitIndustry" label="行业" width="120" />
              <el-table-column prop="assessedUnitContact" label="联系人" width="120" />
              <el-table-column prop="assessedUnitMobile" label="联系电话" width="130" />
              <el-table-column prop="assessedUnitAddress" label="详细地址" min-width="220" show-overflow-tooltip />
            </el-table>

            <el-table
              v-if="section.reviewTasks?.length"
              :data="section.reviewTasks"
              style="margin-top: 12px"
              empty-text="暂无任务记录"
            >
              <el-table-column prop="reviewRole" label="审核角色" width="180" />
              <el-table-column prop="assignee" label="待处理人" width="140" />
              <el-table-column prop="status" label="状态" width="120">
                <template #default="{ row }">
                  <el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="processedBy" label="实际处理人" width="140" />
              <el-table-column prop="processedAt" label="处理时间" min-width="170" />
            </el-table>
          </el-card>
        </template>

        <el-empty v-else description="暂无业务信息" :image-size="72" />
      </el-tab-pane>

      <el-tab-pane :label="`附件资料（${attachmentRows.length}）`">
        <el-card class="section-card" shadow="never">
          <el-alert
            type="info"
            :closable="false"
            show-icon
            title="附件下载会根据当前账号与任务上下文进行权限校验。"
          />
          <el-table :data="attachmentRows" empty-text="暂无附件" style="margin-top: 12px">
            <el-table-column prop="stage" label="来源阶段" width="160" />
            <el-table-column prop="field" label="业务字段" width="180" show-overflow-tooltip />
            <el-table-column prop="fileName" label="文件名" min-width="220" show-overflow-tooltip />
            <el-table-column prop="objectKey" label="对象键" min-width="320" show-overflow-tooltip />
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <el-button
                  size="small"
                  type="primary"
                  :loading="downloadObjectKey === row.objectKey"
                  @click="downloadAttachment(row.objectKey)"
                >
                  下载
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="rejectDialogVisible" title="填写整改要求" width="520px">
      <el-form label-position="top">
        <el-form-item label="整改要求" required>
          <el-input
            v-model="rejectRemark"
            type="textarea"
            :rows="4"
            maxlength="300"
            show-word-limit
            placeholder="请输入整改要求"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectDialogVisible = false">取消</el-button>
        <el-button type="danger" :loading="actionLoading === 'reject'" @click="rejectCurrentTask">确认整改</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * @input Route params/query, workflow/contract/task-detail APIs, and file download-url API
 * @output Unified review detail page with node steps, business sections, attachments, and in-page review actions
 * @position Frontend review detail page for contract and project-report chains
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { computed, onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useRoute, useRouter } from "vue-router";
import { fetchFileDownloadUrl } from "./file-service";
import { fetchTaskDetail, type TaskDetailAttachmentItem, type TaskDetailRecord } from "./task-details-service";
import { isProjectWorkflowTask, normalizeTaskType } from "./task-detail-service";
import {
  approveTask,
  fetchContractReviewDetail,
  fetchTodoTasks,
  rejectTask,
  type ContractDetail,
  type WorkflowTask
} from "./workflow-service";

interface DetailStep {
  key: string;
  label: string;
  order: number;
}

interface FieldItem {
  label: string;
  value: string | number;
}

interface ProjectSection {
  key: string;
  title: string;
  order: number;
  fields: FieldItem[];
  systemItems?: TaskDetailRecord["projectRegister"]["systemItems"];
  reviewTasks?: Array<{
    reviewRole?: string;
    assignee?: string;
    status?: string;
    processedBy?: string;
    processedAt?: string;
  }>;
}

const PROJECT_FLOW_STEPS: DetailStep[] = [
  { key: "project-register", label: "项目登记", order: 1 },
  { key: "police-register", label: "公安登记", order: 2 },
  { key: "on-site-assessment", label: "现场测评", order: 3 },
  { key: "report-tech-review", label: "技术审核", order: 4 },
  { key: "report-content-review", label: "内容审核", order: 5 },
  { key: "report-compile-assignment", label: "编制分配", order: 6 },
  { key: "report-compile-submission", label: "报告编制", order: 7 },
  { key: "report-final-review", label: "最终审核", order: 8 },
  { key: "material-archive", label: "材料归档", order: 9 }
];

const CONTRACT_FLOW_STEPS: DetailStep[] = [
  { key: "contract-submit", label: "合同提审", order: 1 },
  { key: "contract-review", label: "合同审核", order: 2 },
  { key: "contract-archive", label: "合同归档", order: 3 }
];

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const errorText = ref("");
const contractDetail = ref<ContractDetail | null>(null);
const detailRecord = ref<TaskDetailRecord | null>(null);
const activeTask = ref<WorkflowTask | null>(null);
const actionLoading = ref<"" | "approve" | "reject">("");
const rejectDialogVisible = ref(false);
const rejectRemark = ref("");
const downloadObjectKey = ref("");

const taskType = computed(() => normalizeTaskType(String(route.params.taskType || "")));
const bizId = computed(() => {
  const raw = Number(route.params.bizId);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
});
const routeTaskId = computed(() => String(route.query.taskId || "").trim());
const isProjectTask = computed(() => isProjectWorkflowTask(taskType.value));
const isContractTask = computed(() => taskType.value === "CONTRACT");
const summaryTitle = computed(() => detailRecord.value?.applicationName || contractDetail.value?.contractName || "");
const activeTaskId = computed(() => activeTask.value?.taskId || routeTaskId.value);
const taskStatus = computed(
  () =>
    activeTask.value?.displayStatus ||
    activeTask.value?.status ||
    detailRecord.value?.workflowStatus ||
    contractDetail.value?.reviewStatus ||
    ""
);
const currentNode = computed(() => activeTask.value?.currentNode || detailRecord.value?.workflowNode || "");
const currentNodeOrder = computed(() => resolveNodeOrder(currentNode.value));

const displaySteps = computed(() => (isContractTask.value ? CONTRACT_FLOW_STEPS : PROJECT_FLOW_STEPS));
const stepActiveOrder = computed(() => (isContractTask.value ? resolveContractStepOrder() : resolveProjectStepOrder()));
const stepActiveIndex = computed(() => Math.min(Math.max(stepActiveOrder.value - 1, 0), displaySteps.value.length - 1));
const currentStepLabel = computed(() => displaySteps.value[stepActiveIndex.value]?.label || "-");

const canReview = computed(() => {
  if (!activeTaskId.value) {
    return false;
  }
  const normalized = normalizeStatus(taskStatus.value);
  return normalized === "PENDING" || normalized === "SUBMITTED";
});

const contractFieldItems = computed<FieldItem[]>(() => {
  if (!contractDetail.value) {
    return [];
  }
  const detail = contractDetail.value as unknown as Record<string, unknown>;
  return [
    field("合同ID", contractDetail.value.id),
    field("合同编号", contractDetail.value.contractNo),
    field("合同名称", contractDetail.value.contractName),
    field("项目名称", contractDetail.value.projectName),
    field("客户名称", contractDetail.value.customerName),
    field("联系人", detail.contactName),
    field("联系电话", detail.mobilePhone),
    field("付款单位", detail.paymentCompany),
    field("付款金额", detail.paymentAmount),
    field("付款方式", detail.paymentMethod),
    field("合作方", detail.partnerName),
    field("销售人员", detail.salesPerson),
    field("履约城市", detail.performanceCity),
    field("成交状态", detail.dealStatus),
    field("合同类型", detail.contractType),
    field("服务年份", contractDetail.value.serviceYears?.join("、")),
    field("服务年份明细", detail.serviceYearDetail),
    field("回款状态", paymentStatusLabel(detail.paymentStatus as string | undefined)),
    field("审核状态", statusLabel(contractDetail.value.reviewStatus)),
    field("归档状态", statusLabel(contractDetail.value.archiveStatus)),
    field("创建人", contractDetail.value.createdBy),
    field("创建时间", contractDetail.value.createdAt),
    field("备注", contractDetail.value.remark)
  ];
});

const contractSystemItems = computed(() => {
  const detail = contractDetail.value as unknown as { systemItems?: Array<{ systemLevel: number; systemName: string }> };
  return Array.isArray(detail?.systemItems) ? detail.systemItems : [];
});

const projectSections = computed<ProjectSection[]>(() => {
  if (!detailRecord.value || !isProjectTask.value) {
    return [];
  }
  const maxOrder = currentNodeOrder.value > 0 ? currentNodeOrder.value : 9;
  const sections: ProjectSection[] = [];
  const project = detailRecord.value.projectRegister;
  if (project && maxOrder >= 1) {
    sections.push({
      key: "project",
      title: "项目登记信息",
      order: 1,
      fields: [
        field("申请单名称", detailRecord.value.applicationName),
        field("项目状态", statusLabel(detailRecord.value.projectStatus)),
        field("合同名称", project.contractName),
        field("合同年份", project.contractYear),
        field("创建人", project.createdBy),
        field("创建时间", project.createdAt)
      ],
      systemItems: project.systemItems
    });
  }
  const police = detailRecord.value.policeRegister;
  if (police && maxOrder >= 2) {
    sections.push({
      key: "police",
      title: "公安登记信息",
      order: 2,
      fields: [
        field("状态", statusLabel(police.status)),
        field("登记编号", police.registerNo),
        field("备案机关", police.filingAgency),
        field("联系人", police.contactName),
        field("联系电话", police.contactPhone),
        field("项目经理", police.projectManagerDisplayName || police.projectManagerUsername),
        field("创建人", police.createdBy),
        field("创建时间", police.createdAt),
        field("更新时间", police.updatedAt),
        field("备注", police.remark)
      ]
    });
  }
  const onSite = detailRecord.value.onSiteAssessment;
  if (onSite && maxOrder >= 3) {
    sections.push({
      key: "on-site",
      title: "现场测评信息",
      order: 3,
      fields: [
        field("状态", statusLabel(onSite.status)),
        field("测评附件", joinText(onSite.evidenceFiles)),
        field("测评说明", onSite.assessmentRemark || onSite.assessmentDetail),
        field("整改节点", onSite.rectificationNode),
        field("整改要求", onSite.rectificationRemark),
        field("整改时间", onSite.rectificationAt),
        field("创建人", onSite.createdBy),
        field("更新时间", onSite.updatedAt)
      ]
    });
  }
  const tech = detailRecord.value.reportTechReview;
  if (tech && maxOrder >= 4) {
    sections.push({
      key: "tech-review",
      title: "技术审核信息",
      order: 4,
      fields: [
        field("状态", statusLabel(tech.status)),
        field("审核人", tech.reviewer),
        field("提交时间", tech.submittedAt),
        field("完成时间", tech.finishedAt),
        field("备注", tech.remark)
      ]
    });
  }
  const content = detailRecord.value.reportContentReview;
  if (content && maxOrder >= 5) {
    sections.push({
      key: "content-review",
      title: "内容审核信息",
      order: 5,
      fields: [
        field("状态", statusLabel(content.status)),
        field("技术审核人", content.reviewerTech),
        field("管理审核人", content.reviewerManagement),
        field("网络审核人", content.reviewerNetwork),
        field("提交时间", content.submittedAt),
        field("完成时间", content.finishedAt)
      ],
      reviewTasks: content.tasks || []
    });
  }
  const assignment = detailRecord.value.reportCompileAssignment;
  if (assignment && maxOrder >= 6) {
    sections.push({
      key: "compile-assignment",
      title: "编制分配信息",
      order: 6,
      fields: [
        field("状态", statusLabel(assignment.status)),
        field("编制人", assignment.assignee),
        field("版本", assignment.versionNo),
        field("提交时间", assignment.submittedAt)
      ]
    });
  }
  const compile = detailRecord.value.reportCompileSubmission;
  if (compile && maxOrder >= 7) {
    sections.push({
      key: "compile",
      title: "报告编制信息",
      order: 7,
      fields: [
        field("状态", statusLabel(compile.status)),
        field("编制人", compile.assignee),
        field("提交人", compile.submittedBy),
        field("提交时间", compile.submittedAt),
        field("备注", compile.reportRemark)
      ]
    });
  }
  const finalReview = detailRecord.value.reportFinalReview;
  if (finalReview && maxOrder >= 8) {
    sections.push({
      key: "final-review",
      title: "最终审核信息",
      order: 8,
      fields: [
        field("状态", statusLabel(finalReview.status)),
        field("审核人", finalReview.reviewer),
        field("提交时间", finalReview.submittedAt),
        field("完成时间", finalReview.finishedAt),
        field("备注", finalReview.remark)
      ]
    });
  }
  const archive = detailRecord.value.materialArchive;
  if (archive && maxOrder >= 9) {
    sections.push({
      key: "archive",
      title: "材料归档信息",
      order: 9,
      fields: [
        field("状态", statusLabel(archive.status)),
        field("提交人", archive.submittedBy),
        field("提交时间", archive.submittedAt),
        field("材料状态", joinMaterialStatusCodes(archive.materialStatusCodes)),
        field("归档报告", joinText(archive.reportFiles)),
        field("归档表单", joinText(archive.formFiles)),
        field("备注", archive.remark)
      ]
    });
  }
  return sections;
});

const attachmentRows = computed<TaskDetailAttachmentItem[]>(() => {
  if (isContractTask.value) {
    const objectKey = contractDetail.value?.contractFileObjectKey?.trim();
    if (!objectKey) {
      return [];
    }
    return [{ stage: "合同提审", field: "合同主文件", objectKey, fileName: resolveFileName(objectKey) }];
  }
  if (!detailRecord.value?.attachments?.length) {
    return [];
  }
  if (currentNodeOrder.value <= 0) {
    return detailRecord.value.attachments;
  }
  return detailRecord.value.attachments.filter((item) => resolveAttachmentOrder(item.stage) <= currentNodeOrder.value);
});

function field(label: string, value: unknown): FieldItem {
  return { label, value: normalizeValue(value) };
}

function normalizeValue(value: unknown): string | number {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return typeof value === "number" ? value : String(value);
}

function taskTypeLabel(value: string) {
  if (value === "CONTRACT") return "合同审核";
  if (value === "PROJECT_REGISTER") return "项目登记审核";
  if (value === "REPORT_TECH_REVIEW") return "报告技术审核";
  if (value === "REPORT_CONTENT_REVIEW") return "报告内容审核";
  if (value === "REPORT_FINAL_REVIEW") return "报告最终审核";
  return value || "-";
}

function paymentStatusLabel(status?: string) {
  const normalized = normalizeStatus(status);
  if (normalized === "PAID") return "已回款";
  if (normalized === "UNPAID") return "未回款";
  return status || "-";
}

function booleanLabel(value: boolean | undefined) {
  if (value === true) return "是";
  if (value === false) return "否";
  return "-";
}

function statusLabel(status?: string) {
  const normalized = normalizeStatus(status);
  if (!normalized) return "-";
  if (normalized === "DRAFT") return "草稿";
  if (normalized === "PENDING" || normalized === "SUBMITTED") return "待审核";
  if (normalized === "APPROVED") return "已通过";
  if (normalized === "REJECTED") return "需要整改";
  if (normalized === "CLOSED") return "已关闭";
  if (normalized === "ARCHIVED") return "已归档";
  return status || "-";
}

function statusTagType(status?: string) {
  const normalized = normalizeStatus(status);
  if (normalized === "APPROVED" || normalized === "ARCHIVED") return "success";
  if (normalized === "PENDING" || normalized === "SUBMITTED") return "warning";
  if (normalized === "REJECTED") return "danger";
  return "info";
}

function normalizeStatus(status?: string) {
  if (!status) return "";
  return String(status).trim().toUpperCase();
}

function readErrorMessage(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof message === "string" && message.trim().length > 0 ? message : fallback;
}

function resolveNodeOrder(node: string) {
  const normalized = node.trim().toUpperCase();
  if (!normalized) return 0;
  if (normalized.includes("MATERIAL_ARCHIVE") || normalized.includes("MATERIAL")) return 9;
  if (normalized.includes("REPORT_FINAL_REVIEW") || normalized.includes("FINAL_REVIEW")) return 8;
  if (normalized.includes("REPORT_COMPILE_SUBMISSION") || normalized.includes("COMPILE_SUBMISSION")) return 7;
  if (normalized.includes("REPORT_COMPILE_ASSIGNMENT") || normalized.includes("COMPILE_ASSIGNMENT")) return 6;
  if (normalized.includes("REPORT_CONTENT_REVIEW") || normalized.includes("CONTENT_REVIEW")) return 5;
  if (normalized.includes("REPORT_TECH_REVIEW") || normalized.includes("TECH_REVIEW")) return 4;
  if (normalized.includes("ON_SITE_ASSESSMENT") || normalized.includes("ON_SITE")) return 3;
  if (normalized.includes("POLICE_REGISTER") || normalized.includes("POLICE")) return 2;
  if (normalized.includes("PROJECT_REGISTER") || normalized.includes("PROJECT")) return 1;
  return 0;
}

function resolveAttachmentOrder(stage: string) {
  const normalized = String(stage || "").trim();
  if (!normalized) return 0;
  if (normalized.includes("材料归档")) return 9;
  if (normalized.includes("报告编制")) return 7;
  if (normalized.includes("现场测评")) return 3;
  if (normalized.includes("项目登记")) return 1;
  return 0;
}

function resolveProjectStepOrder() {
  if (currentNodeOrder.value > 0) {
    return currentNodeOrder.value;
  }
  const maxOrder = projectSections.value.reduce((acc, item) => Math.max(acc, item.order), 0);
  return maxOrder > 0 ? maxOrder : 1;
}

function resolveContractStepOrder() {
  const reviewStatus = normalizeStatus(contractDetail.value?.reviewStatus);
  const archiveStatus = normalizeStatus(contractDetail.value?.archiveStatus);
  if (archiveStatus === "ARCHIVED") return 3;
  if (reviewStatus === "SUBMITTED" || reviewStatus === "APPROVED" || reviewStatus === "REJECTED") return 2;
  return 1;
}

function resolveFileName(objectKey: string) {
  const slashIndex = Math.max(objectKey.lastIndexOf("/"), objectKey.lastIndexOf("\\"));
  if (slashIndex < 0 || slashIndex === objectKey.length - 1) {
    return objectKey;
  }
  return objectKey.slice(slashIndex + 1);
}

function joinText(items?: string[]) {
  if (!items || items.length === 0) return "-";
  return items.join("、");
}

function joinMaterialStatusCodes(codes?: string[]) {
  if (!codes || codes.length === 0) return "-";
  return codes.map(materialStatusLabel).join("、");
}

function materialStatusLabel(code: string) {
  const normalized = normalizeStatus(code);
  if (normalized === "MATERIAL_SUMMARY_PENDING_PRINT") return "待打印材料汇总";
  if (normalized === "ASSESSMENT_REPORT") return "测评报告";
  if (normalized === "ASSESSMENT_REPORT_REVIEW_RECORD") return "测评报告评审记录";
  if (normalized === "VERIFICATION_TEST") return "验证测试";
  if (normalized === "TOOL_SCAN") return "工具扫描";
  if (normalized === "ASSESSMENT_PLAN") return "测评方案";
  if (normalized === "ASSESSMENT_PLAN_REVIEW_RECORD") return "测评方案评审记录";
  if (normalized === "ON_SITE_ASSESSMENT") return "现场测评";
  if (normalized === "PROCESS_DOCUMENT") return "过程文档";
  if (normalized === "INFORMATION_COLLECTION") return "信息收集";
  if (normalized === "PROJECT_PLAN") return "项目计划书";
  return code || "-";
}

async function loadDetail() {
  if (!taskType.value || !bizId.value) {
    errorText.value = "任务参数无效";
    return;
  }
  loading.value = true;
  errorText.value = "";
  contractDetail.value = null;
  detailRecord.value = null;
  activeTask.value = null;
  try {
    const todoRows = await fetchTodoTasks({ type: taskType.value }).catch(() => []);
    const byRouteTask = routeTaskId.value ? todoRows.find((item) => item.taskId === routeTaskId.value) : null;
    activeTask.value = byRouteTask || todoRows.find((item) => item.bizId === bizId.value) || null;

    if (isContractTask.value) {
      contractDetail.value = await fetchContractReviewDetail(bizId.value);
      return;
    }
    if (!isProjectTask.value) {
      throw new Error(`unsupported task type: ${taskType.value}`);
    }
    detailRecord.value = await fetchTaskDetail(taskType.value, bizId.value);
  } catch (error) {
    errorText.value = readErrorMessage(error, "加载审核详情失败");
    ElMessage.error(errorText.value);
  } finally {
    loading.value = false;
  }
}

async function downloadAttachment(objectKey: string) {
  if (!objectKey?.trim()) {
    ElMessage.warning("附件对象键为空，无法下载");
    return;
  }
  downloadObjectKey.value = objectKey;
  try {
    const response = await fetchFileDownloadUrl({
      objectKey: objectKey.trim(),
      taskType: taskType.value,
      bizId: bizId.value
    });
    window.open(response.url, "_blank", "noopener");
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "附件下载链接生成失败"));
  } finally {
    downloadObjectKey.value = "";
  }
}

async function approveCurrentTask() {
  if (!activeTaskId.value) {
    ElMessage.warning("未找到可审核任务");
    return;
  }
  try {
    await ElMessageBox.confirm("确认通过当前审核任务？通过后流程将推进到下一节点。", "审核通过确认", {
      type: "warning",
      confirmButtonText: "确认通过",
      cancelButtonText: "取消"
    });
  } catch {
    return;
  }
  actionLoading.value = "approve";
  try {
    await approveTask(activeTaskId.value);
    ElMessage.success("审核已通过");
    goBack();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "审核通过失败"));
  } finally {
    actionLoading.value = "";
  }
}

async function rejectCurrentTask() {
  if (!activeTaskId.value) {
    ElMessage.warning("未找到可审核任务");
    return;
  }
  if (!rejectRemark.value.trim()) {
    ElMessage.warning("请填写整改要求");
    return;
  }
  actionLoading.value = "reject";
  try {
    await rejectTask(activeTaskId.value, rejectRemark.value.trim());
    ElMessage.success("已标记需要整改");
    rejectDialogVisible.value = false;
    rejectRemark.value = "";
    await loadDetail();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "提交整改要求失败"));
  } finally {
    actionLoading.value = "";
  }
}

function goBack() {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  void router.push("/workflow");
}

onMounted(() => {
  void loadDetail();
});
</script>

<style scoped>
.task-detail {
  --detail-cyan: #2db892;
  --detail-blue: #2f6ea2;
  --detail-line: rgba(45, 184, 146, 0.22);
}

.progress-card {
  border: 1px solid var(--detail-line);
  border-radius: 14px;
  background: linear-gradient(120deg, rgba(45, 184, 146, 0.14), rgba(47, 110, 162, 0.08));
}

.progress-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.progress-title-group h3 {
  margin: 0;
  color: #103b4f;
  font-size: 16px;
  font-weight: 600;
}

.progress-title-group p {
  margin: 6px 0 0;
  color: #2f6a85;
  font-size: 13px;
}

.summary-card {
  border: 1px solid rgba(31, 152, 122, 0.16);
  border-radius: 12px;
  background: #ffffff;
}

.detail-tabs :deep(.el-tabs__item.is-active) {
  color: #0d7a9d;
  font-weight: 600;
}

.section-card {
  border: 1px solid rgba(205, 220, 230, 0.92);
  border-radius: 12px;
  background: linear-gradient(180deg, #ffffff, #fbfcfc);
  margin-bottom: 14px;
}

.section-card :deep(.el-card__header) {
  font-weight: 600;
  border-left: 4px solid rgba(45, 184, 146, 0.7);
}

@media (max-width: 960px) {
  .progress-head {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>
