<template>
  <div class="page-shell page section-stack">
    <header class="page-header">
      <div>
        <h2>报告最终审核</h2>
        <p>节点 15：设置最终审核人后自动进入待办任务，审核动作可在待办审批或详情页处理</p>
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
        title="最终审核人配置保存后将自动同步待办任务，本页不再提供手工提交入口。"
      />
    </el-card>

    <el-card class="table-card">
      <el-table :data="rows" v-loading="loading" empty-text="暂无可处理项">
        <el-table-column prop="projectRegisterId" label="项目ID" width="90" />
        <el-table-column prop="applicationName" label="申请单名称" min-width="240" show-overflow-tooltip />
        <el-table-column prop="onSitePackageObjectKey" label="现场测评压缩" min-width="260" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.onSitePackageObjectKey || "-" }}
          </template>
        </el-table-column>
        <el-table-column prop="reviewer" label="最终审核人" width="140" />
        <el-table-column label="任务状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusTagType(resolveStatus(row))">{{ statusLabel(resolveStatus(row)) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="versionNo" label="版本" width="80" />
        <el-table-column prop="workflowNode" label="流程节点" width="180" show-overflow-tooltip />
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-space>
              <el-button v-permission="'report-final-review:save'" size="small" @click="openDialog(row)">
                编辑
              </el-button>
              <el-button size="small" @click="openDetail(row)">详情</el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" title="最终审核配置" width="620px">
      <el-form label-width="120px">
        <el-form-item label="项目ID">
          <el-input :model-value="form.projectRegisterId" disabled />
        </el-form-item>
        <el-form-item label="最终审核人" required>
          <el-select v-model="form.reviewer" style="width: 100%" filterable>
            <el-option v-for="user in candidates" :key="user" :label="user" :value="user" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="3"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button
          v-permission="'report-final-review:save'"
          type="primary"
          :loading="saving"
          @click="saveForm"
        >
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * @input Report final review APIs, permission helper, and conditional candidate user-pool query for assignment operations
 * @output Node-15 final review management UI supporting permission-gated reviewer assignment save and unified detail-page jump
 * @position Report final review page orchestrating last-stage reviewer config with auto task-sync and task-detail route entry
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { useRouter } from "vue-router";
import { hasPermission } from "./permission";
import {
  fetchReportFinalReviewCandidates,
  fetchReportFinalReviews,
  saveReportFinalReview,
  type ReportFinalReviewRecord
} from "./report-final-review-service";
import { toTaskDetailPath } from "./task-detail-service";

interface FormState {
  projectRegisterId: number;
  reviewer: string;
  remark: string;
  versionNo: number;
}

const router = useRouter();
const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const rows = ref<ReportFinalReviewRecord[]>([]);
const candidates = ref<string[]>([]);
const canLoadCandidates = computed(() => hasPermission("report-final-review:candidate:view"));

const form = reactive<FormState>({
  projectRegisterId: 0,
  reviewer: "",
  remark: "",
  versionNo: 0
});

function statusLabel(status?: string) {
  if (status === "DRAFT") return "草稿";
  if (status === "SUBMITTED" || status === "PENDING") return "待审核";
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

function resolveStatus(row: ReportFinalReviewRecord) {
  if (row.displayStatus) {
    return row.displayStatus;
  }
  if (row.taskStatus) {
    return row.taskStatus;
  }
  return row.status;
}

function readErrorMessage(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof message === "string" && message.trim().length > 0 ? message : fallback;
}

async function loadRows() {
  loading.value = true;
  try {
    const [list, users] = await Promise.all([
      fetchReportFinalReviews(),
      canLoadCandidates.value ? fetchReportFinalReviewCandidates() : Promise.resolve([])
    ]);
    rows.value = list;
    candidates.value = users;
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "加载最终审核列表失败"));
  } finally {
    loading.value = false;
  }
}

function openDialog(row: ReportFinalReviewRecord) {
  form.projectRegisterId = row.projectRegisterId;
  form.reviewer = row.reviewer || "";
  form.remark = row.remark || "";
  form.versionNo = row.versionNo || 0;
  dialogVisible.value = true;
}

async function saveForm() {
  if (!form.projectRegisterId || !form.reviewer) {
    ElMessage.warning("请先选择最终审核人");
    return;
  }
  saving.value = true;
  try {
    await saveReportFinalReview(form.projectRegisterId, {
      reviewer: form.reviewer,
      remark: form.remark.trim(),
      versionNo: form.versionNo
    });
    ElMessage.success("最终审核配置已保存，并已同步待办任务");
    dialogVisible.value = false;
    await loadRows();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "保存最终审核配置失败"));
  } finally {
    saving.value = false;
  }
}

function goWorkflow() {
  void router.push("/workflow");
}

function openDetail(row: ReportFinalReviewRecord) {
  const taskKey = row.taskId ? `REPORT_FINAL_REVIEW:${row.taskId}` : undefined;
  void router.push(toTaskDetailPath("REPORT_FINAL_REVIEW", row.projectRegisterId, taskKey));
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

