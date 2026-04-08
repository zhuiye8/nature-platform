<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Delete } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { createCustomer, updateCustomer, getCustomerDetail } from '@/api/customer'
import type { CustomerForm as CustomerFormData, ContactFormItem } from '@/api/customer'
import { regionData } from '@/utils/region-data'

// 行业分组选项
const industryGroups = [
  { label: '信息通信', options: ['电信', '广电', '经营性公众互联网'] },
  { label: '金融交通能源', options: ['铁路', '银行', '海关', '税务', '民航', '电力', '证券', '保险'] },
  { label: '政务部门', options: [
    '国防科技工业', '公安', '人力资源和社会保障', '财政', '审计', '商务',
    '国土资源', '能源', '交通', '统计', '市场监督管理', '邮政',
    '教育', '文旅', '卫生', '农业农村', '水利', '外交',
    '发展改革', '科技', '宣传', '网信', '法院', '检察院',
    '国防', '工信', '民族事务', '民政', '司法', '自然资源',
    '生态环境', '住建', '退役军人事务', '应急', '国资监管', '体育',
    '信访', '国际发展合作', '医疗保障', '气象', '数据管理', '药监', '电子政务',
  ]},
  { label: '其他', options: ['其他'] },
]

const props = defineProps<{
  visible: boolean
  customerId?: number | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  saved: []
}>()

const formRef = ref<FormInstance>()
const loading = ref(false)
const submitLoading = ref(false)

// 区域级联：数组值 ↔ 字符串值转换
const regionCascaderValue = ref<string[]>([])
function onRegionChange(val: string[]) {
  formData.value.region = val ? val.join('/') : ''
}
function parseRegionToArray(regionStr: string): string[] {
  return regionStr ? regionStr.split('/') : []
}

function emptyContact(): ContactFormItem {
  return { contactName: '', contactPhone: '', position: '', remark: '' }
}

const formData = ref<CustomerFormData>({
  fullName: '',
  industry: '',
  region: '',
  addressDetail: '',
  uscc: '',
  isGovernment: false,
  remark: '',
  contacts: [emptyContact()],
})

const rules: FormRules = {
  fullName: [{ required: true, message: '请输入客户名称', trigger: 'blur' }],
}

const isEdit = ref(false)
const dialogTitle = ref('新建客户')

watch(
  () => props.visible,
  async (val) => {
    if (val) {
      formRef.value?.resetFields()
      if (props.customerId) {
        isEdit.value = true
        dialogTitle.value = '编辑客户'
        loading.value = true
        try {
          const data = (await getCustomerDetail(props.customerId)) as any
          formData.value = {
            fullName: data.fullName,
            industry: data.industry ?? '',
            region: data.region ?? '',
            addressDetail: data.addressDetail ?? '',
            uscc: data.uscc ?? '',
            isGovernment: data.isGovernment,
            remark: data.remark ?? '',
            contacts: data.contacts && data.contacts.length > 0
              ? data.contacts.map((c: any) => ({
                  contactName: c.contactName,
                  contactPhone: c.contactPhone ?? '',
                  position: c.position ?? '',
                  remark: c.remark ?? '',
                }))
              : [emptyContact()],
          }
          regionCascaderValue.value = parseRegionToArray(data.region ?? '')
        } finally {
          loading.value = false
        }
      } else {
        isEdit.value = false
        dialogTitle.value = '新建客户'
        regionCascaderValue.value = []
        formData.value = {
          fullName: '',
          industry: '',
          region: '',
          addressDetail: '',
          uscc: '',
          isGovernment: false,
          remark: '',
          contacts: [emptyContact()],
        }
      }
    }
  },
)

function addContact() {
  formData.value.contacts = formData.value.contacts || []
  formData.value.contacts.push(emptyContact())
}

function removeContact(index: number) {
  formData.value.contacts?.splice(index, 1)
}

function handleClose() {
  emit('update:visible', false)
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  // Filter out empty contacts
  const contacts = (formData.value.contacts || []).filter(c => c.contactName.trim())

  submitLoading.value = true
  try {
    const payload = { ...formData.value, contacts }
    if (isEdit.value && props.customerId) {
      await updateCustomer(props.customerId, payload)
      ElMessage.success('更新成功')
    } else {
      await createCustomer(payload)
      ElMessage.success('创建成功')
    }
    emit('saved')
    handleClose()
  } finally {
    submitLoading.value = false
  }
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    :title="dialogTitle"
    width="720px"
    :close-on-click-modal="false"
    class="n-form-dialog"
    @update:model-value="(val: boolean) => emit('update:visible', val)"
  >
    <el-form
      ref="formRef"
      v-loading="loading"
      :model="formData"
      :rules="rules"
      label-width="100px"
    >
      <!-- 基本信息 -->
      <h4 class="n-section-title">基本信息</h4>
      <div class="n-form-row">
        <el-form-item label="客户名称" prop="fullName">
          <el-input v-model="formData.fullName" placeholder="请输入客户名称" />
        </el-form-item>
        <el-form-item label="信用代码" prop="uscc">
          <el-input v-model="formData.uscc" placeholder="统一社会信用代码" />
        </el-form-item>
        <el-form-item label="行业" prop="industry">
          <el-select v-model="formData.industry" filterable placeholder="请选择行业" style="width: 100%">
            <el-option-group v-for="group in industryGroups" :key="group.label" :label="group.label">
              <el-option v-for="item in group.options" :key="item" :label="item" :value="item" />
            </el-option-group>
          </el-select>
        </el-form-item>
        <el-form-item label="区域" prop="region">
          <el-cascader
            v-model="regionCascaderValue"
            :options="regionData"
            :props="{ checkStrictly: true }"
            filterable
            clearable
            placeholder="请选择区域"
            style="width: 100%"
            @change="onRegionChange"
          />
        </el-form-item>
        <el-form-item label="政府单位" prop="isGovernment">
          <el-switch v-model="formData.isGovernment" />
        </el-form-item>
      </div>

      <!-- 联系人列表 -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px">
        <h4 class="n-section-title" style="margin-bottom: 0">联系人</h4>
        <el-button type="primary" :icon="Plus" size="small" @click="addContact">添加联系人</el-button>
      </div>
      <el-table
        :data="formData.contacts"
        border
        size="small"
        style="width: 100%; margin-bottom: 16px"
      >
        <el-table-column label="姓名" min-width="120">
          <template #default="{ row }">
            <el-input v-model="row.contactName" placeholder="姓名" />
          </template>
        </el-table-column>
        <el-table-column label="电话" min-width="140">
          <template #default="{ row }">
            <el-input v-model="row.contactPhone" placeholder="电话" />
          </template>
        </el-table-column>
        <el-table-column label="职务" min-width="100">
          <template #default="{ row }">
            <el-input v-model="row.position" placeholder="职务" />
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="120">
          <template #default="{ row }">
            <el-input v-model="row.remark" placeholder="备注" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="60" align="center">
          <template #default="{ $index }">
            <el-button
              :icon="Delete"
              type="danger"
              link
              size="small"
              :disabled="(formData.contacts?.length ?? 0) <= 1"
              @click="removeContact($index)"
            />
          </template>
        </el-table-column>
      </el-table>

      <!-- 其他 -->
      <h4 class="n-section-title">其他</h4>
      <div class="n-form-row">
        <el-form-item label="地址" prop="addressDetail" class="n-form-full">
          <el-input v-model="formData.addressDetail" placeholder="请输入详细地址" />
        </el-form-item>
      </div>
      <el-form-item label="备注" prop="remark">
        <el-input
          v-model="formData.remark"
          type="textarea"
          :rows="3"
          placeholder="请输入备注"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="submitLoading" @click="handleSubmit">
        确定
      </el-button>
    </template>
  </el-dialog>
</template>
