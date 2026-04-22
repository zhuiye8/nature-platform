<script setup lang="ts">
import { computed } from 'vue'
import type { AssessorLevel } from '@/api/project'

/**
 * 测评师等级小 tag
 * - senior → 橙色 "高级"
 * - middle → 蓝色 "中级"
 * - junior → 灰色 "初级"
 * - null   → 灰色 "未分级"
 *
 * 注意：PM 不应渲染此 tag，调用方用 v-if 控制（而不是在组件里判断 roleType）。
 */
const props = defineProps<{
  level: AssessorLevel | null
}>()

const config = computed<{ label: string; type: 'warning' | 'primary' | 'info' }>(() => {
  switch (props.level) {
    case 'senior':
      return { label: '高级', type: 'warning' }
    case 'middle':
      return { label: '中级', type: 'primary' }
    case 'junior':
      return { label: '初级', type: 'info' }
    default:
      return { label: '未分级', type: 'info' }
  }
})
</script>

<template>
  <el-tag :type="config.type" size="small" effect="plain" style="margin-left: 6px">
    {{ config.label }}
  </el-tag>
</template>
