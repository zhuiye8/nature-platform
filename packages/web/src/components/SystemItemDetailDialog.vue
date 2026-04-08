<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { getStatusLabel } from '@/utils/status-map'
import { getFileDownloadPath, getFilePreviewPath } from '@/api/file'

interface FileInfo {
  id: number
  fileName: string
  fileSize: number
}

interface SystemItemWithFiles {
  id?: number
  systemName: string
  filingAgency?: string | null
  securityLevel?: string | null
  isReassessment: boolean
  requiredEntryDate?: string | null
  requiredReportDeliveryDate?: string | null
  assessedUnitName?: string | null
  assessedUnitIndustry?: string | null
  assessedUnitContact?: string | null
  assessedUnitMobile?: string | null
  assessedUnitAddress?: string | null
  hasFilingCertificate: boolean
  filingCertificateNo?: string | null
  filingCertificateIssuedAt?: string | null
  hasFilingForm: boolean
  hasClassificationReport: boolean
  filingCertificateFile?: FileInfo | null
  filingFormFile?: FileInfo | null
  classificationReportFile?: FileInfo | null
}

const props = defineProps<{
  visible: boolean
  item: SystemItemWithFiles | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
}>()

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val),
})

function formatDate(d: string | null | undefined) {
  if (!d) return '-'
  return d.substring(0, 10)
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function isPreviewable(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'pdf'].includes(ext)
}

function handlePreview(fileId: number, fileName: string) {
  if (isPreviewable(fileName)) {
    window.open(getFilePreviewPath(fileId), '_blank')
  } else {
    ElMessage.info('该文件格式不支持预览，已开始下载')
    window.open(getFileDownloadPath(fileId), '_blank')
  }
}

function handleDownload(fileId: number, _fileName: string) {
  window.open(getFileDownloadPath(fileId), '_blank')
}

function renderFileStatus(hasFlag: boolean, file: FileInfo | null | undefined) {
  if (!hasFlag) return { text: '无', type: 'info' as const, file: null }
  if (!file) return { text: '有（未上传）', type: 'warning' as const, file: null }
  return { text: '有', type: 'success' as const, file }
}
</script>

<template>
  <el-dialog v-model="dialogVisible" title="系统明细详情" width="700px" destroy-on-close>
    <template v-if="item">
      <!-- 基本信息 -->
      <h4 style="margin: 0 0 12px; color: var(--n-text-secondary, #666)">基本信息</h4>
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="系统名称">{{ item.systemName }}</el-descriptions-item>
        <el-descriptions-item label="安全等级">{{ getStatusLabel(item.securityLevel) || '-' }}</el-descriptions-item>
        <el-descriptions-item label="备案单位">{{ item.filingAgency || '-' }}</el-descriptions-item>
        <el-descriptions-item label="是否复评">{{ item.isReassessment ? '是' : '否' }}</el-descriptions-item>
        <el-descriptions-item label="要求录入日期">{{ formatDate(item.requiredEntryDate) }}</el-descriptions-item>
        <el-descriptions-item label="要求出报告日期">{{ formatDate(item.requiredReportDeliveryDate) }}</el-descriptions-item>
      </el-descriptions>

      <!-- 被测单位信息 -->
      <h4 style="margin: 20px 0 12px; color: var(--n-text-secondary, #666)">被测单位信息</h4>
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="单位名称">{{ item.assessedUnitName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="所属行业">{{ item.assessedUnitIndustry || '-' }}</el-descriptions-item>
        <el-descriptions-item label="联系人">{{ item.assessedUnitContact || '-' }}</el-descriptions-item>
        <el-descriptions-item label="联系电话">{{ item.assessedUnitMobile || '-' }}</el-descriptions-item>
        <el-descriptions-item label="地址" :span="2">{{ item.assessedUnitAddress || '-' }}</el-descriptions-item>
      </el-descriptions>

      <!-- 备案信息 -->
      <h4 style="margin: 20px 0 12px; color: var(--n-text-secondary, #666)">备案信息</h4>
      <el-descriptions :column="1" border size="small" direction="horizontal">
        <!-- 备案证明 -->
        <el-descriptions-item label="备案证明">
          <template v-if="!item.hasFilingCertificate">
            <span style="color: #999">无</span>
          </template>
          <template v-else>
            <div>
              <el-tag v-if="item.filingCertificateFile" type="success" size="small">有</el-tag>
              <el-tag v-else type="warning" size="small">有（未上传）</el-tag>
              <span v-if="item.filingCertificateNo" style="margin-left: 12px">编号：{{ item.filingCertificateNo }}</span>
              <span v-if="item.filingCertificateIssuedAt" style="margin-left: 12px">日期：{{ formatDate(item.filingCertificateIssuedAt) }}</span>
            </div>
            <div v-if="item.filingCertificateFile" style="margin-top: 6px">
              <el-link
                type="primary"
                underline="never"
                @click="handlePreview(item.filingCertificateFile!.id, item.filingCertificateFile!.fileName)"
              >
                {{ item.filingCertificateFile.fileName }}
              </el-link>
              <span style="color: #999; margin-left: 8px; font-size: 12px">
                ({{ formatFileSize(item.filingCertificateFile.fileSize) }})
              </span>
              <el-button
                type="primary" link size="small" style="margin-left: 8px"
                @click="isPreviewable(item.filingCertificateFile!.fileName) ? handlePreview(item.filingCertificateFile!.id, item.filingCertificateFile!.fileName) : handleDownload(item.filingCertificateFile!.id, item.filingCertificateFile!.fileName)"
              >
                {{ isPreviewable(item.filingCertificateFile!.fileName) ? '预览' : '下载' }}
              </el-button>
            </div>
          </template>
        </el-descriptions-item>

        <!-- 备案表 -->
        <el-descriptions-item label="备案表">
          <template v-if="!item.hasFilingForm">
            <span style="color: #999">无</span>
          </template>
          <template v-else>
            <el-tag v-if="item.filingFormFile" type="success" size="small">有</el-tag>
            <el-tag v-else type="warning" size="small">有（未上传）</el-tag>
            <div v-if="item.filingFormFile" style="margin-top: 6px">
              <el-link
                type="primary"
                underline="never"
                @click="handlePreview(item.filingFormFile!.id, item.filingFormFile!.fileName)"
              >
                {{ item.filingFormFile.fileName }}
              </el-link>
              <span style="color: #999; margin-left: 8px; font-size: 12px">
                ({{ formatFileSize(item.filingFormFile.fileSize) }})
              </span>
              <el-button
                type="primary" link size="small" style="margin-left: 8px"
                @click="isPreviewable(item.filingFormFile!.fileName) ? handlePreview(item.filingFormFile!.id, item.filingFormFile!.fileName) : handleDownload(item.filingFormFile!.id, item.filingFormFile!.fileName)"
              >
                {{ isPreviewable(item.filingFormFile!.fileName) ? '预览' : '下载' }}
              </el-button>
            </div>
          </template>
        </el-descriptions-item>

        <!-- 定级报告 -->
        <el-descriptions-item label="定级报告">
          <template v-if="!item.hasClassificationReport">
            <span style="color: #999">无</span>
          </template>
          <template v-else>
            <el-tag v-if="item.classificationReportFile" type="success" size="small">有</el-tag>
            <el-tag v-else type="warning" size="small">有（未上传）</el-tag>
            <div v-if="item.classificationReportFile" style="margin-top: 6px">
              <el-link
                type="primary"
                underline="never"
                @click="handlePreview(item.classificationReportFile!.id, item.classificationReportFile!.fileName)"
              >
                {{ item.classificationReportFile.fileName }}
              </el-link>
              <span style="color: #999; margin-left: 8px; font-size: 12px">
                ({{ formatFileSize(item.classificationReportFile.fileSize) }})
              </span>
              <el-button
                type="primary" link size="small" style="margin-left: 8px"
                @click="isPreviewable(item.classificationReportFile!.fileName) ? handlePreview(item.classificationReportFile!.id, item.classificationReportFile!.fileName) : handleDownload(item.classificationReportFile!.id, item.classificationReportFile!.fileName)"
              >
                {{ isPreviewable(item.classificationReportFile!.fileName) ? '预览' : '下载' }}
              </el-button>
            </div>
          </template>
        </el-descriptions-item>
      </el-descriptions>
    </template>
  </el-dialog>
</template>
