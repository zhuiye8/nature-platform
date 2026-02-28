<template>
  <div class="page-shell page section-stack">
    <header class="page-header">
      <div>
        <h2>质量审核看板</h2>
        <p>本页仅展示质量阶段状态，审核人分配入口在“现场测评”。</p>
      </div>
      <el-space>
        <el-button :loading="loading" @click="loadRows">刷新</el-button>
        <el-button type="primary" @click="goOnSite">前往现场测评</el-button>
        <el-button v-permission="'workflow-task:view'" @click="goWorkflow">打开待办审批</el-button>
      </el-space>
    </header>

    <el-card class="tip-card np-info-strip">
      <el-alert
        type="info"
        show-icon
        :closable="false"
        title="流程规则：上传现场测评 ZIP 后，在现场测评页完成“报告技术 + 内容技术/管理/网络”分配，再提交进入报告技术审核。"
      />
    </el-card>

    <el-card class="table-card">
      <el-table :data="rows" v-loading="loading" empty-text="暂无可展示项">
        <el-table-column prop="projectRegisterId" label="项目ID" width="100" />
        <el-table-column prop="applicationName" label="申请单名称" min-width="260" show-overflow-tooltip />
        <el-table-column prop="onSitePackageObjectKey" label="现场测评压缩包" min-width="280" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.onSitePackageObjectKey || "-" }}
          </template>
        </el-table-column>
        <el-table-column label="审核人分配" min-width="320" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="assignment-line">报告技术：{{ row.techReviewer || "-" }}</div>
            <div class="assignment-line">
              内容技术/管理/网络：
              {{ `${row.contentReviewerTech || "-"}/${row.contentReviewerManagement || "-"}/${row.contentReviewerNetwork || "-"}` }}
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="质量阶段状态" width="140">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="workflowNode" label="流程节点" width="200" show-overflow-tooltip />
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-space>
              <el-button size="small" @click="openDetail(row.projectRegisterId)">详情</el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
/**
 * @input Quality review APIs and router navigation for stage-board visibility and unified detail-page jump
 * @output Node-10 board UI showing quality stage status, reviewer assignment summary, and detail-page entry
 * @position Quality review presentation layer with read-focused board and permission-aware workflow navigation actions
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { useRouter } from "vue-router";
import {
  fetchQualityReviews,
  type QualityReviewRecord
} from "./quality-review-service";
import { toTaskDetailPath } from "./task-detail-service";

const router = useRouter();
const loading = ref(false);
const rows = ref<QualityReviewRecord[]>([]);

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

function goOnSite() {
  void router.push("/on-site-assessments");
}

function goWorkflow() {
  void router.push("/workflow");
}

function openDetail(projectId: number) {
  void router.push(toTaskDetailPath("QUALITY_REVIEW", projectId));
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

.assignment-line {
  line-height: 1.5;
  color: var(--np-color-text-secondary);
}

</style>
