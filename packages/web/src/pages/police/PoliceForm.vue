<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { createPoliceRegister, getAvailableProjects } from '@/api/police'
import type { AvailableProject } from '@/api/police'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ 'update:visible': [val: boolean]; saved: [] }>()

const formRef = ref()
const loading = ref(false)
const availableProjects = ref<AvailableProject[]>([])
const form = ref({
  projectRegisterId: undefined as number | undefined,
  remark: '',
})

const rules = {
  projectRegisterId: [{ required: true, message: '请选择关联项目', trigger: 'change' }],
}

watch(() => props.visible, async (val) => {
  if (!val) return
  form.value = { projectRegisterId: undefined, remark: '' }
  availableProjects.value = await getAvailableProjects()
})

async function handleSubmit() {
  await formRef.value?.validate()
  loading.value = true
  try {
    await createPoliceRegister(form.value as any)
    ElMessage.success('创建成功，请在详情页完善登记信息')
    emit('update:visible', false)
    emit('saved')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    title="新建公安登记"
    width="520px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:visible', $event)"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
      <el-form-item label="关联项目" prop="projectRegisterId">
        <el-select
          v-model="form.projectRegisterId"
          placeholder="请选择已通过审核的项目"
          filterable
          style="width: 100%"
        >
          <el-option
            v-for="p in availableProjects"
            :key="p.id"
            :label="p.applicationName"
            :value="p.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="请输入备注（选填）" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="loading" @click="handleSubmit">保存</el-button>
    </template>
  </el-dialog>
</template>
