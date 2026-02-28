<template>
  <div class="page-shell page section-stack">
    <header class="page-header">
      <div class="page-title-group">
        <h2 class="page-title">审核详情</h2>
        <p class="page-subtitle">展示截至当前节点的完整上下文信息，供审核与复核参考。</p>
      </div>
      <el-space>
        <el-button :loading="loading" @click="loadDetail">刷新</el-button>
        <el-button @click="goBack">返回</el-button>
      </el-space>
    </header>

    <el-card class="summary-card" v-loading="loading">
      <el-alert
        v-if="errorText"
        type="error"
        :closable="false"
        show-icon
        :title="errorText"
      />
      <template v-else>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="任务类型">{{ taskTypeLabel(taskType) }}</el-descriptions-item>
          <el-descriptions-item label="业务ID">{{ bizId }}</el-descriptions-item>
          <el-descriptions-item label="任务ID">{{ activeTaskId || "-" }}</el-descriptions-item>
          <el-descriptions-item label="任务状态">
            <el-tag :type="statusTagType(taskStatus)">{{ statusLabel(taskStatus) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="流程节点">{{ currentNode || "-" }}</el-descriptions-item>
          <el-descriptions-item label="提交时间">{{ activeTask?.submittedAt || "-" }}</el-descriptions-item>
          <el-descriptions-item label="提交人">{{ activeTask?.submittedBy || "-" }}</el-descriptions-item>
          <el-descriptions-item label="标题">{{ activeTask?.bizTitle || summaryTitle || "-" }}</el-descriptions-item>
        </el-descriptions>
      </template>
    </el-card>

    <el-card v-if="isContractTask && contractDetail" class="section-card" header="合同详情">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="合同ID">{{ contractDetail.id }}</el-descriptions-item>
        <el-descriptions-item label="合同编号">{{ contractDetail.contractNo || "-" }}</el-descriptions-item>
        <el-descriptions-item label="合同名称">{{ contractDetail.contractName || "-" }}</el-descriptions-item>
        <el-descriptions-item label="项目名称">{{ contractDetail.projectName || "-" }}</el-descriptions-item>
        <el-descriptions-item label="客户名称">{{ contractDetail.customerName || "-" }}</el-descriptions-item>
        <el-descriptions-item label="审核状态">{{ statusLabel(contractDetail.reviewStatus) }}</el-descriptions-item>
        <el-descriptions-item label="归档状态">{{ statusLabel(contractDetail.archiveStatus) }}</el-descriptions-item>
        <el-descriptions-item label="创建人">{{ contractDetail.createdBy || "-" }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ contractDetail.createdAt || "-" }}</el-descriptions-item>
        <el-descriptions-item label="服务年份">
          {{ contractDetail.serviceYears?.join("、") || "-" }}
        </el-descriptions-item>
        <el-descriptions-item label="备注">{{ contractDetail.remark || "-" }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <template v-if="isProjectTask && overview">
      <el-card class="section-card" header="项目登记" v-if="shouldShowSection(1)">
        <template v-if="overview.projectRegister">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="申请单名称">{{ overview.applicationName || "-" }}</el-descriptions-item>
            <el-descriptions-item label="项目状态">{{ statusLabel(overview.projectStatus) }}</el-descriptions-item>
            <el-descriptions-item label="合同名称">{{ overview.projectRegister.contractName || "-" }}</el-descriptions-item>
            <el-descriptions-item label="合同年份">{{ overview.projectRegister.contractYear || "-" }}</el-descriptions-item>
            <el-descriptions-item label="创建人">{{ overview.projectRegister.createdBy || "-" }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ overview.projectRegister.createdAt || "-" }}</el-descriptions-item>
          </el-descriptions>
        </template>
        <el-empty v-else description="尚未产生数据" :image-size="70" />
      </el-card>

      <el-card class="section-card" header="公安登记" v-if="shouldShowSection(2)">
        <template v-if="overview.policeRegister">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="状态">
              <el-tag :type="statusTagType(overview.policeRegister.status)">
                {{ statusLabel(overview.policeRegister.status) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="登记编号">{{ overview.policeRegister.registerNo || "-" }}</el-descriptions-item>
            <el-descriptions-item label="备案机关">{{ overview.policeRegister.filingAgency || "-" }}</el-descriptions-item>
            <el-descriptions-item label="联系人">{{ overview.policeRegister.contactName || "-" }}</el-descriptions-item>
            <el-descriptions-item label="联系电话">{{ overview.policeRegister.contactPhone || "-" }}</el-descriptions-item>
            <el-descriptions-item label="备注">{{ overview.policeRegister.remark || "-" }}</el-descriptions-item>
          </el-descriptions>
        </template>
        <el-empty v-else description="尚未产生数据" :image-size="70" />
      </el-card>

      <el-card class="section-card" header="现场测评" v-if="shouldShowSection(3)">
        <template v-if="overview.onSiteAssessment">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="状态">
              <el-tag :type="statusTagType(overview.onSiteAssessment.status)">
                {{ statusLabel(overview.onSiteAssessment.status) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="测评压缩包">
              {{ overview.onSiteAssessment.packageObjectKey || "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="技术审核人">{{ overview.onSiteAssessment.techReviewer || "-" }}</el-descriptions-item>
            <el-descriptions-item label="内容技术">{{ overview.onSiteAssessment.contentReviewerTech || "-" }}</el-descriptions-item>
            <el-descriptions-item label="内容管理">{{ overview.onSiteAssessment.contentReviewerManagement || "-" }}</el-descriptions-item>
            <el-descriptions-item label="内容网络">{{ overview.onSiteAssessment.contentReviewerNetwork || "-" }}</el-descriptions-item>
          </el-descriptions>
        </template>
        <el-empty v-else description="尚未产生数据" :image-size="70" />
      </el-card>

      <el-card class="section-card" header="质量审核" v-if="shouldShowSection(4)">
        <template v-if="overview.qualityReview">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="状态">
              <el-tag :type="statusTagType(overview.qualityReview.status)">
                {{ statusLabel(overview.qualityReview.status) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="提交人">{{ overview.qualityReview.appliedBy || "-" }}</el-descriptions-item>
            <el-descriptions-item label="提交时间">{{ overview.qualityReview.submittedAt || "-" }}</el-descriptions-item>
            <el-descriptions-item label="完成时间">{{ overview.qualityReview.finishedAt || "-" }}</el-descriptions-item>
          </el-descriptions>
          <el-table
            :data="overview.qualityReview.tasks || []"
            style="margin-top: 12px"
            empty-text="暂无任务记录"
          >
            <el-table-column prop="reviewRole" label="审核角色" width="180" />
            <el-table-column prop="assignee" label="处理人" width="140" />
            <el-table-column prop="status" label="状态" width="120">
              <template #default="{ row }">
                <el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="processedBy" label="处理人" width="140" />
            <el-table-column prop="processedAt" label="处理时间" min-width="170" />
          </el-table>
        </template>
        <el-empty v-else description="尚未产生数据" :image-size="70" />
      </el-card>

      <el-card class="section-card" header="技术审核" v-if="shouldShowSection(5)">
        <template v-if="overview.reportTechReview">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="状态">
              <el-tag :type="statusTagType(overview.reportTechReview.status)">
                {{ statusLabel(overview.reportTechReview.status) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="审核人">{{ overview.reportTechReview.reviewer || "-" }}</el-descriptions-item>
            <el-descriptions-item label="提交时间">{{ overview.reportTechReview.submittedAt || "-" }}</el-descriptions-item>
            <el-descriptions-item label="完成时间">{{ overview.reportTechReview.finishedAt || "-" }}</el-descriptions-item>
            <el-descriptions-item label="备注">{{ overview.reportTechReview.remark || "-" }}</el-descriptions-item>
          </el-descriptions>
        </template>
        <el-empty v-else description="尚未产生数据" :image-size="70" />
      </el-card>

      <el-card class="section-card" header="内容审核" v-if="shouldShowSection(6)">
        <template v-if="overview.reportContentReview">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="状态">
              <el-tag :type="statusTagType(overview.reportContentReview.status)">
                {{ statusLabel(overview.reportContentReview.status) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="技术审核人">{{ overview.reportContentReview.reviewerTech || "-" }}</el-descriptions-item>
            <el-descriptions-item label="管理审核人">{{ overview.reportContentReview.reviewerManagement || "-" }}</el-descriptions-item>
            <el-descriptions-item label="网络审核人">{{ overview.reportContentReview.reviewerNetwork || "-" }}</el-descriptions-item>
            <el-descriptions-item label="提交时间">{{ overview.reportContentReview.submittedAt || "-" }}</el-descriptions-item>
            <el-descriptions-item label="完成时间">{{ overview.reportContentReview.finishedAt || "-" }}</el-descriptions-item>
          </el-descriptions>
          <el-table
            :data="overview.reportContentReview.tasks || []"
            style="margin-top: 12px"
            empty-text="暂无任务记录"
          >
            <el-table-column prop="reviewRole" label="审核角色" width="180" />
            <el-table-column prop="assignee" label="处理人" width="140" />
            <el-table-column prop="status" label="状态" width="120">
              <template #default="{ row }">
                <el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="processedBy" label="处理人" width="140" />
            <el-table-column prop="processedAt" label="处理时间" min-width="170" />
          </el-table>
        </template>
        <el-empty v-else description="尚未产生数据" :image-size="70" />
      </el-card>

      <el-card class="section-card" header="编制分配" v-if="shouldShowSection(7)">
        <template v-if="overview.reportCompileAssignment">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="状态">
              <el-tag :type="statusTagType(overview.reportCompileAssignment.status)">
                {{ statusLabel(overview.reportCompileAssignment.status) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="编制人">{{ overview.reportCompileAssignment.assignee || "-" }}</el-descriptions-item>
            <el-descriptions-item label="版本">{{ overview.reportCompileAssignment.versionNo || "-" }}</el-descriptions-item>
            <el-descriptions-item label="提交时间">{{ overview.reportCompileAssignment.submittedAt || "-" }}</el-descriptions-item>
          </el-descriptions>
        </template>
        <el-empty v-else description="尚未产生数据" :image-size="70" />
      </el-card>

      <el-card class="section-card" header="报告编制" v-if="shouldShowSection(8)">
        <template v-if="overview.reportCompileSubmission">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="状态">
              <el-tag :type="statusTagType(overview.reportCompileSubmission.status)">
                {{ statusLabel(overview.reportCompileSubmission.status) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="编制人">{{ overview.reportCompileSubmission.assignee || "-" }}</el-descriptions-item>
            <el-descriptions-item label="报告对象键">{{ overview.reportCompileSubmission.reportObjectKey || "-" }}</el-descriptions-item>
            <el-descriptions-item label="提交人">{{ overview.reportCompileSubmission.submittedBy || "-" }}</el-descriptions-item>
            <el-descriptions-item label="提交时间">{{ overview.reportCompileSubmission.submittedAt || "-" }}</el-descriptions-item>
            <el-descriptions-item label="备注">{{ overview.reportCompileSubmission.reportRemark || "-" }}</el-descriptions-item>
          </el-descriptions>
        </template>
        <el-empty v-else description="尚未产生数据" :image-size="70" />
      </el-card>

      <el-card class="section-card" header="最终审核" v-if="shouldShowSection(9)">
        <template v-if="overview.reportFinalReview">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="状态">
              <el-tag :type="statusTagType(overview.reportFinalReview.status)">
                {{ statusLabel(overview.reportFinalReview.status) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="审核人">{{ overview.reportFinalReview.reviewer || "-" }}</el-descriptions-item>
            <el-descriptions-item label="提交时间">{{ overview.reportFinalReview.submittedAt || "-" }}</el-descriptions-item>
            <el-descriptions-item label="完成时间">{{ overview.reportFinalReview.finishedAt || "-" }}</el-descriptions-item>
            <el-descriptions-item label="备注">{{ overview.reportFinalReview.remark || "-" }}</el-descriptions-item>
          </el-descriptions>
        </template>
        <el-empty v-else description="尚未产生数据" :image-size="70" />
      </el-card>

      <el-card class="section-card" header="材料归档" v-if="shouldShowSection(10)">
        <template v-if="overview.materialArchive">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="状态">
              <el-tag :type="statusTagType(overview.materialArchive.status)">
                {{ statusLabel(overview.materialArchive.status) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="提交人">{{ overview.materialArchive.submittedBy || "-" }}</el-descriptions-item>
            <el-descriptions-item label="提交时间">{{ overview.materialArchive.submittedAt || "-" }}</el-descriptions-item>
            <el-descriptions-item label="归档报告">
              {{ joinText(overview.materialArchive.reportFiles) }}
            </el-descriptions-item>
            <el-descriptions-item label="归档表单">
              {{ joinText(overview.materialArchive.formFiles) }}
            </el-descriptions-item>
            <el-descriptions-item label="备注">{{ overview.materialArchive.remark || "-" }}</el-descriptions-item>
          </el-descriptions>
        </template>
        <el-empty v-else description="尚未产生数据" :image-size="70" />
      </el-card>

      <el-card class="section-card" header="流程轨迹">
        <el-table :data="traceRows" empty-text="暂无流程轨迹">
          <el-table-column prop="action" label="动作" min-width="180" show-overflow-tooltip />
          <el-table-column prop="workflowNode" label="流程节点" width="180" show-overflow-tooltip />
          <el-table-column prop="workflowStatus" label="流程状态" width="130">
            <template #default="{ row }">
              <el-tag :type="statusTagType(row.workflowStatus)">{{ statusLabel(row.workflowStatus) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="operator" label="处理人" width="120" />
          <el-table-column prop="createdAt" label="时间" min-width="170" />
          <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
        </el-table>
      </el-card>

      <el-card class="section-card" header="附件清单">
        <el-table :data="visibleAttachments" empty-text="暂无附件">
          <el-table-column prop="stage" label="来源阶段" width="160" />
          <el-table-column prop="field" label="字段" width="180" show-overflow-tooltip />
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
    </template>

    <el-card v-if="canReview" class="action-card" header="审核操作">
      <el-alert
        type="warning"
        :closable="false"
        show-icon
        title="请确认详情数据无误后再执行审核动作。通过后将推进流程，操作不可撤销。"
      />
      <div class="action-buttons">
        <el-button type="success" :loading="actionLoading === 'approve'" @click="approveCurrentTask">
          通过
        </el-button>
        <el-button type="danger" :loading="actionLoading === 'reject'" @click="rejectDialogVisible = true">
          需要整改
        </el-button>
      </div>
    </el-card>

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
        <el-button type="danger" :loading="actionLoading === 'reject'" @click="rejectCurrentTask">
          确认整改
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * @input Route params/query, workflow/process/contract APIs, file download-url API, and review action APIs
 * @output Unified task-detail page for all workflow task types with stage-limited visibility and in-page approve/reject actions
 * @position Frontend detail-and-review page replacing modal-based inspection in workflow and review modules
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { computed, onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useRoute, useRouter } from "vue-router";
import { fetchFileDownloadUrl } from "./file-service";
import { fetchProcessOverview, type ProcessOverviewAttachmentItem, type ProcessOverviewRecord } from "./process-overview-service";
import { fetchProjectRegisterTrace, type WorkflowTraceRecord } from "./project-register-service";
import { isProjectWorkflowTask, normalizeTaskType } from "./task-detail-service";
import {
  approveTask,
  fetchContractReviewDetail,
  fetchTodoTasks,
  rejectTask,
  type ContractDetail,
  type WorkflowTask
} from "./workflow-service";

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const errorText = ref("");
const contractDetail = ref<ContractDetail | null>(null);
const overview = ref<ProcessOverviewRecord | null>(null);
const traceRows = ref<WorkflowTraceRecord[]>([]);
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
const summaryTitle = computed(() => overview.value?.applicationName || contractDetail.value?.contractName || "");
const activeTaskId = computed(() => activeTask.value?.taskId || routeTaskId.value);
const taskStatus = computed(() => {
  return activeTask.value?.displayStatus || activeTask.value?.status || overview.value?.workflowStatus || "";
});
const currentNode = computed(() => activeTask.value?.currentNode || overview.value?.workflowNode || "");
const currentNodeOrder = computed(() => resolveNodeOrder(currentNode.value));
const canReview = computed(() => {
  if (!activeTaskId.value) {
    return false;
  }
  const normalized = normalizeStatus(taskStatus.value);
  return normalized === "PENDING" || normalized === "SUBMITTED";
});

const visibleAttachments = computed(() => {
  if (!overview.value?.attachments?.length) {
    return [] as ProcessOverviewAttachmentItem[];
  }
  if (currentNodeOrder.value <= 0) {
    return overview.value.attachments;
  }
  return overview.value.attachments.filter(
    (item) => resolveAttachmentOrder(item.stage) <= currentNodeOrder.value
  );
});

function taskTypeLabel(value: string) {
  if (value === "CONTRACT") return "合同审核";
  if (value === "PROJECT_REGISTER") return "项目登记审核";
  if (value === "QUALITY_REVIEW") return "质量审核";
  if (value === "REPORT_TECH_REVIEW") return "报告技术审核";
  if (value === "REPORT_CONTENT_REVIEW") return "报告内容审核";
  if (value === "REPORT_FINAL_REVIEW") return "报告最终审核";
  return value || "-";
}

function statusLabel(status?: string) {
  const normalized = normalizeStatus(status);
  if (!normalized) return "-";
  if (normalized === "DRAFT") return "草稿";
  if (normalized === "PENDING" || normalized === "SUBMITTED") return "待审核";
  if (normalized === "APPROVED") return "已通过";
  if (normalized === "REJECTED") return "需整改";
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
  if (!status) {
    return "";
  }
  return String(status).trim().toUpperCase();
}

function readErrorMessage(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof message === "string" && message.trim().length > 0 ? message : fallback;
}

function resolveNodeOrder(node: string) {
  const normalized = node.trim().toUpperCase();
  if (!normalized) return 0;
  if (normalized.includes("MATERIAL_ARCHIVE")) return 10;
  if (normalized.includes("MATERIAL")) return 10;
  if (normalized.includes("REPORT_FINAL_REVIEW")) return 9;
  if (normalized.includes("FINAL_REVIEW")) return 9;
  if (normalized.includes("REPORT_COMPILE_SUBMISSION")) return 8;
  if (normalized.includes("COMPILE_SUBMISSION")) return 8;
  if (normalized.includes("REPORT_COMPILE_ASSIGNMENT")) return 7;
  if (normalized.includes("COMPILE_ASSIGNMENT")) return 7;
  if (normalized.includes("REPORT_CONTENT_REVIEW")) return 6;
  if (normalized.includes("CONTENT_REVIEW")) return 6;
  if (normalized.includes("REPORT_TECH_REVIEW")) return 5;
  if (normalized.includes("TECH_REVIEW")) return 5;
  if (normalized.includes("QUALITY_REVIEW")) return 4;
  if (normalized.includes("ON_SITE_ASSESSMENT")) return 3;
  if (normalized.includes("ON_SITE")) return 3;
  if (normalized.includes("POLICE_REGISTER")) return 2;
  if (normalized.includes("POLICE")) return 2;
  if (normalized.includes("PROJECT_REGISTER")) return 1;
  if (normalized.includes("PROJECT")) return 1;
  return 0;
}

function resolveAttachmentOrder(stage: string) {
  const normalized = String(stage || "").trim().toUpperCase();
  if (!normalized) return 0;
  if (normalized.includes("材料归档".toUpperCase()) || normalized.includes("MATERIAL")) return 10;
  if (normalized.includes("报告编制")) return 8;
  if (normalized.includes("现场测评")) return 3;
  if (normalized.includes("项目登记")) return 1;
  return 0;
}

function hasDataAtSection(order: number) {
  if (!overview.value) {
    return false;
  }
  if (order === 1) return !!overview.value.projectRegister;
  if (order === 2) return !!overview.value.policeRegister;
  if (order === 3) return !!overview.value.onSiteAssessment;
  if (order === 4) return !!overview.value.qualityReview;
  if (order === 5) return !!overview.value.reportTechReview;
  if (order === 6) return !!overview.value.reportContentReview;
  if (order === 7) return !!overview.value.reportCompileAssignment;
  if (order === 8) return !!overview.value.reportCompileSubmission;
  if (order === 9) return !!overview.value.reportFinalReview;
  if (order === 10) return !!overview.value.materialArchive;
  return false;
}

function shouldShowSection(order: number) {
  if (!isProjectTask.value) {
    return false;
  }
  if (currentNodeOrder.value <= 0) {
    return hasDataAtSection(order);
  }
  return order <= currentNodeOrder.value;
}

function joinText(items?: string[]) {
  if (!items || items.length === 0) {
    return "-";
  }
  return items.join("、");
}

async function loadDetail() {
  if (!taskType.value || !bizId.value) {
    errorText.value = "任务参数无效";
    return;
  }

  loading.value = true;
  errorText.value = "";
  contractDetail.value = null;
  overview.value = null;
  traceRows.value = [];
  activeTask.value = null;

  try {
    const todoRows = await fetchTodoTasks({ type: taskType.value }).catch(() => []);
    const byRouteTask = routeTaskId.value
      ? todoRows.find((item) => item.taskId === routeTaskId.value)
      : null;
    activeTask.value = byRouteTask || todoRows.find((item) => item.bizId === bizId.value) || null;

    if (isContractTask.value) {
      contractDetail.value = await fetchContractReviewDetail(bizId.value);
      return;
    }

    if (!isProjectTask.value) {
      throw new Error(`unsupported task type: ${taskType.value}`);
    }

    const [overviewRecord, workflowTrace] = await Promise.all([
      fetchProcessOverview(bizId.value),
      fetchProjectRegisterTrace(bizId.value).catch(() => [])
    ]);
    overview.value = overviewRecord;
    traceRows.value = workflowTrace;
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
    await loadDetail();
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
.summary-card {
  border: 1px solid rgba(31, 152, 122, 0.2);
  background: linear-gradient(92deg, rgba(45, 184, 146, 0.08), rgba(47, 110, 162, 0.05));
}

.section-card {
  border: 1px solid rgba(205, 220, 230, 0.9);
  background: linear-gradient(180deg, #ffffff, #fbfcfc);
}

.section-card :deep(.el-card__header) {
  font-weight: 600;
}

.action-card {
  border: 1px solid rgba(201, 136, 34, 0.24);
  background: linear-gradient(94deg, rgba(255, 226, 153, 0.14), rgba(255, 255, 255, 0.92));
}

.action-buttons {
  margin-top: 12px;
  display: flex;
  gap: 12px;
}
</style>
