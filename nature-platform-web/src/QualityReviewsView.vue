<template>
  <div class="page-shell page section-stack">
    <header class="page-header">
      <div>
        <h2>质量审核看板</h2>
        <p>本页仅展示质量阶段状态，审核人分配入口已迁移到“现场测评”。</p>
      </div>
      <el-space>
        <el-button :loading="loading" @click="loadRows">刷新</el-button>
        <el-button type="primary" @click="goOnSite">前往现场测评</el-button>
        <el-button @click="goWorkflow">打开待办审批</el-button>
      </el-space>
    </header>

    <el-card class="tip-card">
      <el-alert
        type="info"
        show-icon
        :closable="false"
        title="流程规则：上传现场测评ZIP后，在现场测评页完成TECH/内容A-B-C审核人分配，再提交进入报告技术审核" />
    </el-card>

    <el-card>
      <el-table :data="rows" v-loading="loading" empty-text="暂无可展示项">
        <el-table-column prop="projectRegisterId" label="项目ID" width="100" />
        <el-table-column prop="applicationName" label="申请单名称" min-width="260" show-overflow-tooltip />
        <el-table-column prop="onSitePackageObjectKey" label="现场测评压缩" min-width="280" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.onSitePackageObjectKey || "-" }}
          </template>
        </el-table-column>
        <el-table-column label="审核人分配" min-width="250" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="assignment-line">技术：{{ row.techReviewer || "-" }}</div>
            <div class="assignment-line">
              内容A/B/C：{{ `${row.contentReviewerA || "-"}/${row.contentReviewerB || "-"}/${row.contentReviewerC || "-"}` }}
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="质量阶段状态" width="140">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="workflowNode" label="流程节点" width="200" show-overflow-tooltip />
        <el-table-column label="任务明细" width="130" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openTaskDrawer(row)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-drawer v-model="taskDrawerVisible" title="质量阶段任务明细" size="560px">
      <el-descriptions v-if="taskPreview" :column="1" border>
        <el-descriptions-item label="项目ID">{{ taskPreview.projectRegisterId }}</el-descriptions-item>
        <el-descriptions-item label="申请">{{ taskPreview.applicationName }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ statusLabel(taskPreview.status) }}</el-descriptions-item>
        <el-descriptions-item label="提交">{{ taskPreview.appliedBy || "-" }}</el-descriptions-item>
        <el-descriptions-item label="提交时间">{{ taskPreview.submittedAt || "-" }}</el-descriptions-item>
      </el-descriptions>
      <el-table :data="taskPreview?.tasks || []" style="margin-top: 12px" empty-text="暂无任务记录">
        <el-table-column prop="reviewRole" label="审核角色" width="130" />
        <el-table-column prop="assignee" label="处理" width="120" />
        <el-table-column prop="status" label="状态" width="110">
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
 * @input Quality review APIs and router navigation for stage-board visibility and detail drill-down
 * @output Node-10 board UI showing quality stage status and task details sourced from workflow-compatible APIs
 * @position Quality review presentation layer with read-focused board and workflow jump actions
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { useRouter } from "vue-router";
import {
  fetchQualityReviewDetail,
  fetchQualityReviews,
  type QualityReviewRecord
} from "./quality-review-service";

const router = useRouter();
const loading = ref(false);
const rows = ref<QualityReviewRecord[]>([]);
const taskDrawerVisible = ref(false);
const taskPreview = ref<QualityReviewRecord | null>(null);

function statusLabel(status?: string) {
  if (status === "SUBMITTED") return "已提交";
  if (status === "APPROVED") return "已通过";
  if (status === "REJECTED") return "已驳回";
  if (status === "PENDING") return "待处理";
  if (status === "DRAFT") return "草稿";
  if (status === "CLOSED") return "已关闭";
  return status || "-";
}

function statusTagType(status?: string) {
  if (status === "APPROVED" || status === "SUBMITTED") return "success";
  if (status === "REJECTED") return "danger";
  if (status === "PENDING") return "warning";
  return "info";
}

function readErrorMessage(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof message === "string" && message.trim().length > 0 ? message : fallback;
}

async function loadRows() {
  loading.value = true;
  try {
    rows.value = await fetchQualityReviews();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "加载质量看板失败"));
  } finally {
    loading.value = false;
  }
}

async function openTaskDrawer(row: QualityReviewRecord) {
  try {
    taskPreview.value = await fetchQualityReviewDetail(row.projectRegisterId);
    taskDrawerVisible.value = true;
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "加载任务明细失败"));
  }
}

function goOnSite() {
  void router.push("/on-site-assessments");
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

.assignment-line {
  line-height: 1.5;
}
</style>
