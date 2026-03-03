<template>
  <div class="page-shell page section-stack">
    <header class="page-header">
      <div>
        <h2>报告内容审核（技术/管理/网络）</h2>
        <p>节点 12：审核人由流程管理中的节点规则自动安插，任务进入节点后自动创建并行待办。</p>
      </div>
      <el-space>
        <el-button :loading="loading" @click="loadRows">刷新</el-button>
        <el-button v-permission="'workflow-task:view'" type="primary" @click="goWorkflow">打开待办审批</el-button>
      </el-space>
    </header>

    <el-card class="tip-card">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="内容审核分为技术/管理/网络三条并行任务；若缺少槽位配置，请到流程管理-节点规则补齐。"
      />
    </el-card>

    <el-card class="table-card">
      <el-table :data="rows" v-loading="loading" empty-text="暂无可处理项">
        <el-table-column prop="projectRegisterId" label="项目ID" width="90" />
        <el-table-column prop="applicationName" label="申请单名称" min-width="250" show-overflow-tooltip />
        <el-table-column prop="onSitePackageObjectKey" label="现场测评压缩包" min-width="280" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.onSitePackageObjectKey || "-" }}
          </template>
        </el-table-column>
        <el-table-column label="审核人（技术/管理/网络）" min-width="300" show-overflow-tooltip>
          <template #default="{ row }">
            {{ `${row.reviewerTech || "-"}/${row.reviewerManagement || "-"}/${row.reviewerNetwork || "-"}` }}
          </template>
        </el-table-column>
        <el-table-column label="任务状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusTagType(resolveRowStatus(row))">{{ statusLabel(resolveRowStatus(row)) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="workflowNode" label="流程节点" width="200" show-overflow-tooltip />
        <el-table-column label="操作" width="250" fixed="right">
          <template #default="{ row }">
            <el-space>
              <el-button size="small" @click="openEntityDetail(row.projectRegisterId)">业务详情</el-button>
              <el-button size="small" @click="openDetail(row.projectRegisterId)">审核详情</el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
/**
 * @input Report content review list APIs and router navigation for node-12 detail-page retrieval
 * @output Node-12 content review board showing node-rule-assigned technical/management/network reviewers and unified detail-page entry
 * @position Report content review page handling auto-created parallel tasks with workflow-rule-driven assignee display
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { useRouter } from "vue-router";
import {
  fetchReportContentReviews,
  type ReportContentReviewRecord
} from "./report-content-review-service";
import { toTaskDetailPath } from "./task-detail-service";

const router = useRouter();
const loading = ref(false);
const rows = ref<ReportContentReviewRecord[]>([]);

function statusLabel(status?: string) {
  if (status === "DRAFT") return "草稿";
  if (status === "PENDING" || status === "SUBMITTED") return "待审核";
  if (status === "APPROVED") return "已通过";
  if (status === "REJECTED") return "需整改";
  if (status === "CLOSED") return "已关闭";
  return status || "-";
}

function statusTagType(status?: string) {
  if (status === "APPROVED") return "success";
  if (status === "SUBMITTED" || status === "PENDING") return "warning";
  if (status === "REJECTED") return "danger";
  return "info";
}

function readErrorMessage(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof message === "string" && message.trim().length > 0 ? message : fallback;
}

function resolveRowStatus(row: ReportContentReviewRecord) {
  if (row.displayStatus) {
    return row.displayStatus;
  }
  if (row.tasks.length > 0) {
    if (row.tasks.some(task => task.status === "REJECTED")) {
      return "REJECTED";
    }
    if (row.tasks.some(task => task.status === "PENDING")) {
      return "PENDING";
    }
    if (row.tasks.every(task => task.status === "APPROVED")) {
      return "APPROVED";
    }
  }
  if (row.workflowNode === "REPORT_CONTENT_REVIEW_TASK" && row.workflowStatus === "PENDING") {
    return "PENDING";
  }
  return row.status;
}

async function loadRows() {
  loading.value = true;
  try {
    rows.value = await fetchReportContentReviews();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "加载内容审核列表失败"));
  } finally {
    loading.value = false;
  }
}

function goWorkflow() {
  void router.push("/workflow");
}

function openDetail(projectId: number) {
  void router.push(toTaskDetailPath("REPORT_CONTENT_REVIEW", projectId));
}

function openEntityDetail(projectId: number) {
  void router.push(`/entity-detail/report/${projectId}`);
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

</style>
