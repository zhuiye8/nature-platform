<script setup lang="ts">
import { formatTime } from '@/utils/format'
import type { ProjectReportWriter } from '@/api/project'

/**
 * 编制人信息卡片。
 *
 * 显示条件由调用方控制（建议 v-if="reportWriter"）。
 * 展示两个字段：
 *   - 编制人：从 project_member.REPORT_WRITER 的用户 displayName
 *   - 最后提交时间：最近一次 REPORT_COMPILE SUBMIT 的 wf_action_log.createdAt；
 *                   尚未提交编制报告时显示"尚未提交"
 */
defineProps<{
  reportWriter: ProjectReportWriter
}>()
</script>

<template>
  <el-card shadow="never" style="margin-bottom: 16px">
    <template #header>
      <span style="font-weight: 600">报告编制</span>
    </template>
    <el-descriptions :column="2" border size="small">
      <el-descriptions-item label="编制人">{{ reportWriter.displayName }}</el-descriptions-item>
      <el-descriptions-item label="最后提交时间">
        {{ reportWriter.lastCompiledAt ? formatTime(reportWriter.lastCompiledAt) : '尚未提交' }}
      </el-descriptions-item>
    </el-descriptions>
  </el-card>
</template>
