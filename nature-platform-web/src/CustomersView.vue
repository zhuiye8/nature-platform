<template>
  <div class="page-shell page section-stack">
    <header class="page-header">
      <div>
        <h2>客户管理</h2>
        <p>维护客户基础信息，为合同提审与项目登记提供标准客户资料。</p>
      </div>
      <el-space>
        <el-button v-permission="'customer:view'" @click="loadCustomers" :loading="loading">刷新</el-button>
        <el-button v-permission="'customer:create'" type="primary" @click="openCreate">新建客户</el-button>
      </el-space>
    </header>

    <el-card class="tip-card">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="除备注外均为必填项。客户地区采用省/市/区三级联动，详细地址请填写到门牌号。"
      />
    </el-card>

    <el-card class="table-card">
      <el-table :data="customers" v-loading="loading" empty-text="暂无客户数据">
        <el-table-column prop="id" label="ID" width="90" />
        <el-table-column prop="fullName" label="客户全称" min-width="220" />
        <el-table-column prop="contactName" label="联系人" width="140" />
        <el-table-column prop="mobilePhone" label="联系电话" width="160" />
        <el-table-column prop="region" label="客户地区" min-width="220" show-overflow-tooltip />
        <el-table-column prop="createdBy" label="创建人" width="120" />
        <el-table-column prop="createdAt" label="创建时间" min-width="170" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-space>
              <el-button size="small" @click="openEntityDetail(row.id)">详情</el-button>
              <el-button v-permission="'customer:update'" size="small" @click="openEdit(row)">编辑</el-button>
              <el-button v-permission="'customer:delete'" size="small" type="danger" @click="removeCustomer(row.id)">
                删除
              </el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑客户' : '新建客户'" width="720px">
      <el-form label-width="110px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="客户全称" required>
              <el-input v-model="form.fullName" placeholder="请输入客户全称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="统一社会信用代码" required>
              <el-input v-model="form.uscc" placeholder="请输入统一社会信用代码" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="联系人" required>
              <el-input v-model="form.contactName" placeholder="请输入联系人" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系电话" required>
              <el-input v-model="form.mobilePhone" placeholder="请输入联系电话" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="客户行业" required>
              <el-input v-model="form.industry" placeholder="请输入客户行业" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="客户地区" required>
              <el-cascader
                v-model="form.regionCodes"
                :options="regionOptions"
                :props="{ checkStrictly: false }"
                clearable
                filterable
                style="width: 100%"
                placeholder="请选择省/市/区"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="详细地址" required>
          <el-input v-model="form.addressDetail" placeholder="请输入详细地址（街道/门牌号）" />
        </el-form-item>

        <el-form-item label="备注">
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="3"
            maxlength="300"
            show-word-limit
            placeholder="可选，填写客户补充说明"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button
          v-permission="['customer:create', 'customer:update']"
          type="primary"
          :loading="submitting"
          @click="saveCustomer"
        >
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * @input Customer CRUD service APIs, China area cascader data, permission directive bindings, and Element Plus table/dialog widgets
 * @output Customer management UI with province-city-district linkage and mandatory-field validation
 * @position Customer domain page providing standardized base records for downstream contract and project flows
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { codeToText, regionData } from "element-china-area-data";
import {
  createCustomer,
  deleteCustomer,
  fetchCustomers,
  updateCustomer,
  type CustomerPayload,
  type CustomerRecord
} from "./customer-service";

interface CascaderOption {
  value: string;
  label: string;
  children?: CascaderOption[];
}

interface CustomerFormState extends Omit<CustomerPayload, "region"> {
  regionCodes: string[];
}

const loading = ref(false);
const submitting = ref(false);
const dialogVisible = ref(false);
const editingId = ref<number | null>(null);
const customers = ref<CustomerRecord[]>([]);
const router = useRouter();
const regionOptions = regionData as unknown as CascaderOption[];
const nameToCode = new Map<string, string>(Object.entries(codeToText).map(([code, name]) => [String(name), code]));

const form = reactive<CustomerFormState>({
  fullName: "",
  industry: "",
  regionCodes: [],
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

function formatRegion(codes: string[]) {
  return codes
    .map((code) => String((codeToText as Record<string, string>)[code] || ""))
    .filter((name) => !!name)
    .join("/");
}

function parseRegionCodes(regionText: string | undefined) {
  if (!regionText) {
    return [];
  }
  const names = regionText
    .split("/")
    .map((item) => item.trim())
    .filter((item) => !!item);
  if (names.length < 2) {
    return [];
  }
  const codes = names.map((name) => nameToCode.get(name) || "");
  return codes.every((code) => !!code) ? codes : [];
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
  form.regionCodes = [];
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
  form.regionCodes = parseRegionCodes(row.region);
  form.addressDetail = row.addressDetail || "";
  form.uscc = row.uscc || "";
  form.contactName = row.contactName || "";
  form.mobilePhone = row.mobilePhone || "";
  form.remark = row.remark || "";
  dialogVisible.value = true;
}

function validateRequiredFields() {
  if (!form.fullName.trim()) return "客户全称不能为空";
  if (!form.uscc.trim()) return "统一社会信用代码不能为空";
  if (!form.contactName.trim()) return "联系人不能为空";
  if (!form.mobilePhone.trim()) return "联系电话不能为空";
  if (!form.industry.trim()) return "客户行业不能为空";
  if (form.regionCodes.length !== 3) return "请选择完整的省/市/区";
  if (!form.addressDetail.trim()) return "详细地址不能为空";
  return "";
}

async function saveCustomer() {
  const invalidMessage = validateRequiredFields();
  if (invalidMessage) {
    ElMessage.warning(invalidMessage);
    return;
  }

  const payload: CustomerPayload = {
    fullName: form.fullName.trim(),
    uscc: form.uscc.trim(),
    contactName: form.contactName.trim(),
    mobilePhone: form.mobilePhone.trim(),
    industry: form.industry.trim(),
    region: formatRegion(form.regionCodes),
    addressDetail: form.addressDetail.trim(),
    remark: form.remark?.trim() || ""
  };

  submitting.value = true;
  try {
    if (editingId.value) {
      await updateCustomer(editingId.value, payload);
      ElMessage.success("客户更新成功");
    } else {
      await createCustomer(payload);
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
    await ElMessageBox.confirm("确认删除该客户吗？删除后不可恢复。", "删除确认", {
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

function openEntityDetail(id: number) {
  void router.push(`/entity-detail/customer/${id}`);
}

onMounted(() => {
  void loadCustomers();
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
