<template>
  <div class="page-shell page section-stack">
    <header class="page-header">
      <div>
        <h2>公安登记</h2>
        <p>节点 7：在项目登记通过后，补录公安登记信息并指定项目经理。</p>
      </div>
      <el-button v-permission="'police-register:view'" :loading="loading" @click="loadRows">刷新</el-button>
    </header>

    <el-card class="tip-card">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="建议先保存草稿再提交；提交时必须选择项目经理，流程会自动流转到现场测评。"
      />
    </el-card>

    <el-card class="table-card">
      <el-table :data="rows" v-loading="loading" empty-text="暂无可处理项目">
        <el-table-column prop="projectRegisterId" label="项目ID" width="100" />
        <el-table-column prop="applicationName" label="申请单名称" min-width="260" show-overflow-tooltip />
        <el-table-column label="项目经理" min-width="180">
          <template #default="{ row }">
            {{ row.projectManagerDisplayName || row.projectManagerUsername || "-" }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="登记状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="workflowNode" label="流程节点" width="180" />
        <el-table-column prop="updatedAt" label="更新时间" min-width="180" />
        <el-table-column label="操作" width="320" fixed="right">
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
                提交
              </el-button>
              <el-button size="small" @click="openTaskDetail(row.projectRegisterId)">详情</el-button>
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
        <el-form-item label="项目经理" required>
          <el-select
            v-model="form.projectManagerUsername"
            filterable
            clearable
            placeholder="请选择项目经理"
            style="width: 100%"
          >
            <el-option
              v-for="username in projectManagers"
              :key="`pm-${username}`"
              :label="username"
              :value="username"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="3"
            maxlength="1000"
            show-word-limit
            placeholder="请输入备注"
          />
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
 * @output Node-7 police register board with project-manager selection, draft save, and submit transition actions
 * @position Police registration stage page bridging project approval and on-site assessment entry
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  fetchPoliceRegisterDetail,
  fetchPoliceRegisterProjectManagers,
  fetchPoliceRegisters,
  savePoliceRegister,
  submitPoliceRegister,
  type PoliceRegisterRecord
} from "./police-register-service";
import { toTaskDetailPath } from "./task-detail-service";

interface FormState {
  projectRegisterId: number;
  registerNo: string;
  filingAgency: string;
  contactName: string;
  contactPhone: string;
  projectManagerUsername: string;
  remark: string;
}

const router = useRouter();
const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const rows = ref<PoliceRegisterRecord[]>([]);
const projectManagers = ref<string[]>([]);

const form = reactive<FormState>({
  projectRegisterId: 0,
  registerNo: "",
  filingAgency: "",
  contactName: "",
  contactPhone: "",
  projectManagerUsername: "",
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
  form.projectManagerUsername = row.projectManagerUsername || "";
  form.remark = row.remark || "";
}

async function loadRows() {
  loading.value = true;
  try {
    const [registerRows, managerRows] = await Promise.all([
      fetchPoliceRegisters(),
      fetchPoliceRegisterProjectManagers()
    ]);
    rows.value = registerRows;
    projectManagers.value = managerRows;
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
      projectManagerUsername: form.projectManagerUsername.trim(),
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
      `确认提交项目 ${row.projectRegisterId} 的公安登记吗？`,
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

function openTaskDetail(projectId: number) {
  void router.push(toTaskDetailPath("PROJECT_REGISTER", projectId));
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
