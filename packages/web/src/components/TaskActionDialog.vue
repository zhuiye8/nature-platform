<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { signalTask, getUsersByRole } from '@/api/workflow'
import type { TaskItem } from '@/api/workflow'

const props = defineProps<{
  visible: boolean
  task: TaskItem | null
  nodeKey?: string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  completed: []
}>()

const actionType = ref<'APPROVE' | 'REJECT' | ''>('')
const remark = ref('')
const submitting = ref(false)

// Project review: assessor selection
const isProjectReview = ref(false)
const assessorOptions = ref<{ id: number; displayName: string }[]>([])
const selectedAssessorIds = ref<number[]>([])

watch(
  () => props.visible,
  async (val) => {
    if (val) {
      actionType.value = ''
      remark.value = ''
      selectedAssessorIds.value = []
      isProjectReview.value = props.nodeKey === 'PROJECT_REVIEW'

      if (isProjectReview.value) {
        try {
          assessorOptions.value = await getUsersByRole('assessor') as any
        } catch {
          assessorOptions.value = []
        }
      }
    }
  },
)

function handleAction(type: 'APPROVE' | 'REJECT') {
  actionType.value = type
}

async function handleSubmit() {
  if (!props.task || !actionType.value) return

  if (actionType.value === 'REJECT' && !remark.value.trim()) {
    ElMessage.warning('请填写驳回原因')
    return
  }

  // Project review: must select at least 1 assessor when approving
  if (isProjectReview.value && actionType.value === 'APPROVE' && selectedAssessorIds.value.length === 0) {
    ElMessage.warning('请至少选择一名测评师')
    return
  }

  submitting.value = true
  try {
    const extraData: Record<string, any> = {}
    if (isProjectReview.value && actionType.value === 'APPROVE') {
      extraData.assessorUserIds = selectedAssessorIds.value
    }

    await signalTask({
      instanceId: props.task.instanceId,
      taskId: props.task.id,
      action: actionType.value,
      remark: remark.value.trim() || undefined,
      ...(Object.keys(extraData).length > 0 ? { extraData } : {}),
    })
    ElMessage.success(actionType.value === 'APPROVE' ? '审批通过' : '已驳回')
    emit('completed')
    emit('update:visible', false)
  } catch {
    // error handled by request interceptor
  } finally {
    submitting.value = false
  }
}

function handleClose() {
  emit('update:visible', false)
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    title="审批操作"
    :width="isProjectReview ? '560px' : '480px'"
    :close-on-click-modal="false"
    @update:model-value="handleClose"
  >
    <div v-if="task" style="margin-bottom: 16px">
      <el-descriptions :column="1" border size="small">
        <el-descriptions-item label="业务名称">{{ task.bizName }}</el-descriptions-item>
        <el-descriptions-item label="当前节点">{{ task.nodeName }}</el-descriptions-item>
      </el-descriptions>
    </div>

    <div v-if="!actionType" style="display: flex; gap: 12px; justify-content: center; padding: 20px 0">
      <el-button type="success" size="large" @click="handleAction('APPROVE')">
        通过
      </el-button>
      <el-button type="danger" size="large" @click="handleAction('REJECT')">
        驳回
      </el-button>
    </div>

    <div v-else>
      <el-alert
        v-if="actionType === 'APPROVE'"
        title="确认通过该审批？"
        type="success"
        :closable="false"
        show-icon
        style="margin-bottom: 16px"
      />
      <el-alert
        v-if="actionType === 'REJECT'"
        title="请填写驳回原因"
        type="warning"
        :closable="false"
        show-icon
        style="margin-bottom: 16px"
      />

      <!-- Project review: select assessors when approving -->
      <div v-if="isProjectReview && actionType === 'APPROVE'" style="margin-bottom: 16px">
        <div style="margin-bottom: 8px; font-weight: 600; font-size: 14px">
          分配测评师 <span style="color: #f56c6c">*</span>
        </div>
        <el-select
          v-model="selectedAssessorIds"
          multiple
          filterable
          placeholder="请选择测评师（可多选）"
          style="width: 100%"
        >
          <el-option
            v-for="user in assessorOptions"
            :key="user.id"
            :label="user.displayName"
            :value="user.id"
          />
        </el-select>
        <div style="margin-top: 4px; color: #909399; font-size: 12px">
          已选 {{ selectedAssessorIds.length }} 人，审核通过后将自动分配为本项目的测评师
        </div>
      </div>

      <el-input
        v-if="actionType === 'REJECT'"
        v-model="remark"
        type="textarea"
        :rows="3"
        placeholder="请输入驳回原因（必填）"
        maxlength="500"
        show-word-limit
      />

      <el-input
        v-if="actionType === 'APPROVE'"
        v-model="remark"
        type="textarea"
        :rows="2"
        placeholder="备注（选填）"
        maxlength="500"
        show-word-limit
      />
    </div>

    <template #footer>
      <div v-if="actionType" style="display: flex; gap: 8px; justify-content: flex-end">
        <el-button @click="actionType = ''">返回</el-button>
        <el-button
          :type="actionType === 'APPROVE' ? 'success' : 'danger'"
          :loading="submitting"
          @click="handleSubmit"
        >
          {{ actionType === 'APPROVE' ? '确认通过' : '确认驳回' }}
        </el-button>
      </div>
      <div v-else>
        <el-button @click="handleClose">取消</el-button>
      </div>
    </template>
  </el-dialog>
</template>
