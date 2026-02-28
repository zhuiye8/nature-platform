<template>
  <div class="page-shell page section-stack">
    <header class="page-header">
      <div class="page-title-group">
        <h2 class="page-title">流程详情</h2>
        <p class="page-subtitle">按当前节点展示项目在全流程中的增量数据快照（只读）。</p>
      </div>
      <el-space>
        <el-button :loading="loading" @click="loadOverview">刷新</el-button>
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
      <template v-else-if="overview">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="项目ID">{{ overview.projectRegisterId }}</el-descriptions-item>
          <el-descriptions-item label="申请单名称">{{ overview.applicationName || "-" }}</el-descriptions-item>
          <el-descriptions-item label="项目状态">
            <el-tag :type="statusTagType(overview.projectStatus)">{{ statusLabel(overview.projectStatus) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="流程状态">
            <el-tag :type="statusTagType(overview.workflowStatus)">{{ statusLabel(overview.workflowStatus) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="当前流程节点">{{ overview.workflowNode || "-" }}</el-descriptions-item>
        </el-descriptions>
      </template>
    </el-card>

    <el-card v-if="overview" class="section-card" header="项目登记">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="合同名称">
          {{ overview.projectRegister?.contractName || "-" }}
        </el-descriptions-item>
        <el-descriptions-item label="合同年份">
          {{ overview.projectRegister?.contractYear || "-" }}
        </el-descriptions-item>
        <el-descriptions-item label="创建人">
          {{ overview.projectRegister?.createdBy || "-" }}
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">
          {{ overview.projectRegister?.createdAt || "-" }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card v-if="overview" class="section-card" header="公安登记">
      <template v-if="overview.policeRegister">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTagType(overview.policeRegister.status)">
              {{ statusLabel(overview.policeRegister.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="登记编号">
            {{ overview.policeRegister.registerNo || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="备案机关">
            {{ overview.policeRegister.filingAgency || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="联系人">
            {{ overview.policeRegister.contactName || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="联系电话">
            {{ overview.policeRegister.contactPhone || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="备注">
            {{ overview.policeRegister.remark || "-" }}
          </el-descriptions-item>
        </el-descriptions>
      </template>
      <el-empty v-else description="尚未进入该节点" :image-size="80" />
    </el-card>

    <el-card v-if="overview" class="section-card" header="现场测评">
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
          <el-descriptions-item label="技术审核人">
            {{ overview.onSiteAssessment.techReviewer || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="内容审核-技术">
            {{ overview.onSiteAssessment.contentReviewerTech || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="内容审核-管理">
            {{ overview.onSiteAssessment.contentReviewerManagement || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="内容审核-网络">
            {{ overview.onSiteAssessment.contentReviewerNetwork || "-" }}
          </el-descriptions-item>
        </el-descriptions>
      </template>
      <el-empty v-else description="尚未进入该节点" :image-size="80" />
    </el-card>

    <el-card v-if="overview" class="section-card" header="质量审核">
      <template v-if="overview.qualityReview">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTagType(overview.qualityReview.status)">
              {{ statusLabel(overview.qualityReview.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="提交人">
            {{ overview.qualityReview.appliedBy || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="提交时间">
            {{ overview.qualityReview.submittedAt || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="完成时间">
            {{ overview.qualityReview.finishedAt || "-" }}
          </el-descriptions-item>
        </el-descriptions>
        <el-table
          :data="overview.qualityReview.tasks || []"
          style="margin-top: 12px"
          empty-text="暂无质量审核任务记录"
        >
          <el-table-column prop="reviewRole" label="审核角色" width="180" />
          <el-table-column prop="assignee" label="处理人" width="140" />
          <el-table-column prop="status" label="状态" width="120">
            <template #default="{ row }">
              <el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="processedBy" label="处理人" width="140" />
          <el-table-column prop="processedAt" label="处理时间" min-width="180" />
        </el-table>
      </template>
      <el-empty v-else description="尚未进入该节点" :image-size="80" />
    </el-card>

    <el-card v-if="overview" class="section-card" header="报告技术审核">
      <template v-if="overview.reportTechReview">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTagType(overview.reportTechReview.status)">
              {{ statusLabel(overview.reportTechReview.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="审核人">
            {{ overview.reportTechReview.reviewer || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="提交时间">
            {{ overview.reportTechReview.submittedAt || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="完成时间">
            {{ overview.reportTechReview.finishedAt || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="备注">
            {{ overview.reportTechReview.remark || "-" }}
          </el-descriptions-item>
        </el-descriptions>
      </template>
      <el-empty v-else description="尚未进入该节点" :image-size="80" />
    </el-card>

    <el-card v-if="overview" class="section-card" header="报告内容审核">
      <template v-if="overview.reportContentReview">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTagType(overview.reportContentReview.status)">
              {{ statusLabel(overview.reportContentReview.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="技术审核人">
            {{ overview.reportContentReview.reviewerTech || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="管理审核人">
            {{ overview.reportContentReview.reviewerManagement || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="网络审核人">
            {{ overview.reportContentReview.reviewerNetwork || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="提交时间">
            {{ overview.reportContentReview.submittedAt || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="完成时间">
            {{ overview.reportContentReview.finishedAt || "-" }}
          </el-descriptions-item>
        </el-descriptions>
        <el-table
          :data="overview.reportContentReview.tasks || []"
          style="margin-top: 12px"
          empty-text="暂无内容审核任务记录"
        >
          <el-table-column prop="reviewRole" label="审核角色" width="180" />
          <el-table-column prop="assignee" label="处理人" width="140" />
          <el-table-column prop="status" label="状态" width="120">
            <template #default="{ row }">
              <el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="processedBy" label="处理人" width="140" />
          <el-table-column prop="processedAt" label="处理时间" min-width="180" />
        </el-table>
      </template>
      <el-empty v-else description="尚未进入该节点" :image-size="80" />
    </el-card>

    <el-card v-if="overview" class="section-card" header="报告编制分配">
      <template v-if="overview.reportCompileAssignment">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTagType(overview.reportCompileAssignment.status)">
              {{ statusLabel(overview.reportCompileAssignment.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="编制人">
            {{ overview.reportCompileAssignment.assignee || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="版本">
            {{ overview.reportCompileAssignment.versionNo || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="提交时间">
            {{ overview.reportCompileAssignment.submittedAt || "-" }}
          </el-descriptions-item>
        </el-descriptions>
      </template>
      <el-empty v-else description="尚未进入该节点" :image-size="80" />
    </el-card>

    <el-card v-if="overview" class="section-card" header="报告编制上传">
      <template v-if="overview.reportCompileSubmission">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTagType(overview.reportCompileSubmission.status)">
              {{ statusLabel(overview.reportCompileSubmission.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="编制人">
            {{ overview.reportCompileSubmission.assignee || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="报告对象键">
            {{ overview.reportCompileSubmission.reportObjectKey || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="提交人">
            {{ overview.reportCompileSubmission.submittedBy || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="提交时间">
            {{ overview.reportCompileSubmission.submittedAt || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="备注">
            {{ overview.reportCompileSubmission.reportRemark || "-" }}
          </el-descriptions-item>
        </el-descriptions>
      </template>
      <el-empty v-else description="尚未进入该节点" :image-size="80" />
    </el-card>

    <el-card v-if="overview" class="section-card" header="报告最终审核">
      <template v-if="overview.reportFinalReview">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTagType(overview.reportFinalReview.status)">
              {{ statusLabel(overview.reportFinalReview.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="审核人">
            {{ overview.reportFinalReview.reviewer || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="提交时间">
            {{ overview.reportFinalReview.submittedAt || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="完成时间">
            {{ overview.reportFinalReview.finishedAt || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="备注">
            {{ overview.reportFinalReview.remark || "-" }}
          </el-descriptions-item>
        </el-descriptions>
      </template>
      <el-empty v-else description="尚未进入该节点" :image-size="80" />
    </el-card>

    <el-card v-if="overview" class="section-card" header="材料归档">
      <template v-if="overview.materialArchive">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTagType(overview.materialArchive.status)">
              {{ statusLabel(overview.materialArchive.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="提交人">
            {{ overview.materialArchive.submittedBy || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="提交时间">
            {{ overview.materialArchive.submittedAt || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="归档报告文件">
            {{ formatList(overview.materialArchive.reportFiles) }}
          </el-descriptions-item>
          <el-descriptions-item label="归档表单文件">
            {{ formatList(overview.materialArchive.formFiles) }}
          </el-descriptions-item>
          <el-descriptions-item label="备注">
            {{ overview.materialArchive.remark || "-" }}
          </el-descriptions-item>
        </el-descriptions>
      </template>
      <el-empty v-else description="尚未进入该节点" :image-size="80" />
    </el-card>

    <el-card v-if="overview" class="section-card" header="附件总览（对象键 + 文件名）">
      <el-table :data="overview.attachments || []" empty-text="暂无附件">
        <el-table-column prop="stage" label="阶段" width="160" />
        <el-table-column prop="field" label="字段" width="220" show-overflow-tooltip />
        <el-table-column prop="fileName" label="文件名" min-width="220" show-overflow-tooltip />
        <el-table-column prop="objectKey" label="对象键" min-width="360" show-overflow-tooltip />
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
/**
 * @input process-overview aggregate API, route projectId parameter, and router navigation context
 * @output Read-only current-state detail page covering node snapshots and attachment summary table
 * @position Frontend detail presentation layer for end-to-end workflow data trace at project granularity
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { computed, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { useRoute, useRouter } from "vue-router";
import {
  fetchProcessOverview,
  type ProcessOverviewRecord
} from "./process-overview-service";

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const overview = ref<ProcessOverviewRecord | null>(null);
const errorText = ref("");

const projectId = computed(() => {
  const raw = Number(route.params.projectId);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
});

function statusLabel(status?: string) {
  if (!status) return "-";
  if (status === "DRAFT") return "草稿";
  if (status === "PENDING") return "待处理";
  if (status === "SUBMITTED") return "已提交";
  if (status === "APPROVED") return "已通过";
  if (status === "REJECTED") return "已驳回";
  if (status === "CLOSED") return "已关闭";
  if (status === "ARCHIVED") return "已归档";
  return status;
}

function statusTagType(status?: string) {
  if (status === "APPROVED" || status === "ARCHIVED") return "success";
  if (status === "SUBMITTED" || status === "PENDING") return "warning";
  if (status === "REJECTED") return "danger";
  return "info";
}

function formatList(values?: string[]) {
  if (!values || values.length === 0) {
    return "-";
  }
  return values.join("；");
}

function readErrorMessage(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof message === "string" && message.trim() ? message : fallback;
}

async function loadOverview() {
  if (!projectId.value) {
    errorText.value = "项目ID无效";
    overview.value = null;
    return;
  }
  loading.value = true;
  errorText.value = "";
  try {
    overview.value = await fetchProcessOverview(projectId.value);
  } catch (error) {
    overview.value = null;
    errorText.value = readErrorMessage(error, "加载流程详情失败");
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
  void router.push("/workflow");
}

onMounted(() => {
  void loadOverview();
});
</script>

<style scoped>
.page {
  padding-top: 24px;
}

.summary-card {
  border: 1px solid rgba(34, 136, 189, 0.16);
  background: linear-gradient(96deg, rgba(31, 152, 122, 0.08), rgba(47, 110, 162, 0.06));
}

.section-card {
  border: 1px solid rgba(205, 220, 230, 0.9);
  background: linear-gradient(180deg, #ffffff, #fbfcfc);
}

.section-card :deep(.el-card__header) {
  font-weight: 600;
}
</style>
