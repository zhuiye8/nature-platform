<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { CascaderValue } from 'element-plus'
import { ArrowLeft, Edit, Download, Upload, Delete, Paperclip } from '@element-plus/icons-vue'
import {
  getPoliceRegisterDetail,
  updatePoliceRegister,
  completePoliceRegister,
} from '@/api/police'
import { regionData } from '@/utils/region-data'
import { getFileList, getFileDownloadPath, getFilePreviewPath, deleteFile, getUploadUrl, type FileItem } from '@/api/file'
import { getSystemItems } from '@/api/project'
import { getStatusLabel, getStatusTagType } from '@/utils/status-map'
import { formatTime } from '@/utils/format'
import SystemItemDetailDialog from '@/components/SystemItemDetailDialog.vue'

const route = useRoute()
const router = useRouter()
const policeId = computed(() => Number(route.params.id))
const loading = ref(false)
const detail = ref<any>(null)
const isDraft = computed(() => detail.value?.status === 'DRAFT')

// ── 系统明细详情弹窗 ──
const siDialogVisible = ref(false)
const siDialogItem = ref<any>(null)
const systemItemsWithFiles = ref<any[]>([])

async function loadSystemItemsWithFiles() {
  if (!detail.value?.projectRegisterId) return
  try {
    systemItemsWithFiles.value = (await getSystemItems(detail.value.projectRegisterId)) as any[]
  } catch { systemItemsWithFiles.value = [] }
}

function showSiDetail(row: any) {
  const enriched = systemItemsWithFiles.value.find((i: any) => i.id === row.id) || row
  siDialogItem.value = enriched
  siDialogVisible.value = true
}

// ── 登记信息编辑 ──
const editDialogVisible = ref(false)
const editForm = ref({
  registerNo: '',
  filingAgency: '',
  contactName: '',
  contactPhone: '',
  remark: '',
})
const editSaving = ref(false)
const filingRegionValue = ref<string[]>([])

const directMunicipalities = ['北京市', '上海市', '天津市', '重庆市']

function generateFilingAgency(regionPath: string[]): string {
  if (!regionPath || regionPath.length === 0) return ''
  const province = regionPath[0]
  const city = regionPath[1]
  const district = regionPath[2]
  if (directMunicipalities.includes(province)) {
    if (district) return `${province}公安局${district}分局`
    return `${province}公安局网安总队`
  }
  if (district) {
    if (district.endsWith('县') || district.endsWith('市')) return `${district}公安局`
    return `${city}公安局${district}分局`
  }
  if (city) return `${city}公安局网安支队`
  if (province.includes('自治区')) return `${province}公安厅网安总队`
  return `${province.replace('省', '')}省公安厅网安总队`
}

function normalizeCascaderPath(val: CascaderValue | null | undefined): string[] {
  return Array.isArray(val) ? val.map((item) => String(item)) : []
}

function onFilingRegionChange(val: CascaderValue | null | undefined) {
  const path = normalizeCascaderPath(val)
  filingRegionValue.value = path
  editForm.value.filingAgency = generateFilingAgency(path)
}

function openEditDialog() {
  editForm.value = {
    registerNo: detail.value?.registerNo ?? '',
    filingAgency: detail.value?.filingAgency ?? '',
    contactName: detail.value?.contactName ?? '',
    contactPhone: detail.value?.contactPhone ?? '',
    remark: detail.value?.remark ?? '',
  }
  filingRegionValue.value = []
  editDialogVisible.value = true
}

async function saveEdit() {
  // 验证必填
  const missing: string[] = []
  if (!editForm.value.registerNo) missing.push('登记编号')
  if (!editForm.value.filingAgency) missing.push('备案机关')
  if (!editForm.value.contactName) missing.push('联系人')
  if (!editForm.value.contactPhone) missing.push('联系电话')
  if (missing.length > 0) {
    ElMessage.warning(`请填写：${missing.join('、')}`)
    return
  }

  editSaving.value = true
  try {
    await updatePoliceRegister(policeId.value, editForm.value)
    ElMessage.success('保存成功')
    editDialogVisible.value = false
    fetchDetail()
  } finally {
    editSaving.value = false
  }
}

// ── 扫描件文件管理 ──
const scanFile = ref<FileItem | null>(null)
const filePreviewUrl = ref('')
const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const uploadHeaders = computed(() => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
}))

async function fetchScanFile() {
  try {
    const files = (await getFileList('POLICE', policeId.value)) as any as FileItem[]
    scanFile.value = files && files.length > 0 ? files[0] : null
    if (scanFile.value && (imageTypes.includes(scanFile.value.contentType) || scanFile.value.contentType === 'application/pdf')) {
      filePreviewUrl.value = getFilePreviewPath(scanFile.value.id)
    } else {
      filePreviewUrl.value = ''
    }
  } catch {
    scanFile.value = null
    filePreviewUrl.value = ''
  }
}

function handleFileDownload() {
  if (!scanFile.value) return
  window.open(getFileDownloadPath(scanFile.value.id), '_blank')
}

async function handleBeforeUpload() {
  if (scanFile.value) {
    try { await deleteFile(scanFile.value.id) } catch { /* ignore */ }
  }
  return true
}

function handleUploadSuccess() {
  ElMessage.success('上传成功')
  fetchScanFile()
}

async function handleDeleteFile() {
  if (!scanFile.value) return
  await deleteFile(scanFile.value.id)
  scanFile.value = null
  filePreviewUrl.value = ''
  ElMessage.success('已删除')
}

function formatFileSize(bytes: number) {
  if (!bytes) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// ── 完成登记 ──
const completing = ref(false)
async function handleComplete() {
  if (!detail.value?.registerNo) {
    ElMessage.warning('请先编辑登记信息')
    return
  }
  try {
    await ElMessageBox.confirm('确定完成登记？完成后将推进工作流。', '完成登记')
    completing.value = true
    await completePoliceRegister(policeId.value)
    ElMessage.success('登记完成')
    fetchDetail()
  } catch { /* cancelled */ }
  finally { completing.value = false }
}

// ── 加载数据 ──
async function fetchDetail() {
  loading.value = true
  try {
    detail.value = (await getPoliceRegisterDetail(policeId.value)) as any
  } finally {
    loading.value = false
  }
  fetchScanFile()
  loadSystemItemsWithFiles()
}

// 项目成员分组
const pmMember = computed(() => {
  if (!detail.value?.projectDetail?.members) return null
  return detail.value.projectDetail.members.find((m: any) => m.roleType === 'PM')
})

const assessors = computed(() => {
  if (!detail.value?.projectDetail?.members) return []
  return detail.value.projectDetail.members.filter((m: any) => m.roleType === 'ASSESSOR')
})

onMounted(fetchDetail)
</script>

<template>
  <div v-loading="loading">
    <!-- 页头 -->
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px">
      <el-button :icon="ArrowLeft" @click="router.back()">返回</el-button>
      <h2 style="margin: 0; font-size: 18px; color: #303133">公安登记详情</h2>
      <el-tag v-if="detail" :type="getStatusTagType(detail.status)" size="large">
        {{ getStatusLabel(detail.status) }}
      </el-tag>
    </div>

    <template v-if="detail">
      <!-- ── 项目信息 ── -->
      <el-card v-if="detail.projectDetail" shadow="never" style="margin-bottom: 16px">
        <template #header>
          <span style="font-weight: 600">项目信息</span>
        </template>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="项目名称">{{ detail.projectDetail.applicationName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="客户名称">{{ detail.projectDetail.customerName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="合同编号">{{ detail.projectDetail.contractNo || '--' }}</el-descriptions-item>
          <el-descriptions-item label="合同年度">{{ detail.projectDetail.contractYear ? detail.projectDetail.contractYear + '年' : '--' }}</el-descriptions-item>
        </el-descriptions>

        <!-- 系统明细 -->
        <div v-if="detail.projectDetail.systemItems?.length" style="margin-top: 16px">
          <h4 style="margin: 0 0 8px; font-size: 14px; color: #606266">系统明细（{{ detail.projectDetail.systemItems.length }} 个）</h4>
          <el-table :data="detail.projectDetail.systemItems" border size="small" stripe>
            <el-table-column type="index" label="#" width="50" align="center" />
            <el-table-column prop="systemName" label="系统名称" min-width="150" show-overflow-tooltip />
            <el-table-column label="安全等级" width="90" align="center">
              <template #default="{ row }">{{ row.securityLevel || '--' }}</template>
            </el-table-column>
            <el-table-column prop="assessedUnitName" label="被测单位" min-width="120" show-overflow-tooltip />
            <el-table-column label="操作" width="80" align="center">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="showSiDetail(row)">详情</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-card>

      <!-- ── 项目成员 ── -->
      <el-card shadow="never" style="margin-bottom: 16px">
        <template #header>
          <span style="font-weight: 600">项目成员</span>
        </template>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="项目经理">
            {{ detail.projectManagerName || pmMember?.displayName || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="测评师">
            {{ assessors.length > 0 ? assessors.map((a: any) => a.displayName).join('、') : '-' }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- ── 登记信息 ── -->
      <el-card shadow="never" style="margin-bottom: 16px">
        <template #header>
          <div style="display: flex; align-items: center; justify-content: space-between">
            <span style="font-weight: 600">登记信息</span>
            <el-button v-if="isDraft" type="primary" size="small" :icon="Edit" @click="openEditDialog">编辑</el-button>
          </div>
        </template>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="登记编号">{{ detail.registerNo || '--' }}</el-descriptions-item>
          <el-descriptions-item label="备案机关">{{ detail.filingAgency || '--' }}</el-descriptions-item>
          <el-descriptions-item label="联系人">{{ detail.contactName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="联系电话">{{ detail.contactPhone || '--' }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ detail.remark || '--' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatTime(detail.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="更新时间">{{ formatTime(detail.updatedAt) }}</el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- ── 电子扫描件 ── -->
      <el-card shadow="never" style="margin-bottom: 16px">
        <template #header>
          <span style="font-weight: 600">电子扫描件</span>
        </template>

        <!-- 已上传文件 -->
        <template v-if="scanFile">
          <div style="border: 1px solid var(--el-border-color-lighter); border-radius: 8px; padding: 16px; background: var(--el-fill-color-lighter)">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px">
              <div>
                <div style="font-weight: 500; margin-bottom: 4px">
                  <el-icon style="vertical-align: -2px; margin-right: 4px"><Paperclip /></el-icon>{{ scanFile.fileName }}
                </div>
                <div style="font-size: 12px; color: var(--el-text-color-secondary)">
                  {{ formatFileSize(scanFile.fileSize) }} · {{ formatTime(scanFile.uploadedAt) }}
                </div>
              </div>
              <div style="display: flex; gap: 6px">
                <el-button size="small" :icon="Download" @click="handleFileDownload">下载</el-button>
                <template v-if="isDraft">
                  <el-upload
                    :action="getUploadUrl('POLICE', policeId)"
                    :headers="uploadHeaders"
                    :show-file-list="false"
                    :before-upload="handleBeforeUpload"
                    :on-success="handleUploadSuccess"
                    accept=".pdf,.jpg,.jpeg,.png,.zip"
                  >
                    <el-button size="small" :icon="Upload">替换</el-button>
                  </el-upload>
                  <el-popconfirm title="确定删除扫描件？" @confirm="handleDeleteFile">
                    <template #reference>
                      <el-button size="small" type="danger" :icon="Delete">删除</el-button>
                    </template>
                  </el-popconfirm>
                </template>
              </div>
            </div>
            <!-- 图片预览 -->
            <div v-if="imageTypes.includes(scanFile.contentType) && filePreviewUrl" style="text-align: center; border-top: 1px solid var(--el-border-color-lighter); padding-top: 12px">
              <el-image :src="filePreviewUrl" :preview-src-list="[filePreviewUrl]" fit="contain" style="max-width: 100%; max-height: 400px; border-radius: 6px" />
            </div>
            <!-- PDF预览 -->
            <div v-else-if="scanFile.contentType === 'application/pdf' && filePreviewUrl" style="border-top: 1px solid var(--el-border-color-lighter); padding-top: 12px">
              <iframe :src="filePreviewUrl" style="width: 100%; height: 400px; border: none; border-radius: 6px" />
            </div>
            <!-- 不支持预览 -->
            <div v-else style="text-align: center; padding: 16px 0; color: var(--el-text-color-placeholder); border-top: 1px solid var(--el-border-color-lighter); padding-top: 12px; font-size: 13px">
              该格式不支持在线预览，请下载查看
            </div>
          </div>
        </template>

        <!-- 未上传 — 拖拽上传区 -->
        <template v-else-if="isDraft">
          <el-upload
            :action="getUploadUrl('POLICE', policeId)"
            :headers="uploadHeaders"
            :show-file-list="false"
            :on-success="handleUploadSuccess"
            drag
            accept=".pdf,.jpg,.jpeg,.png,.zip"
            style="width: 100%"
          >
            <el-icon style="font-size: 40px; color: var(--el-text-color-placeholder); margin-bottom: 8px"><Upload /></el-icon>
            <div style="color: var(--el-text-color-regular); font-size: 14px">将文件拖到此处，或<em style="color: var(--el-color-primary)">点击上传</em></div>
            <div style="color: var(--el-text-color-placeholder); font-size: 12px; margin-top: 4px">支持 PDF、JPG、PNG、ZIP 格式</div>
          </el-upload>
        </template>

        <el-empty v-else description="暂无扫描件" :image-size="60" />
      </el-card>

      <!-- ── 操作栏 ── -->
      <div v-if="isDraft" style="display: flex; justify-content: flex-end; gap: 12px; margin-bottom: 20px">
        <el-button type="success" :loading="completing" @click="handleComplete">完成登记</el-button>
      </div>
    </template>

    <!-- ── 登记信息编辑弹窗 ── -->
    <el-dialog v-model="editDialogVisible" title="编辑登记信息" width="520px" :close-on-click-modal="false">
      <el-form label-width="100px">
        <el-form-item label="登记编号" required>
          <el-input v-model="editForm.registerNo" placeholder="公安登记编号" />
        </el-form-item>
        <el-form-item label="备案区域" required>
          <el-cascader
            v-model="filingRegionValue"
            :options="regionData"
            :props="{ checkStrictly: true }"
            filterable
            clearable
            placeholder="请选择省市区"
            style="width: 100%"
            @change="onFilingRegionChange"
          />
        </el-form-item>
        <el-form-item label="备案机关" required>
          <el-input v-model="editForm.filingAgency" placeholder="选择区域后自动生成，可手动修改" />
        </el-form-item>
        <el-form-item label="联系人" required>
          <el-input v-model="editForm.contactName" placeholder="联系人" />
        </el-form-item>
        <el-form-item label="联系电话" required>
          <el-input v-model="editForm.contactPhone" placeholder="联系电话" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="editForm.remark" type="textarea" :rows="2" placeholder="备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="editSaving" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>

    <SystemItemDetailDialog
      v-model:visible="siDialogVisible"
      :item="siDialogItem"
    />
  </div>
</template>
