<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Upload, Download, Delete } from '@element-plus/icons-vue'
import { getArchiveByProject, submitArchive } from '@/api/archive'
import { getSystemItems } from '@/api/project'
import { getFileList, getFileDownloadPath, deleteFile, getUploadUrl, type FileItem } from '@/api/file'
import { getStatusLabel, getStatusTagType } from '@/utils/status-map'
import { formatTime } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import FilePoolPanel from '@/components/FilePoolPanel.vue'
import SystemItemDetailDialog from '@/components/SystemItemDetailDialog.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

// Only archiver or super_admin can submit archive (PM/sales can only edit materials)
const isArchiver = computed(() => {
  const roles = authStore.user?.roles || []
  return roles.includes('archiver') || roles.includes('super_admin')
})
const projectRegisterId = Number(route.params.projectRegisterId)

const data = ref<any>(null)
const loading = ref(true)
const submitting = ref(false)

// 卷内清单 — 18 items, each with per-item fields
interface MaterialItem {
  code: string
  label: string
  docNo: string
  checked: boolean
  remark: string
  fileCount: number
  storageLocation: string
}

const materialChecklist = ref<MaterialItem[]>([
  { code: 'CX18-01', label: '测评项目计划书', docNo: 'YZDZR/CX18-01', checked: false, remark: '', fileCount: 1, storageLocation: '' },
  { code: 'CX18-02', label: '基本情况调查表', docNo: 'YZDZR/CX18-02', checked: false, remark: '', fileCount: 1, storageLocation: '' },
  { code: 'CX18-03', label: '网络安全等级保护测评方案', docNo: 'YZDZR/CX18-03', checked: false, remark: '', fileCount: 1, storageLocation: '' },
  { code: 'CX18-05', label: '测评方案评审记录表', docNo: 'YZDZR/CX18-05', checked: false, remark: '', fileCount: 1, storageLocation: '' },
  { code: 'CX18-06', label: '风险告知书', docNo: 'YZDZR/CX18-06', checked: false, remark: '', fileCount: 1, storageLocation: '' },
  { code: 'CX18-07', label: '现场测评首次会议签到及记录表', docNo: 'YZDZR/CX18-07', checked: false, remark: '', fileCount: 1, storageLocation: '' },
  { code: 'CX18-09', label: '现场测评授权书', docNo: 'YZDZR/CX18-09', checked: false, remark: '', fileCount: 1, storageLocation: '' },
  { code: 'CX18-10', label: '安全测试授权书', docNo: 'YZDZR/CX18-10', checked: false, remark: '', fileCount: 1, storageLocation: '' },
  { code: 'CX18-11', label: '系统状态确认书', docNo: 'YZDZR/CX18-11', checked: false, remark: '', fileCount: 1, storageLocation: '' },
  { code: 'CX18-12', label: '网络安全等级保护测评结果记录', docNo: 'YZDZR/CX18-12', checked: false, remark: '', fileCount: 1, storageLocation: '' },
  { code: 'CX18-14', label: '现场测评末次会议签到及记录表', docNo: 'YZDZR/CX18-14', checked: false, remark: '', fileCount: 1, storageLocation: '' },
  { code: 'CX18-17', label: '现场测评文档接收/归还记录表', docNo: 'YZDZR/CX18-17', checked: false, remark: '', fileCount: 1, storageLocation: '' },
  { code: 'CX17-01', label: '测评设备使用申请表', docNo: 'YZDZR/CX17-01', checked: false, remark: '', fileCount: 1, storageLocation: '' },
  { code: 'CX17-02', label: '测评设备（工具）使用表', docNo: 'YZDZR/CX17-02', checked: false, remark: '', fileCount: 1, storageLocation: '' },
  { code: 'CX22-02', label: '测评报告评审记录表', docNo: 'YZDZR/CX22-02', checked: false, remark: '', fileCount: 1, storageLocation: '' },
  { code: 'CX22-03', label: '测评资料签收单', docNo: 'YZDZR/CX22-03', checked: false, remark: '', fileCount: 1, storageLocation: '' },
  { code: 'CX07-01', label: '网络安全等级保护测评服务情况评价表', docNo: 'YZDZR/CX07-01', checked: false, remark: '', fileCount: 1, storageLocation: '' },
  { code: 'REPORT', label: '测评报告', docNo: '/', checked: false, remark: '', fileCount: 1, storageLocation: '' },
])

const allChecked = computed(() => materialChecklist.value.every((i) => i.checked))
const noneChecked = computed(() => materialChecklist.value.every((i) => !i.checked))
const checkedCount = computed(() => materialChecklist.value.filter((i) => i.checked).length)

function toggleAll(val: boolean) {
  materialChecklist.value.forEach((i) => { i.checked = val })
}

// 存放位置快速填充：用第一个已填的值填充所有空的
function fillAllStorageLocation() {
  const first = materialChecklist.value.find((i) => i.storageLocation.trim())
  if (!first) return
  materialChecklist.value.forEach((i) => {
    if (!i.storageLocation.trim()) i.storageLocation = first.storageLocation
  })
  ElMessage.success('已快速填充存放位置')
}

const hasFirstLocation = computed(() => materialChecklist.value.some((i) => i.storageLocation.trim()))
const hasEmptyLocation = computed(() => materialChecklist.value.some((i) => !i.storageLocation.trim()))

// Per-item file management
const itemFiles = ref<Record<string, FileItem[]>>({})
const uploadHeaders = computed(() => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
}))

// Use nodeKey to distinguish items within the same bizId
function getItemNodeKey(code: string) {
  return `ARCHIVE_${code}`
}

async function fetchItemFiles() {
  try {
    const allFiles = (await getFileList('ARCHIVE', projectRegisterId)) as any as FileItem[]
    // Group by nodeKey
    for (const item of materialChecklist.value) {
      itemFiles.value[item.code] = (allFiles || []).filter((f: any) => f.nodeKey === getItemNodeKey(item.code))
    }
  } catch {
    for (const item of materialChecklist.value) { itemFiles.value[item.code] = [] }
  }
}

function getItemUploadUrl(code: string) {
  return getUploadUrl('ARCHIVE', projectRegisterId, getItemNodeKey(code))
}

function handleItemUploadSuccess(code: string) {
  ElMessage.success('上传成功')
  fetchItemFilesSingle(code)
}

async function fetchItemFilesSingle(code: string) {
  try {
    const allFiles = (await getFileList('ARCHIVE', projectRegisterId)) as any as FileItem[]
    itemFiles.value[code] = (allFiles || []).filter((f: any) => f.nodeKey === getItemNodeKey(code))
  } catch { itemFiles.value[code] = [] }
}

function handleItemFileDownload(fileId: number) {
  window.open(getFileDownloadPath(fileId), '_blank')
}

async function handleItemFileDelete(code: string, fileId: number) {
  await deleteFile(fileId)
  ElMessage.success('已删除')
  fetchItemFilesSingle(code)
}

// Expand row to show detail
const expandedRows = ref<string[]>([])

// System item detail
const siDialogVisible = ref(false)
const siDialogItem = ref<any>(null)
const systemItemsWithFiles = ref<any[]>([])

async function loadSystemItemsWithFiles() {
  try { systemItemsWithFiles.value = (await getSystemItems(projectRegisterId)) as any[] }
  catch { systemItemsWithFiles.value = [] }
}

function showSiDetail(row: any) {
  const enriched = systemItemsWithFiles.value.find((i: any) => i.id === row.id) || row
  siDialogItem.value = enriched
  siDialogVisible.value = true
}

// Computed helpers
const project = computed(() => data.value?.project)
const contractInfo = computed(() => project.value?.contractInfo)
const archive = computed(() => data.value?.archive)
const pmMember = computed(() => project.value?.members?.find((m: any) => m.roleType === 'PM'))
const assessors = computed(() => project.value?.members?.filter((m: any) => m.roleType === 'ASSESSOR') ?? [])
const reportWriters = computed(() => project.value?.members?.filter((m: any) => m.roleType === 'REPORT_WRITER') ?? [])

const isSubmitted = computed(() => archive.value?.status === 'SUBMITTED')
const archiveStatusLabel = computed(() => {
  if (!isSubmitted.value) return '待归档'
  return checkedCount.value >= materialChecklist.value.length ? '已归档' : '未完全归档'
})
const archiveTagType = computed(() => {
  if (!isSubmitted.value) return 'info'
  return checkedCount.value >= materialChecklist.value.length ? 'success' : 'warning'
})

async function fetchData() {
  loading.value = true
  try {
    data.value = await getArchiveByProject(projectRegisterId)
    if (data.value?.archive) {
      const savedItems = (data.value.archive.materialStatusCodes ?? []) as any[]
      // Restore per-item data
      for (const saved of savedItems) {
        if (typeof saved === 'object' && saved.code) {
          const item = materialChecklist.value.find((i) => i.code === saved.code)
          if (item) {
            item.checked = saved.checked ?? false
            item.remark = saved.remark ?? ''
            item.fileCount = saved.fileCount ?? 1
            item.storageLocation = saved.storageLocation ?? ''
          }
        } else if (typeof saved === 'string') {
          // Legacy format: just code strings
          const item = materialChecklist.value.find((i) => i.code === saved)
          if (item) item.checked = true
        }
      }
    }
  } finally { loading.value = false }
  loadSystemItemsWithFiles()
  fetchItemFiles()
}

async function handleSubmit() {
  // Save per-item data as objects
  const materialData = materialChecklist.value.map((item) => ({
    code: item.code,
    checked: item.checked,
    remark: item.remark,
    fileCount: item.fileCount,
    storageLocation: item.storageLocation,
  }))

  submitting.value = true
  try {
    await submitArchive({
      projectRegisterId,
      materialStatusCodes: materialData as any,
    })
    ElMessage.success(isSubmitted.value ? '归档已更新' : '归档已提交')
    fetchData()
  } finally { submitting.value = false }
}

onMounted(fetchData)
</script>

<template>
  <div v-loading="loading">
    <!-- 页头 -->
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px">
      <el-button :icon="ArrowLeft" @click="router.push('/archive')">返回</el-button>
      <h2 style="margin: 0; font-size: 18px; color: #303133">材料归档详情</h2>
      <el-tag :type="archiveTagType" size="large">{{ archiveStatusLabel }}</el-tag>
    </div>

    <template v-if="project">
      <!-- ── 项目信息 ── -->
      <el-card shadow="never" style="margin-bottom: 16px">
        <template #header><span style="font-weight: 600">项目信息</span></template>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="项目名称">{{ project.applicationName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="合同年度">{{ project.contractYear ? project.contractYear + '年' : '--' }}</el-descriptions-item>
          <el-descriptions-item label="项目状态">
            <el-tag :type="getStatusTagType(project.status)" size="small">{{ getStatusLabel(project.status) }}</el-tag>
          </el-descriptions-item>
        </el-descriptions>
        <div v-if="project.systemItems?.length" style="margin-top: 16px">
          <h4 style="margin: 0 0 8px; font-size: 14px; color: #606266">系统明细（{{ project.systemItems.length }} 个）</h4>
          <el-table :data="project.systemItems" border size="small" stripe>
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

      <!-- ── 关联合同信息 ── -->
      <el-card v-if="contractInfo" shadow="never" style="margin-bottom: 16px">
        <template #header><span style="font-weight: 600">关联合同信息</span></template>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="合同编号">{{ contractInfo.contractNo || '--' }}</el-descriptions-item>
          <el-descriptions-item label="项目名称">{{ contractInfo.projectName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="客户名称">{{ contractInfo.customerName || '--' }}</el-descriptions-item>
          <el-descriptions-item label="合同类型">{{ getStatusLabel(contractInfo.contractType) || '--' }}</el-descriptions-item>
          <el-descriptions-item label="合同金额">{{ contractInfo.paymentAmount ?? '--' }}</el-descriptions-item>
          <el-descriptions-item label="付款方式">{{ contractInfo.paymentMethod || '--' }}</el-descriptions-item>
          <el-descriptions-item label="付款单位">{{ contractInfo.paymentCompany || '--' }}</el-descriptions-item>
          <el-descriptions-item label="业绩归属城市">{{ contractInfo.performanceCity || '--' }}</el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- ── 项目成员 ── -->
      <el-card shadow="never" style="margin-bottom: 16px">
        <template #header><span style="font-weight: 600">项目成员</span></template>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="项目经理">{{ pmMember?.displayName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="测评师">{{ assessors.length > 0 ? assessors.map((a: any) => a.displayName).join('、') : '-' }}</el-descriptions-item>
          <el-descriptions-item label="编制人">{{ reportWriters.length > 0 ? reportWriters.map((w: any) => w.displayName).join('、') : '-' }}</el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- ── 测评成果 ── -->
      <el-card shadow="never" style="margin-bottom: 16px">
        <template #header><span style="font-weight: 600">测评成果</span></template>
        <FilePoolPanel api-type="assessment" :project-register-id="projectRegisterId" file-pool="ASSESSMENT_RESULT" :readonly="true" />
      </el-card>

      <!-- ── 编制报告 ── -->
      <el-card shadow="never" style="margin-bottom: 16px">
        <template #header><span style="font-weight: 600">编制报告</span></template>
        <FilePoolPanel api-type="compile" :project-register-id="projectRegisterId" :readonly="true" />
      </el-card>

      <!-- ── 卷内清单 ── -->
      <el-card shadow="never" style="margin-bottom: 16px">
        <template #header>
          <div style="display: flex; align-items: center; justify-content: space-between">
            <span style="font-weight: 600">卷内清单（{{ checkedCount }}/{{ materialChecklist.length }}）</span>
            <div style="display: flex; align-items: center; gap: 8px">
              <el-button size="small" :disabled="allChecked" @click="toggleAll(true)">全选</el-button>
              <el-button size="small" :disabled="noneChecked" @click="toggleAll(false)">全不选</el-button>
              <el-button size="small" type="info" :disabled="!hasFirstLocation || !hasEmptyLocation" @click="fillAllStorageLocation">快速填充存放位置</el-button>
              <el-tag :type="archiveTagType" size="small">{{ archiveStatusLabel }}</el-tag>
            </div>
          </div>
        </template>

        <el-table :data="materialChecklist" border size="small" stripe row-key="code">
          <el-table-column label="" width="50" align="center">
            <template #default="{ row }">
              <el-checkbox v-model="row.checked" />
            </template>
          </el-table-column>
          <el-table-column type="index" label="#" width="50" align="center" />
          <el-table-column prop="label" label="记录名称" min-width="250" />
          <el-table-column prop="docNo" label="文档编号" width="140" />
          <el-table-column label="文件数" width="80" align="center">
            <template #default="{ row }">
              <el-input-number v-model="row.fileCount" :min="0" :max="999" :controls="false" size="small" style="width: 60px" />
            </template>
          </el-table-column>
          <el-table-column label="存放位置" width="140">
            <template #default="{ row }">
              <el-input v-model="row.storageLocation" size="small" placeholder="位置" />
            </template>
          </el-table-column>
          <el-table-column label="备注" width="140">
            <template #default="{ row }">
              <el-input v-model="row.remark" size="small" placeholder="备注" />
            </template>
          </el-table-column>
          <el-table-column label="扫描件" width="160" align="center">
            <template #default="{ row }">
              <div style="display: flex; align-items: center; gap: 4px; justify-content: center">
                <el-upload
                  :action="getItemUploadUrl(row.code)"
                  :headers="uploadHeaders"
                  :show-file-list="false"
                  :on-success="() => handleItemUploadSuccess(row.code)"
                  accept=".pdf,.jpg,.jpeg,.png,.zip"
                >
                  <el-button :icon="Upload" size="small" link type="primary">上传</el-button>
                </el-upload>
                <template v-if="itemFiles[row.code]?.length > 0">
                  <el-popover trigger="hover" width="250">
                    <template #reference>
                      <el-tag type="success" size="small" style="cursor: pointer">{{ itemFiles[row.code].length }}个文件</el-tag>
                    </template>
                    <div v-for="f in itemFiles[row.code]" :key="f.id" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px">
                      <span style="font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 150px">{{ f.fileName }}</span>
                      <div style="display: flex; gap: 4px">
                        <el-button :icon="Download" size="small" link @click="handleItemFileDownload(f.id)" />
                        <el-button :icon="Delete" size="small" link type="danger" @click="handleItemFileDelete(row.code, f.id)" />
                      </div>
                    </div>
                  </el-popover>
                </template>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="期限" width="60" align="center">
            <template #default>2年</template>
          </el-table-column>
        </el-table>

        <!-- 操作 -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 16px">
          <div v-if="archive?.submittedAt" style="color: #909399; font-size: 13px">
            上次归档时间：{{ formatTime(archive.submittedAt) }}
          </div>
          <div v-else></div>
          <el-button v-if="isArchiver" type="primary" :loading="submitting" @click="handleSubmit">
            {{ isSubmitted ? '更新归档' : '提交归档' }}
          </el-button>
        </div>
      </el-card>
    </template>

    <SystemItemDetailDialog v-model:visible="siDialogVisible" :item="siDialogItem" />
  </div>
</template>
