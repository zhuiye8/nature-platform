<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { signalTask } from '@/api/workflow'
import { getOpinionTemplates } from '@/api/review-opinion'
import { getFileList, getUploadUrl, deleteFile, type FileItem } from '@/api/file'
import type { TaskItem } from '@/api/workflow'

const props = defineProps<{
  visible: boolean
  task: TaskItem | null
  actionType: 'APPROVE' | 'REVIEW' | 'REJECT'
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  completed: []
}>()

const opinionText = ref('')
const submitting = ref(false)
const attachedFiles = ref<{ id: number; fileName: string }[]>([])
const uploadHeaders = computed(() => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
}))

function handleFileUploadSuccess(response: any) {
  const fileData = response?.data || response
  if (fileData?.id) {
    attachedFiles.value.push({ id: fileData.id, fileName: fileData.fileName || '文件' })
  }
}

function removeAttachedFile(index: number) {
  const file = attachedFiles.value[index]
  if (file) {
    deleteFile(file.id).catch(() => {})
    attachedFiles.value.splice(index, 1)
  }
}

const dialogTitle = computed(() => {
  switch (props.actionType) {
    case 'APPROVE': return '审核通过'
    case 'REVIEW': return '复核意见'
    case 'REJECT': return '驳回意见'
    default: return '审核操作'
  }
})

const confirmType = computed(() => {
  switch (props.actionType) {
    case 'APPROVE': return 'success'
    case 'REVIEW': return 'warning'
    case 'REJECT': return 'danger'
    default: return 'primary'
  }
})

const confirmText = computed(() => {
  switch (props.actionType) {
    case 'APPROVE': return '确认通过'
    case 'REVIEW': return '确认复核'
    case 'REJECT': return '确认驳回'
    default: return '确认'
  }
})

const alertTitle = computed(() => {
  const nk = (props.task as any)?.nodeKey ?? ''
  switch (props.actionType) {
    case 'APPROVE': return '确认通过后流程将推进到下一节点'
    case 'REVIEW':
      if (nk === 'FINAL_REVIEW') return '复核后编制人将收到通知，修改编制报告后重新提交'
      return '复核后项目经理将收到整改通知，修改测评成果后重新提交'
    case 'REJECT': return '驳回后流程将回到现场测评，项目经理修改测评成果后重新发起质量审核（新一轮）'
    default: return ''
  }
})

const alertType = computed(() => {
  switch (props.actionType) {
    case 'APPROVE': return 'success'
    case 'REVIEW': return 'warning'
    case 'REJECT': return 'error'
    default: return 'info'
  }
})

watch(
  () => props.visible,
  async (val) => {
    if (val && props.task) {
      opinionText.value = ''
      attachedFiles.value = []
      // Auto-fill from template
      try {
        const templates = await getOpinionTemplates(
          props.task.nodeKey,
          props.actionType,
          props.task.slotKey || undefined,
        ) as any
        if (Array.isArray(templates) && templates.length > 0) {
          opinionText.value = templates[0].templateText
        }
      } catch {
        // Template loading failure is non-critical
      }
    }
  },
)

async function handleSubmit() {
  if (!props.task) return

  if (!opinionText.value.trim()) {
    ElMessage.warning('请填写审核意见')
    return
  }

  submitting.value = true
  try {
    await signalTask({
      instanceId: props.task.instanceId,
      taskId: props.task.id,
      action: props.actionType,
      remark: opinionText.value.trim(),
      opinionText: opinionText.value.trim(),
      attachmentIds: attachedFiles.value.length > 0
        ? attachedFiles.value.map((f) => f.id)
        : undefined,
    })

    const msg = props.actionType === 'APPROVE' ? '审核已通过'
      : props.actionType === 'REVIEW' ? '已提交复核意见'
      : '已驳回'
    ElMessage.success(msg)
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
    :title="dialogTitle"
    width="560px"
    :close-on-click-modal="false"
    @update:model-value="handleClose"
  >
    <div v-if="task" style="margin-bottom: 16px">
      <el-descriptions :column="1" border size="small">
        <el-descriptions-item label="业务名称">{{ task.bizName }}</el-descriptions-item>
        <el-descriptions-item label="当前节点">{{ task.nodeName }}</el-descriptions-item>
      </el-descriptions>
    </div>

    <el-alert
      :title="alertTitle"
      :type="alertType"
      :closable="false"
      show-icon
      style="margin-bottom: 16px"
    />

    <div style="margin-bottom: 8px; font-weight: 600; font-size: 14px">
      审核意见 <span style="color: #f56c6c">*</span>
    </div>
    <el-input
      v-model="opinionText"
      type="textarea"
      :rows="4"
      maxlength="2000"
      show-word-limit
      placeholder="请输入审核意见"
    />
    <div style="margin-top: 4px; color: #909399; font-size: 12px">
      系统已根据节点自动填充默认意见，您可以自行编辑修改
    </div>

    <!-- 附件上传区（可选） -->
    <div style="margin-top: 16px">
      <div style="margin-bottom: 8px; font-weight: 600; font-size: 14px">
        附件
      </div>
      <el-upload
        :action="task ? `/api/file/upload?bizType=REVIEW_OPINION&bizId=${task.instanceId}` : ''"
        :headers="uploadHeaders"
        :show-file-list="false"
        :on-success="handleFileUploadSuccess"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip"
      >
        <el-button size="small" type="primary" plain>选择附件</el-button>
      </el-upload>
      <div v-if="attachedFiles.length > 0" style="margin-top: 8px">
        <el-tag
          v-for="(f, idx) in attachedFiles"
          :key="f.id"
          closable
          style="margin-right: 8px; margin-bottom: 4px"
          @close="removeAttachedFile(idx)"
        >
          {{ f.fileName }}
        </el-tag>
      </div>
    </div>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button
        :type="confirmType"
        :loading="submitting"
        @click="handleSubmit"
      >
        {{ confirmText }}
      </el-button>
    </template>
  </el-dialog>
</template>
