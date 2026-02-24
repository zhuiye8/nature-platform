<template>
  <div class="page-shell page section-stack">
    <header class="page-header">
      <div>
        <h2>客户管理</h2>
        <p>维护客户基础信息，供合同与项目登记择</p>
      </div>
      <el-space>
        <el-button @click="loadCustomers" :loading="loading">刷新</el-button>
        <el-button type="primary" @click="openCreate">新建客户</el-button>
      </el-space>
    </header>

    <el-card>
      <el-table :data="customers" v-loading="loading" empty-text="暂无客户数据">
        <el-table-column prop="id" label="ID" width="90" />
        <el-table-column prop="fullName" label="客户全称" min-width="220" />
        <el-table-column prop="contactName" label="联系" width="140" />
        <el-table-column prop="mobilePhone" label="联系电话" width="160" />
        <el-table-column prop="region" label="区域" width="150" />
        <el-table-column prop="createdBy" label="创建" width="120" />
        <el-table-column prop="createdAt" label="创建时间" min-width="170" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-space>
              <el-button size="small" @click="openEdit(row)">编辑</el-button>
              <el-button size="small" type="danger" @click="removeCustomer(row.id)">删除</el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑客户' : '新建客户'" width="680px">
      <el-form label-width="98px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="客户全称" required>
              <el-input v-model="form.fullName" placeholder="请输入客户全称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="统一信用">
              <el-input v-model="form.uscc" placeholder="请输入" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="联系">
              <el-input v-model="form.contactName" placeholder="请输入" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系电话">
              <el-input v-model="form.mobilePhone" placeholder="请输入" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="行业">
              <el-input v-model="form.industry" placeholder="请输入" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="区域">
              <el-input v-model="form.region" placeholder="请输入" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="地址">
          <el-input v-model="form.addressDetail" placeholder="请输入" />
        </el-form-item>

        <el-form-item label="备注">
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="3"
            maxlength="300"
            show-word-limit
            placeholder="请输入" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="saveCustomer">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * @input Customer CRUD service APIs and Element Plus table/dialog widgets
 * @output Customer management UI for list, create, edit, and delete operations
 * @position Customer domain page providing foundational records for downstream contract workflows
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  createCustomer,
  deleteCustomer,
  fetchCustomers,
  updateCustomer,
  type CustomerPayload,
  type CustomerRecord
} from "./customer-service";

const loading = ref(false);
const submitting = ref(false);
const dialogVisible = ref(false);
const editingId = ref<number | null>(null);
const customers = ref<CustomerRecord[]>([]);

const form = reactive<CustomerPayload>({
  fullName: "",
  industry: "",
  region: "",
  addressDetail: "",
  uscc: "",
  contactName: "",
  mobilePhone: "",
  remark: ""
});

function readErrorMessage(error: unknown, fallback: string) {
  const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof msg === "string" && msg.trim() ? msg : fallback;
}

async function loadCustomers() {
  loading.value = true;
  try {
    customers.value = await fetchCustomers();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "加载客户列表失败"));
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  form.fullName = "";
  form.industry = "";
  form.region = "";
  form.addressDetail = "";
  form.uscc = "";
  form.contactName = "";
  form.mobilePhone = "";
  form.remark = "";
}

function openCreate() {
  editingId.value = null;
  resetForm();
  dialogVisible.value = true;
}

function openEdit(row: CustomerRecord) {
  editingId.value = row.id;
  form.fullName = row.fullName || "";
  form.industry = row.industry || "";
  form.region = row.region || "";
  form.addressDetail = row.addressDetail || "";
  form.uscc = row.uscc || "";
  form.contactName = row.contactName || "";
  form.mobilePhone = row.mobilePhone || "";
  form.remark = row.remark || "";
  dialogVisible.value = true;
}

async function saveCustomer() {
  if (!form.fullName.trim()) {
    ElMessage.warning("客户全称不能为空");
    return;
  }

  submitting.value = true;
  try {
    if (editingId.value) {
      await updateCustomer(editingId.value, form);
      ElMessage.success("客户更新成功");
    } else {
      await createCustomer(form);
      ElMessage.success("客户创建成功");
    }
    dialogVisible.value = false;
    await loadCustomers();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "保存客户失败"));
  } finally {
    submitting.value = false;
  }
}

async function removeCustomer(id: number) {
  try {
    await ElMessageBox.confirm("确认删除该客户吗？删除后不可恢复", "删除确认", {
      type: "warning",
      confirmButtonText: "确认",
      cancelButtonText: "取消"
    });
  } catch {
    return;
  }

  try {
    await deleteCustomer(id);
    ElMessage.success("客户已删除");
    await loadCustomers();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "删除客户失败"));
  }
}

onMounted(() => {
  void loadCustomers();
});
</script>

<style scoped>
.page {
  max-width: 1200px;
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
