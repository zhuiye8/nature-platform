<template>
  <div class="page-shell page section-stack">
    <header class="page-header">
      <div>
        <h2>报告内容审核（A/B/C）</h2>
        <p>节点 12：沿用现场测评阶段已分配的 A/B/C 审核人，提交后进入并行待办审核</p>
      </div>
      <el-space>
        <el-button :loading="loading" @click="loadRows">刷新</el-button>
        <el-button type="primary" @click="goWorkflow">打开待办审批</el-button>
      </el-space>
    </header>

    <el-card>
      <el-table :data="rows" v-loading="loading" empty-text="暂无可处理项">
        <el-table-column prop="projectRegisterId" label="项目ID" width="90" />
        <el-table-column prop="applicationName" label="申请单名称" min-width="250" show-overflow-tooltip />
        <el-table-column prop="onSitePackageObjectKey" label="现场测评压缩" min-width="280" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.onSitePackageObjectKey || "-" }}
          </template>
        </el-table-column>
        <el-table-column label="审核人(A/B/C)" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            {{ `${row.reviewerA || "-"}/${row.reviewerB || "-"}/${row.reviewerC || "-"}` }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="workflowNode" label="流程节点" width="200" show-overflow-tooltip />
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-space>
              <el-button size="small" @click="openTaskDrawer(row)">任务明细</el-button>
              <el-button
                size="small"
                type="success"
                :disabled="row.status === 'SUBMITTED'"
                @click="submitRow(row)"
              >
                提交审核
              </el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-drawer v-model="taskDrawerVisible" title="内容审核任务明细" size="560px">
      <el-descriptions v-if="taskPreview" :column="1" border>
        <el-descriptions-item label="项目ID">{{ taskPreview.projectRegisterId }}</el-descriptions-item>
        <el-descriptions-item label="申请">{{ taskPreview.applicationName }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ statusLabel(taskPreview.status) }}</el-descriptions-item>
        <el-descriptions-item label="提交">{{ taskPreview.appliedBy || "-" }}</el-descriptions-item>
        <el-descriptions-item label="提交时间">{{ taskPreview.submittedAt || "-" }}</el-descriptions-item>
      </el-descriptions>
      <el-table :data="taskPreview?.tasks || []" style="margin-top: 12px" empty-text="暂无任务">
        <el-table-column prop="reviewRole" label="审核角色" width="130" />
        <el-table-column prop="assignee" label="处理" width="120" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="processedBy" label="处理" width="120" />
        <el-table-column prop="processedAt" label="处理时间" min-width="170" />
      </el-table>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
/**
 * @input Report content review APIs and router navigation for node-12 submit and task-detail retrieval
 * @output Node-12 content review board with A/B/C reviewer visibility, task detail drawer, and submit action
 * @position Report content review page handling pre-assigned parallel reviewers before workflow approval
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useRouter } from "vue-router";
import {
  fetchReportContentReviewDetail,
  fetchReportContentReviews,
  submitReportContentReview,
  type ReportContentReviewRecord
} from "./report-content-review-service";

const router = useRouter();
const loading = ref(false);
const rows = ref<ReportContentReviewRecord[]>([]);
const taskDrawerVisible = ref(false);
const taskPreview = ref<ReportContentReviewRecord | null>(null);

function statusLabel(status?: string) {
  if (status === "DRAFT") return "草稿";
  if (status === "PENDING") return "待处理";
  if (status === "SUBMITTED") return "已提交";
  if (status === "APPROVED") return "已通过";
  if (status === "REJECTED") return "已驳回";
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

async function submitRow(row: ReportContentReviewRecord) {
  try {
    await ElMessageBox.confirm(`确认提交项目 ${row.projectRegisterId} 的内容审核吗？`, "提交确认", {
      type: "warning",
      confirmButtonText: "确认",
      cancelButtonText: "取消"
    });
  } catch {
    return;
  }

  try {
    await submitReportContentReview(row.projectRegisterId);
    ElMessage.success("内容审核已提交");
    await loadRows();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "提交内容审核失败"));
  }
}

async function openTaskDrawer(row: ReportContentReviewRecord) {
  try {
    taskPreview.value = await fetchReportContentReviewDetail(row.projectRegisterId);
    taskDrawerVisible.value = true;
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "加载任务明细失败"));
  }
}

function goWorkflow() {
  void router.push("/workflow");
}

onMounted(() => {
  void loadRows();
});
</script>

<style scoped>
.page {
  max-width: 1320px;
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
</style>
