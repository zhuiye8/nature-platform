<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { createCustomer, updateCustomer, getCustomerDetail } from '@/api/customer'
import type { CustomerForm as CustomerFormData } from '@/api/customer'

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

const formData = ref<CustomerFormData>({
  fullName: '',
  industry: '',
  region: '',
  addressDetail: '',
  uscc: '',
  contactName: '',
  mobilePhone: '',
  isGovernment: false,
  remark: '',
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
          const data = (await getCustomerDetail(props.customerId)) as unknown as import('@/api/customer').CustomerItem
          formData.value = {
            fullName: data.fullName,
            industry: data.industry ?? '',
            region: data.region ?? '',
            addressDetail: data.addressDetail ?? '',
            uscc: data.uscc ?? '',
            contactName: data.contactName ?? '',
            mobilePhone: data.mobilePhone ?? '',
            isGovernment: data.isGovernment,
            remark: data.remark ?? '',
          }
        } finally {
          loading.value = false
        }
      } else {
        isEdit.value = false
        dialogTitle.value = '新建客户'
        formData.value = {
          fullName: '',
          industry: '',
          region: '',
          addressDetail: '',
          uscc: '',
          contactName: '',
          mobilePhone: '',
          isGovernment: false,
          remark: '',
        }
      }
    }
  },
)

function handleClose() {
  emit('update:visible', false)
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitLoading.value = true
  try {
    if (isEdit.value && props.customerId) {
      await updateCustomer(props.customerId, formData.value)
      ElMessage.success('更新成功')
    } else {
      await createCustomer(formData.value)
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
    width="640px"
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
          <el-input v-model="formData.industry" placeholder="请输入行业" />
        </el-form-item>
        <el-form-item label="区域" prop="region">
          <el-input v-model="formData.region" placeholder="请输入区域" />
        </el-form-item>
        <el-form-item label="政府单位" prop="isGovernment">
          <el-switch v-model="formData.isGovernment" />
        </el-form-item>
      </div>

      <!-- 联系信息 -->
      <h4 class="n-section-title">联系信息</h4>
      <div class="n-form-row">
        <el-form-item label="联系人" prop="contactName">
          <el-input v-model="formData.contactName" placeholder="请输入联系人" />
        </el-form-item>
        <el-form-item label="手机号" prop="mobilePhone">
          <el-input v-model="formData.mobilePhone" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="地址" prop="addressDetail" class="n-form-full">
          <el-input v-model="formData.addressDetail" placeholder="请输入详细地址" />
        </el-form-item>
      </div>

      <!-- 其他 -->
      <h4 class="n-section-title">其他</h4>
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
