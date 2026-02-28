<template>
  <div class="page-shell page section-stack">
    <header class="page-header">
      <div>
        <h2>公安登记</h2>
        <p>节点 7：基于已通过的项目登记，完成公安登记保存与提交</p>
      </div>
      <el-button v-permission="'police-register:view'" :loading="loading" @click="loadRows">刷新</el-button>
    </header>

    <el-card class="tip-card">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="建议先保存草稿再提交；提交后流程自动流转至现场测评节点。"
      />
    </el-card>

    <el-card class="table-card">
      <el-table :data="rows" v-loading="loading" empty-text="暂无可处理项">
        <el-table-column prop="projectRegisterId" label="项目ID" width="100" />
        <el-table-column prop="applicationName" label="申请单名称" min-width="260" show-overflow-tooltip />
        <el-table-column prop="status" label="公安登记状态" width="140">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="workflowNode" label="流程节点" width="180" />
        <el-table-column prop="updatedAt" label="更新时间" min-width="180" />
        <el-table-column label="操作" width="330" fixed="right">
          <template #default="{ row }">
            <el-space>
              <el-button v-permission="'police-register:save'" size="small" @click="openDialog(row)">编辑</el-button>
              <el-button
                v-permission="'police-register:submit'"
                size="small"
                type="success"
                :disabled="row.status === 'SUBMITTED'"
                @click="submitRow(row)"
              >
                提交并流转
              </el-button>
              <el-button size="small" @click="openProcessOverview(row.projectRegisterId)">流程详情</el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" title="公安登记信息" width="680px">
      <el-form label-width="120px">
        <el-form-item label="项目ID">
          <el-input :model-value="form.projectRegisterId" disabled />
        </el-form-item>
        <el-form-item label="登记编号">
          <el-input v-model="form.registerNo" placeholder="请输入登记编号" />
        </el-form-item>
        <el-form-item label="备案机关">
          <el-input v-model="form.filingAgency" placeholder="请输入备案机关" />
        </el-form-item>
        <el-form-item label="联系人">
          <el-input v-model="form.contactName" placeholder="请输入联系人" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="form.contactPhone" placeholder="请输入联系电话" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="3"
            maxlength="1000"
            show-word-limit
            placeholder="请输入备注" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button v-permission="'police-register:save'" type="primary" :loading="saving" @click="saveForm">
          保存草稿
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * @input Police-register APIs, permission directive bindings, and Element Plus dialog/form components
 * @output Node-7 police register board with permission-aware draft edit and submit transition actions
 * @position Police registration stage page bridging project approval and on-site assessment entry
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  fetchPoliceRegisterDetail,
  fetchPoliceRegisters,
  savePoliceRegister,
  submitPoliceRegister,
  type PoliceRegisterRecord
} from "./police-register-service";
import { toProcessOverviewPath } from "./process-overview-service";

interface FormState {
  projectRegisterId: number;
  registerNo: string;
  filingAgency: string;
  contactName: string;
  contactPhone: string;
  remark: string;
}

const router = useRouter();
const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const rows = ref<PoliceRegisterRecord[]>([]);

const form = reactive<FormState>({
  projectRegisterId: 0,
  registerNo: "",
  filingAgency: "",
  contactName: "",
  contactPhone: "",
  remark: ""
});

function statusLabel(status?: string) {
  if (status === "SUBMITTED") return "已提交";
  if (status === "DRAFT") return "草稿";
  return status || "草稿";
}

function statusTagType(status?: string) {
  if (status === "SUBMITTED") return "success";
  return "info";
}

function readErrorMessage(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof message === "string" && message.trim() ? message : fallback;
}

function fillForm(row: PoliceRegisterRecord) {
  form.projectRegisterId = row.projectRegisterId;
  form.registerNo = row.registerNo || "";
  form.filingAgency = row.filingAgency || "";
  form.contactName = row.contactName || "";
  form.contactPhone = row.contactPhone || "";
  form.remark = row.remark || "";
}

async function loadRows() {
  loading.value = true;
  try {
    rows.value = await fetchPoliceRegisters();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "加载公安登记列表失败"));
  } finally {
    loading.value = false;
  }
}

async function openDialog(row: PoliceRegisterRecord) {
  try {
    const detail = await fetchPoliceRegisterDetail(row.projectRegisterId);
    fillForm(detail);
  } catch {
    fillForm(row);
  }
  dialogVisible.value = true;
}

async function saveForm() {
  if (!form.projectRegisterId) {
    return;
  }
  saving.value = true;
  try {
    await savePoliceRegister(form.projectRegisterId, {
      registerNo: form.registerNo.trim(),
      filingAgency: form.filingAgency.trim(),
      contactName: form.contactName.trim(),
      contactPhone: form.contactPhone.trim(),
      remark: form.remark.trim()
    });
    ElMessage.success("公安登记已保存");
    dialogVisible.value = false;
    await loadRows();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "保存公安登记失败"));
  } finally {
    saving.value = false;
  }
}

async function submitRow(row: PoliceRegisterRecord) {
  try {
    await ElMessageBox.confirm(
      `确认提交项目 ${row.projectRegisterId} 的公安登记，并流转到现场测评吗？`,
      "提交确认",
      {
        type: "warning",
        confirmButtonText: "确认",
        cancelButtonText: "取消"
      }
    );
  } catch {
    return;
  }

  try {
    await submitPoliceRegister(row.projectRegisterId);
    ElMessage.success("公安登记已提交，已流转至现场测评");
    await loadRows();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "提交公安登记失败"));
  }
}

function openProcessOverview(projectId: number) {
  void router.push(toProcessOverviewPath(projectId));
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

