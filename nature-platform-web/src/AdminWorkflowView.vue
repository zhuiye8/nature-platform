<template>
  <div class="page-shell page section-stack">
    <header class="page-header">
      <div>
        <h2>流程与节点规则</h2>
        <p>维护流程节点定义与“节点安插人”规则，现场测评分配候选池会实时读取本配置。</p>
      </div>
      <el-button v-permission="['workflow:manage', 'workflow-node-rule:manage']" :loading="loading" @click="loadAll">
        刷新
      </el-button>
    </header>

    <el-card class="table-card">
      <template #header>
        <div class="card-header-row">
          <span>流程定义</span>
          <el-button v-permission="'workflow:manage'" type="primary" @click="openCreateDefinition">新建节点</el-button>
        </div>
      </template>
      <el-table :data="definitions" v-loading="loading" empty-text="暂无流程定义">
        <el-table-column prop="nodeKey" label="节点编码" min-width="200" />
        <el-table-column prop="nodeName" label="节点名称" min-width="180" />
        <el-table-column prop="nodeOrder" label="排序" width="90" />
        <el-table-column label="阶段" width="140">
          <template #default="{ row }">
            {{ stageLabel(row.stage) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? "启用" : "停用" }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="260" />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button v-permission="'workflow:manage'" size="small" @click="openEditDefinition(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card class="table-card">
      <template #header>
        <div class="card-header-row">
          <span>节点规则（安插人）</span>
          <el-button v-permission="'workflow-node-rule:manage'" type="primary" @click="openCreateRule">新建规则</el-button>
        </div>
      </template>
      <el-table :data="rules" v-loading="loading" empty-text="暂无节点规则">
        <el-table-column prop="nodeKey" label="节点编码" min-width="200" />
        <el-table-column prop="ruleName" label="规则名称" min-width="180" />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? "启用" : "停用" }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="规则项" width="100">
          <template #default="{ row }">
            {{ row.items.length }}
          </template>
        </el-table-column>
        <el-table-column prop="updatedBy" label="更新人" width="140" />
        <el-table-column prop="updatedAt" label="更新时间" min-width="180" />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button v-permission="'workflow-node-rule:manage'" size="small" @click="openEditRule(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="definitionDialogVisible" :title="definitionEditing ? '编辑流程节点' : '新建流程节点'" width="640px">
      <el-form label-width="100px">
        <el-form-item label="节点编码" required>
          <el-input v-model="definitionForm.nodeKey" :disabled="definitionEditing" placeholder="例如 ON_SITE_ASSESSMENT" />
        </el-form-item>
        <el-form-item label="节点名称" required>
          <el-input v-model="definitionForm.nodeName" placeholder="请输入节点名称" />
        </el-form-item>
        <el-form-item label="排序" required>
          <el-input-number v-model="definitionForm.nodeOrder" :min="0" :max="10000" />
        </el-form-item>
        <el-form-item label="阶段" required>
          <el-select v-model="definitionForm.stage" style="width: 100%">
            <el-option
              v-for="item in stageOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="启用状态">
          <el-switch v-model="definitionForm.enabled" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="definitionForm.description" type="textarea" :rows="2" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="definitionDialogVisible = false">取消</el-button>
        <el-button v-permission="'workflow:manage'" type="primary" :loading="submittingDefinition" @click="saveDefinition">
          保存
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="ruleDialogVisible"
      :title="ruleEditing ? '编辑节点规则' : '新建节点规则'"
      width="1360px"
      top="5vh"
      class="rule-dialog"
    >
      <el-form label-width="100px">
        <el-form-item label="节点编码" required>
          <el-input v-model="ruleForm.nodeKey" :disabled="ruleEditing" placeholder="例如 ON_SITE_ASSESSMENT" />
        </el-form-item>
        <el-form-item label="规则名称" required>
          <el-input v-model="ruleForm.ruleName" placeholder="请输入规则名称" />
        </el-form-item>
        <el-form-item label="启用状态">
          <el-switch v-model="ruleForm.enabled" />
        </el-form-item>
      </el-form>

      <el-divider content-position="left">规则项</el-divider>

      <el-table :data="ruleForm.items" size="small" border>
        <el-table-column label="槽位编码" min-width="140">
          <template #default="{ row }">
            <el-input v-model="row.slotKey" placeholder="TECH_REVIEWER" />
          </template>
        </el-table-column>
        <el-table-column label="槽位名称" min-width="140">
          <template #default="{ row }">
            <el-input v-model="row.slotLabel" placeholder="技术审核人" />
          </template>
        </el-table-column>
        <el-table-column label="角色名称" min-width="240">
          <template #default="{ row }">
            <el-select v-model="row.roleCode" filterable clearable style="width: 100%" placeholder="选择角色名称">
              <el-option
                v-for="role in roleOptions"
                :key="role.roleCode"
                :label="role.optionLabel"
                :value="role.roleCode"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="必选" width="90">
          <template #default="{ row }">
            <el-switch v-model="row.requiredFlag" />
          </template>
        </el-table-column>
        <el-table-column label="最小" width="90">
          <template #default="{ row }">
            <el-input-number v-model="row.minCount" :min="0" :max="10" />
          </template>
        </el-table-column>
        <el-table-column label="最大" width="90">
          <template #default="{ row }">
            <el-input-number v-model="row.maxCount" :min="1" :max="10" />
          </template>
        </el-table-column>
        <el-table-column label="排序" width="90">
          <template #default="{ row }">
            <el-input-number v-model="row.sortOrder" :min="0" :max="999" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ $index }">
            <el-button v-permission="'workflow-node-rule:manage'" link type="danger" @click="removeRuleItem($index)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="rule-actions">
        <el-button v-permission="'workflow-node-rule:manage'" @click="addRuleItem">新增规则项</el-button>
      </div>

      <template #footer>
        <el-button @click="ruleDialogVisible = false">取消</el-button>
        <el-button
          v-permission="'workflow-node-rule:manage'"
          type="primary"
          :loading="submittingRule"
          @click="saveRule"
        >
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * @input Admin workflow-definition/rule APIs and Element Plus table/form/dialog controls
 * @output Workflow-governance page supporting stage-selected definition maintenance and role-name-based node-rule editing
 * @position Admin UI page for configurable workflow and assignee-slot rule management
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import {
  fetchAdminRoles,
  fetchWorkflowDefinitions,
  fetchWorkflowNodeRules,
  fetchWorkflowRoleCodes,
  upsertWorkflowDefinition,
  upsertWorkflowNodeRule,
  type WorkflowDefinitionRecord,
  type WorkflowNodeRuleItemRecord,
  type WorkflowNodeRuleRecord,
  type AdminRoleRecord
} from "./admin-service";

const stageOptions = [
  { label: "业务流程", value: "BUSINESS" },
  { label: "报告归档", value: "REPORT" },
  { label: "系统管理", value: "SYSTEM" }
] as const;

const loading = ref(false);
const submittingDefinition = ref(false);
const submittingRule = ref(false);

const definitions = ref<WorkflowDefinitionRecord[]>([]);
const rules = ref<WorkflowNodeRuleRecord[]>([]);
const roleOptions = ref<Array<{ roleCode: string; roleName: string; optionLabel: string }>>([]);

const definitionDialogVisible = ref(false);
const definitionEditing = ref(false);

const ruleDialogVisible = ref(false);
const ruleEditing = ref(false);

const definitionForm = reactive<WorkflowDefinitionRecord>({
  nodeKey: "",
  nodeName: "",
  nodeOrder: 0,
  stage: "BUSINESS",
  enabled: true,
  description: ""
});

const ruleForm = reactive<WorkflowNodeRuleRecord>({
  nodeKey: "",
  ruleName: "",
  enabled: true,
  updatedBy: "",
  updatedAt: "",
  items: []
});

function stageLabel(stage: string): string {
  return stageOptions.find((item) => item.value === stage)?.label || stage;
}

function readErrorMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof message === "string" && message.trim() ? message : fallback;
}

function resetDefinitionForm() {
  definitionForm.nodeKey = "";
  definitionForm.nodeName = "";
  definitionForm.nodeOrder = 0;
  definitionForm.stage = "BUSINESS";
  definitionForm.enabled = true;
  definitionForm.description = "";
}

function createEmptyRuleItem(): WorkflowNodeRuleItemRecord {
  return {
    slotKey: "",
    slotLabel: "",
    roleCode: "",
    requiredFlag: true,
    minCount: 1,
    maxCount: 1,
    sortOrder: 0
  };
}

function buildRoleOptions(
  workflowRoleCodes: string[],
  adminRoles: AdminRoleRecord[],
  ruleRows: WorkflowNodeRuleRecord[]
): Array<{ roleCode: string; roleName: string; optionLabel: string }> {
  const roleNameMap = new Map(adminRoles.map((role) => [role.roleCode, role.roleName]));
  const roleCodes = new Set<string>(workflowRoleCodes);
  for (const row of ruleRows) {
    for (const item of row.items) {
      if (item.roleCode?.trim()) {
        roleCodes.add(item.roleCode.trim());
      }
    }
  }
  return Array.from(roleCodes)
    .filter((roleCode) => roleCode.trim().length > 0)
    .map((roleCode) => {
      const roleName = roleNameMap.get(roleCode)?.trim() || roleCode;
      return {
        roleCode,
        roleName,
        optionLabel: roleName === roleCode ? roleName : `${roleName}（${roleCode}）`
      };
    })
    .sort((a, b) => a.roleName.localeCompare(b.roleName, "zh-CN"));
}

function resetRuleForm() {
  ruleForm.nodeKey = "";
  ruleForm.ruleName = "";
  ruleForm.enabled = true;
  ruleForm.updatedBy = "";
  ruleForm.updatedAt = "";
  ruleForm.items = [createEmptyRuleItem()];
}

function openCreateDefinition() {
  definitionEditing.value = false;
  resetDefinitionForm();
  definitionDialogVisible.value = true;
}

function openEditDefinition(row: WorkflowDefinitionRecord) {
  definitionEditing.value = true;
  definitionForm.nodeKey = row.nodeKey;
  definitionForm.nodeName = row.nodeName;
  definitionForm.nodeOrder = row.nodeOrder;
  definitionForm.stage = row.stage;
  definitionForm.enabled = row.enabled;
  definitionForm.description = row.description || "";
  definitionDialogVisible.value = true;
}

function openCreateRule() {
  ruleEditing.value = false;
  resetRuleForm();
  ruleDialogVisible.value = true;
}

function openEditRule(row: WorkflowNodeRuleRecord) {
  ruleEditing.value = true;
  ruleForm.nodeKey = row.nodeKey;
  ruleForm.ruleName = row.ruleName;
  ruleForm.enabled = row.enabled;
  ruleForm.updatedBy = row.updatedBy || "";
  ruleForm.updatedAt = row.updatedAt || "";
  ruleForm.items = row.items.map((item) => ({ ...item }));
  if (!ruleForm.items.length) {
    ruleForm.items = [createEmptyRuleItem()];
  }
  ruleDialogVisible.value = true;
}

function addRuleItem() {
  ruleForm.items.push(createEmptyRuleItem());
}

function removeRuleItem(index: number) {
  ruleForm.items.splice(index, 1);
  if (!ruleForm.items.length) {
    ruleForm.items.push(createEmptyRuleItem());
  }
}

async function loadAll() {
  loading.value = true;
  try {
    const [definitionRows, ruleRows, workflowRoleCodeRows, adminRoleRows] = await Promise.all([
      fetchWorkflowDefinitions(),
      fetchWorkflowNodeRules(),
      fetchWorkflowRoleCodes(),
      fetchAdminRoles()
    ]);
    definitions.value = definitionRows;
    rules.value = ruleRows;
    roleOptions.value = buildRoleOptions(workflowRoleCodeRows, adminRoleRows, ruleRows);
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "加载流程配置失败"));
  } finally {
    loading.value = false;
  }
}

async function saveDefinition() {
  if (!definitionForm.nodeKey.trim()) {
    ElMessage.warning("节点编码不能为空");
    return;
  }
  if (!definitionForm.nodeName.trim()) {
    ElMessage.warning("节点名称不能为空");
    return;
  }
  if (!definitionForm.stage.trim()) {
    ElMessage.warning("阶段不能为空");
    return;
  }

  submittingDefinition.value = true;
  try {
    await upsertWorkflowDefinition(definitionForm.nodeKey.trim(), {
      nodeName: definitionForm.nodeName.trim(),
      nodeOrder: definitionForm.nodeOrder,
      stage: definitionForm.stage.trim(),
      enabled: definitionForm.enabled,
      description: definitionForm.description.trim() || undefined
    });
    ElMessage.success("流程节点保存成功");
    definitionDialogVisible.value = false;
    await loadAll();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "保存流程节点失败"));
  } finally {
    submittingDefinition.value = false;
  }
}

function validateRuleForm(): boolean {
  if (!ruleForm.nodeKey.trim()) {
    ElMessage.warning("节点编码不能为空");
    return false;
  }
  if (!ruleForm.ruleName.trim()) {
    ElMessage.warning("规则名称不能为空");
    return false;
  }
  if (!ruleForm.items.length) {
    ElMessage.warning("至少需要 1 条规则项");
    return false;
  }

  for (const item of ruleForm.items) {
    if (!item.slotKey.trim() || !item.slotLabel.trim() || !item.roleCode.trim()) {
      ElMessage.warning("规则项的槽位编码/名称/角色编码不能为空");
      return false;
    }
    if (item.minCount < 0 || item.maxCount <= 0 || item.minCount > item.maxCount) {
      ElMessage.warning("规则项最小/最大人数配置不合法");
      return false;
    }
  }
  return true;
}

async function saveRule() {
  if (!validateRuleForm()) {
    return;
  }

  submittingRule.value = true;
  try {
    await upsertWorkflowNodeRule(ruleForm.nodeKey.trim(), {
      ruleName: ruleForm.ruleName.trim(),
      enabled: ruleForm.enabled,
      items: ruleForm.items.map((item) => ({
        slotKey: item.slotKey.trim(),
        slotLabel: item.slotLabel.trim(),
        roleCode: item.roleCode.trim(),
        requiredFlag: item.requiredFlag,
        minCount: item.minCount,
        maxCount: item.maxCount,
        sortOrder: item.sortOrder
      }))
    });
    ElMessage.success("节点规则保存成功");
    ruleDialogVisible.value = false;
    await loadAll();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "保存节点规则失败"));
  } finally {
    submittingRule.value = false;
  }
}

onMounted(() => {
  void loadAll();
});
</script>

<style scoped>
.card-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.rule-actions {
  margin-top: 12px;
}

.rule-dialog :deep(.el-dialog) {
  max-width: calc(100vw - 48px);
}

.rule-dialog :deep(.el-input-number) {
  width: 100%;
}
</style>
