<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus, Download, Upload, View, Hide } from '@element-plus/icons-vue'
import { getPlatformPage, createPlatform, updatePlatform, deletePlatform, getExportUrl, importPlatform } from '@/api/platform'
import type { PlatformItem, PlatformForm, PlatformQuery } from '@/api/platform'
import { formatTime } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const tableData = ref<PlatformItem[]>([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)

// Filters
const filterPlatformName = ref('')
const filterWebsiteUrl = ref('')
const filterHasCa = ref('')
const filterCaDateRange = ref<string[]>([])
const filterCreatedBy = ref<number | ''>('')

// Password visibility
const showAllPasswords = ref(false)
const showAllCaPasswords = ref(false)
const visiblePasswordIds = ref<Set<number>>(new Set())
const visibleCaPasswordIds = ref<Set<number>>(new Set())

function togglePassword(id: number) {
  if (visiblePasswordIds.value.has(id)) visiblePasswordIds.value.delete(id)
  else visiblePasswordIds.value.add(id)
  visiblePasswordIds.value = new Set(visiblePasswordIds.value)
}

function toggleCaPassword(id: number) {
  if (visibleCaPasswordIds.value.has(id)) visibleCaPasswordIds.value.delete(id)
  else visibleCaPasswordIds.value.add(id)
  visibleCaPasswordIds.value = new Set(visibleCaPasswordIds.value)
}

function toggleAllPasswords() {
  showAllPasswords.value = !showAllPasswords.value
  visiblePasswordIds.value = new Set()
}

function toggleAllCaPasswords() {
  showAllCaPasswords.value = !showAllCaPasswords.value
  visibleCaPasswordIds.value = new Set()
}

function isPasswordVisible(id: number) {
  return showAllPasswords.value ? !visiblePasswordIds.value.has(id) : visiblePasswordIds.value.has(id)
}

function isCaPasswordVisible(id: number) {
  return showAllCaPasswords.value ? !visibleCaPasswordIds.value.has(id) : visibleCaPasswordIds.value.has(id)
}

function maskPassword(val: string | null) {
  return val ? '••••••' : '--'
}

// Build query params
function buildQuery(): PlatformQuery {
  return {
    page: currentPage.value,
    pageSize: pageSize.value,
    platformName: filterPlatformName.value || undefined,
    websiteUrl: filterWebsiteUrl.value || undefined,
    hasCa: filterHasCa.value || undefined,
    caExpireDateFrom: filterCaDateRange.value?.[0] || undefined,
    caExpireDateTo: filterCaDateRange.value?.[1] || undefined,
    createdByUserId: filterCreatedBy.value || undefined,
  }
}

async function fetchData() {
  loading.value = true
  try {
    const data = (await getPlatformPage(buildQuery())) as any
    tableData.value = data.list
    total.value = data.total
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  currentPage.value = 1
  fetchData()
}

function handleReset() {
  filterPlatformName.value = ''
  filterWebsiteUrl.value = ''
  filterHasCa.value = ''
  filterCaDateRange.value = []
  filterCreatedBy.value = ''
  currentPage.value = 1
  fetchData()
}

// CRUD dialog
const dialogVisible = ref(false)
const dialogTitle = ref('新增')
const editingId = ref<number | null>(null)
const formData = ref<PlatformForm>({})
const formSaving = ref(false)

function openCreate() {
  editingId.value = null
  dialogTitle.value = '新增注册平台'
  formData.value = { hasCa: false }
  dialogVisible.value = true
}

function openEdit(row: PlatformItem) {
  editingId.value = row.id
  dialogTitle.value = '编辑注册平台'
  formData.value = {
    platformName: row.platformName || '',
    websiteUrl: row.websiteUrl || '',
    account: row.account || '',
    password: row.password || '',
    hasCa: row.hasCa,
    caExpireDate: row.caExpireDate || '',
    caPassword: row.caPassword || '',
    contactName: row.contactName || '',
    contactPhone: row.contactPhone || '',
    remark: row.remark || '',
  }
  dialogVisible.value = true
}

async function handleSave() {
  formSaving.value = true
  try {
    if (editingId.value) {
      await updatePlatform(editingId.value, formData.value)
      ElMessage.success('更新成功')
    } else {
      await createPlatform(formData.value)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    fetchData()
  } finally {
    formSaving.value = false
  }
}

async function handleDelete(row: PlatformItem) {
  try {
    await ElMessageBox.confirm('确定删除该平台记录吗？', '确认', { type: 'warning' })
    await deletePlatform(row.id)
    ElMessage.success('已删除')
    fetchData()
  } catch { /* cancelled */ }
}

// Export
const exportDialogVisible = ref(false)
const exportFields = ref<string[]>([
  'platformName', 'websiteUrl', 'account', 'password',
  'hasCa', 'caExpireDate', 'caPassword',
  'contactName', 'contactPhone', 'remark', 'creatorName', 'createdAt',
])
const allExportFields = [
  { key: 'platformName', label: '平台名称' },
  { key: 'websiteUrl', label: '网址' },
  { key: 'account', label: '账户' },
  { key: 'password', label: '密码' },
  { key: 'hasCa', label: '是否办理CA' },
  { key: 'caExpireDate', label: 'CA到期时间' },
  { key: 'caPassword', label: 'CA密码' },
  { key: 'contactName', label: '联系人' },
  { key: 'contactPhone', label: '手机号' },
  { key: 'remark', label: '备注' },
  { key: 'creatorName', label: '录入人' },
  { key: 'createdAt', label: '录入时间' },
]

function handleExport() {
  exportDialogVisible.value = true
}

function doExport() {
  const url = getExportUrl({ ...buildQuery(), fields: exportFields.value.join(',') })
  window.open(url, '_blank')
  exportDialogVisible.value = false
}

// Import
const uploadHeaders = computed(() => ({ Authorization: `Bearer ${localStorage.getItem('token')}` }))

async function handleImportSuccess(response: any) {
  ElMessage.success(response?.message || `导入成功`)
  fetchData()
}

function handleImportError() {
  ElMessage.error('导入失败，请检查文件格式')
}

// Debounced platform name search
let debounceTimer: ReturnType<typeof setTimeout> | null = null
function debouncedSearch() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => handleSearch(), 300)
}
watch(filterPlatformName, debouncedSearch)
watch(filterWebsiteUrl, debouncedSearch)

onMounted(fetchData)
</script>

<template>
  <div>
    <el-card shadow="never">
      <template #header>
        <div style="display: flex; align-items: center; justify-content: space-between">
          <span style="font-weight: 600; font-size: 16px">注册平台管理</span>
          <div style="display: flex; gap: 8px">
            <div v-permission="'platform:create'" style="display: inline-block">
              <el-upload
                action="/api/platform/import"
                :headers="uploadHeaders"
                :show-file-list="false"
                accept=".xlsx,.xls"
                :on-success="handleImportSuccess"
                :on-error="handleImportError"
              >
                <el-button :icon="Upload">导入</el-button>
              </el-upload>
            </div>
            <el-button v-permission="'platform:export'" :icon="Download" @click="handleExport">导出</el-button>
            <el-button v-permission="'platform:create'" type="primary" :icon="Plus" @click="openCreate">新增</el-button>
          </div>
        </div>
      </template>

      <!-- Filters -->
      <div style="margin-bottom: 16px; display: flex; gap: 12px; flex-wrap: wrap">
        <el-input
          v-model="filterPlatformName"
          placeholder="平台名称"
          clearable
          style="width: 180px"
          :prefix-icon="Search"
        />
        <el-input
          v-model="filterWebsiteUrl"
          placeholder="网址"
          clearable
          style="width: 200px"
          :prefix-icon="Search"
        />
        <el-select v-model="filterHasCa" placeholder="是否办理CA" clearable style="width: 140px" @change="handleSearch">
          <el-option label="是" value="true" />
          <el-option label="否" value="false" />
        </el-select>
        <el-date-picker
          v-model="filterCaDateRange"
          type="daterange"
          range-separator="~"
          start-placeholder="CA到期开始"
          end-placeholder="CA到期结束"
          value-format="YYYY-MM-DD"
          style="width: 280px"
          @change="handleSearch"
        />
        <el-button :icon="Search" type="primary" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="handleReset">重置</el-button>
      </div>

      <!-- Table -->
      <el-table v-loading="loading" :data="tableData" stripe border style="width: 100%">
        <el-table-column prop="id" label="编号" width="70" align="center" />
        <el-table-column prop="platformName" label="平台名称" min-width="150">
          <template #default="{ row }">
            <span style="white-space: normal; word-break: break-all; line-height: 1.5">{{ row.platformName || '--' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="网址" min-width="200">
          <template #default="{ row }">
            <el-link v-if="row.websiteUrl" type="primary" :href="row.websiteUrl" target="_blank" underline="never" style="white-space: normal; word-break: break-all; line-height: 1.5">{{ row.websiteUrl }}</el-link>
            <span v-else>--</span>
          </template>
        </el-table-column>
        <el-table-column label="账户" min-width="120">
          <template #default="{ row }">
            <span style="white-space: normal; word-break: break-all; line-height: 1.5">{{ row.account || '--' }}</span>
          </template>
        </el-table-column>
        <el-table-column min-width="120">
          <template #header>
            <div style="display: flex; align-items: center; gap: 4px">
              密码
              <el-button :icon="showAllPasswords ? Hide : View" link size="small" @click="toggleAllPasswords" />
            </div>
          </template>
          <template #default="{ row }">
            <span>{{ isPasswordVisible(row.id) ? (row.password || '--') : maskPassword(row.password) }}</span>
            <el-button v-if="row.password" :icon="isPasswordVisible(row.id) ? Hide : View" link size="small" style="margin-left: 4px" @click="togglePassword(row.id)" />
          </template>
        </el-table-column>
        <el-table-column label="办理CA" min-width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.hasCa ? 'success' : 'info'" size="small">{{ row.hasCa ? '是' : '否' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="caExpireDate" label="CA到期时间" min-width="120" />
        <el-table-column min-width="120">
          <template #header>
            <div style="display: flex; align-items: center; gap: 4px">
              CA密码
              <el-button :icon="showAllCaPasswords ? Hide : View" link size="small" @click="toggleAllCaPasswords" />
            </div>
          </template>
          <template #default="{ row }">
            <span>{{ isCaPasswordVisible(row.id) ? (row.caPassword || '--') : maskPassword(row.caPassword) }}</span>
            <el-button v-if="row.caPassword" :icon="isCaPasswordVisible(row.id) ? Hide : View" link size="small" style="margin-left: 4px" @click="toggleCaPassword(row.id)" />
          </template>
        </el-table-column>
        <el-table-column prop="contactName" label="联系人" min-width="90" />
        <el-table-column prop="contactPhone" label="手机号" min-width="120" />
        <el-table-column prop="remark" label="备注" min-width="200">
          <template #default="{ row }">
            <div style="white-space: pre-wrap; word-break: break-all;">
              {{ row.remark || '--' }}
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="creatorName" label="录入人" min-width="90" />
        <el-table-column label="录入时间" min-width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button v-permission="'platform:update'" type="primary" link size="small" @click="openEdit(row)">编辑</el-button>
            <el-button v-permission="'platform:delete'" type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- Pagination -->
      <div style="display: flex; justify-content: flex-end; margin-top: 16px">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="() => { currentPage = 1; fetchData() }"
          @current-change="fetchData"
        />
      </div>
    </el-card>

    <!-- Create/Edit Dialog -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px" :close-on-click-modal="false">
      <el-form label-width="100px">
        <el-form-item label="平台名称">
          <el-input v-model="formData.platformName" placeholder="请输入平台名称" />
        </el-form-item>
        <el-form-item label="网址">
          <el-input v-model="formData.websiteUrl" placeholder="https://" />
        </el-form-item>
        <el-form-item label="账户">
          <el-input v-model="formData.account" placeholder="请输入账户" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="formData.password" placeholder="请输入密码" />
        </el-form-item>
        <el-form-item label="是否办理CA">
          <el-switch v-model="formData.hasCa" />
        </el-form-item>
        <el-form-item v-if="formData.hasCa" label="CA到期时间">
          <el-date-picker v-model="formData.caExpireDate" type="date" value-format="YYYY-MM-DD" placeholder="请选择" style="width: 100%" />
        </el-form-item>
        <el-form-item v-if="formData.hasCa" label="CA密码">
          <el-input v-model="formData.caPassword" placeholder="请输入CA密码" />
        </el-form-item>
        <el-form-item label="联系人">
          <el-input v-model="formData.contactName" placeholder="联系人姓名" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="formData.contactPhone" placeholder="联系人手机号" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="formData.remark" type="textarea" :rows="2" placeholder="备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="formSaving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- Export Dialog -->
    <el-dialog v-model="exportDialogVisible" title="导出设置" width="400px">
      <p style="margin-bottom: 12px; color: #606266; font-size: 13px">选择要导出的字段（将导出当前筛选条件下的全部数据）</p>
      <el-checkbox-group v-model="exportFields" style="display: flex; flex-direction: column; gap: 6px">
        <el-checkbox v-for="f in allExportFields" :key="f.key" :value="f.key">{{ f.label }}</el-checkbox>
      </el-checkbox-group>
      <template #footer>
        <el-button @click="exportDialogVisible = false">取消</el-button>
        <el-button type="primary" :icon="Download" @click="doExport">导出</el-button>
      </template>
    </el-dialog>
  </div>
</template>
