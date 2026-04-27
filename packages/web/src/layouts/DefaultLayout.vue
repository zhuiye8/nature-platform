<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import logoWhiteUrl from '/images/logo-white.png'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useNotification } from '@/composables/useNotification'
import type { NotificationItem } from '@/api/notification'
import {
  Fold,
  Expand,
  HomeFilled,
  SwitchButton,
  User,
  Document,
  Folder,
  Bell,
  OfficeBuilding,
  Briefcase,
  Setting,
  Key,
  Delete,
  UserFilled,
  Monitor,
  FolderChecked,
  Coin,
  Tickets,
  Money,
  TrendCharts,
} from '@element-plus/icons-vue'

import { usePermission } from '@/composables/usePermission'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()
const { hasPermission, hasAnyPermission } = usePermission()
const isCollapsed = ref(false)
const notificationPopoverVisible = ref(false)

// Watermark: username + displayName
const watermarkContent = computed(() => {
  const user = authStore.user
  if (!user) return []
  return [user.username, user.displayName]
})

const {
  unreadCount,
  notifications,
  connect,
  disconnect,
  fetchUnreadCount,
  fetchNotifications,
  handleMarkRead,
  handleMarkAllRead,
} = useNotification()

function toggleSidebar() {
  isCollapsed.value = !isCollapsed.value
}

function handleLogout() {
  disconnect()
  authStore.logout()
}

function navigateTo(path: string) {
  router.push(path)
}

function handleBellClick(e: Event) {
  e.stopPropagation()
  notificationPopoverVisible.value = !notificationPopoverVisible.value
  if (notificationPopoverVisible.value) {
    fetchNotifications()
  }
}

function handleGlobalClick(e: MouseEvent) {
  if (!notificationPopoverVisible.value) return
  const target = e.target as HTMLElement
  if (target.closest('.el-popover') || target.closest('.n-header__action')) return
  notificationPopoverVisible.value = false
}

onMounted(() => {
  document.addEventListener('click', handleGlobalClick)
})
onUnmounted(() => {
  document.removeEventListener('click', handleGlobalClick)
})

function getTimeAgo(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin}分钟前`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}小时前`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 30) return `${diffDay}天前`
  return dateStr.substring(0, 10)
}

function getRefRoute(item: NotificationItem): string {
  const typeRouteMap: Record<string, string> = {
    CONTRACT: `/contract/${item.refId}`,
    PROJECT: `/project/${item.refId}`,
    PROJECT_REGISTER: `/project/${item.refId}`,
    // 材料归档相关通知（归档员待办 / 销售/PM/部门经理知情抄送）都跳归档详情页
    MATERIAL_ARCHIVE: `/archive/${item.refId}`,
  }
  return typeRouteMap[item.refType] || '/dashboard'
}

function handleNotificationClick(item: NotificationItem) {
  if (!item.readFlag) {
    handleMarkRead(item.id)
  }
  notificationPopoverVisible.value = false
  router.push(getRefRoute(item))
}

function handleMarkAllReadClick() {
  handleMarkAllRead()
}

onMounted(() => {
  fetchUnreadCount()
  connect()
})

onUnmounted(() => {
  disconnect()
})
</script>

<template>
  <el-container class="n-layout">
    <!-- ── Sidebar ───────────────────────────────────────────────────── -->
    <el-aside
      :width="isCollapsed ? 'var(--n-sidebar-collapsed-width)' : 'var(--n-sidebar-width)'"
      class="n-sidebar"
    >
      <!-- Logo -->
      <div class="n-sidebar__logo">
        <img :src="logoWhiteUrl" alt="Nature" class="n-sidebar__logo-img" :style="{ width: isCollapsed ? '28px' : '32px', height: 'auto' }" />
        <transition name="n-fade">
          <span v-if="!isCollapsed" class="n-sidebar__logo-text">Nature</span>
        </transition>
      </div>

      <!-- Navigation -->
      <el-scrollbar class="n-sidebar__nav">
        <el-menu
          :collapse="isCollapsed"
          :default-active="route.path"
          :collapse-transition="false"
          router
        >
          <!-- Dashboard -->
          <el-menu-item index="/dashboard" @click="navigateTo('/dashboard')">
            <el-icon><HomeFilled /></el-icon>
            <template #title>待办中心</template>
          </el-menu-item>

          <!-- Business -->
          <el-sub-menu v-if="hasAnyPermission(['customer:list','partner:list','contract:list','project:list','police:operate'])" index="business">
            <template #title>
              <el-icon><Briefcase /></el-icon>
              <span>业务流程</span>
            </template>
            <el-menu-item v-if="hasPermission('customer:list')" index="/customer" @click="navigateTo('/customer')">
              <el-icon><User /></el-icon>
              <template #title>客户管理</template>
            </el-menu-item>
            <el-menu-item v-if="hasPermission('partner:list')" index="/system/partners" @click="navigateTo('/system/partners')">
              <el-icon><OfficeBuilding /></el-icon>
              <template #title>合作方管理</template>
            </el-menu-item>
            <el-menu-item v-if="hasPermission('contract:list')" index="/contract" @click="navigateTo('/contract')">
              <el-icon><Document /></el-icon>
              <template #title>合同管理</template>
            </el-menu-item>
            <el-menu-item v-if="hasPermission('project:list')" index="/project" @click="navigateTo('/project')">
              <el-icon><Folder /></el-icon>
              <template #title>项目登记</template>
            </el-menu-item>
            <el-menu-item v-if="hasPermission('police:operate')" index="/police" @click="navigateTo('/police')">
              <el-icon><OfficeBuilding /></el-icon>
              <template #title>公安登记</template>
            </el-menu-item>
          </el-sub-menu>

          <!-- Assessment -->
          <el-sub-menu v-if="hasPermission('assessment:view')" index="assessment-group">
            <template #title>
              <el-icon><Monitor /></el-icon>
              <span>现场测评</span>
            </template>
            <el-menu-item index="/assessment" @click="navigateTo('/assessment')">
              <template #title>测评实施</template>
            </el-menu-item>
          </el-sub-menu>

          <!-- Platform -->
          <el-menu-item v-if="hasPermission('platform:list')" index="/platform" @click="navigateTo('/platform')">
            <el-icon><Monitor /></el-icon>
            <template #title>注册平台管理</template>
          </el-menu-item>

          <!-- Report -->
          <el-sub-menu v-if="hasAnyPermission(['report:view','report:assign','report:compile','report:review'])" index="report-group">
            <template #title>
              <el-icon><Document /></el-icon>
              <span>报告管理</span>
            </template>
            <el-menu-item index="/report" @click="navigateTo('/report')">
              <template #title>报告列表</template>
            </el-menu-item>
          </el-sub-menu>

          <!-- Archive -->
          <el-menu-item v-if="hasAnyPermission(['archive:list','archive:submit'])" index="/archive" @click="navigateTo('/archive')">
            <el-icon><FolderChecked /></el-icon>
            <template #title>材料归档</template>
          </el-menu-item>

          <!-- Finance -->
          <el-sub-menu v-if="hasAnyPermission(['contract:update_financial','invoice:apply','expense:request','settlement:view'])" index="finance">
            <template #title>
              <el-icon><Coin /></el-icon>
              <span>财务管理</span>
            </template>
            <el-menu-item v-if="hasPermission('contract:update_financial')" index="/finance/contract" @click="navigateTo('/finance/contract')">
              <el-icon><Document /></el-icon>
              <template #title>合同财务</template>
            </el-menu-item>
            <el-menu-item v-if="hasPermission('invoice:apply')" index="/finance/invoice" @click="navigateTo('/finance/invoice')">
              <el-icon><Tickets /></el-icon>
              <template #title>开票申请</template>
            </el-menu-item>
            <el-menu-item v-if="hasPermission('expense:request')" index="/finance/expense" @click="navigateTo('/finance/expense')">
              <el-icon><Money /></el-icon>
              <template #title>费用请款</template>
            </el-menu-item>
            <el-menu-item v-if="hasPermission('settlement:view')" index="/finance/settlement" @click="navigateTo('/finance/settlement')">
              <el-icon><TrendCharts /></el-icon>
              <template #title>结算管理</template>
            </el-menu-item>
          </el-sub-menu>

          <!-- System -->
          <el-sub-menu v-if="hasAnyPermission(['user:manage','role:manage','recycle:manage'])" index="system">
            <template #title>
              <el-icon><Setting /></el-icon>
              <span>系统管理</span>
            </template>
            <el-menu-item v-if="hasPermission('user:manage')" index="/system/users" @click="navigateTo('/system/users')">
              <el-icon><UserFilled /></el-icon>
              <template #title>用户管理</template>
            </el-menu-item>
            <el-menu-item v-if="hasPermission('role:manage')" index="/system/roles" @click="navigateTo('/system/roles')">
              <el-icon><Key /></el-icon>
              <template #title>角色管理</template>
            </el-menu-item>
            <el-menu-item v-if="hasPermission('recycle:manage')" index="/system/recycle" @click="navigateTo('/system/recycle')">
              <el-icon><Delete /></el-icon>
              <template #title>回收站</template>
            </el-menu-item>
          </el-sub-menu>

          <!-- 个人中心 -->
          <el-menu-item index="/profile" @click="navigateTo('/profile')">
            <el-icon><UserFilled /></el-icon>
            <template #title>个人中心</template>
          </el-menu-item>
        </el-menu>
      </el-scrollbar>

      <!-- Collapse Toggle -->
      <div class="n-sidebar__footer" @click="toggleSidebar">
        <el-icon :size="16">
          <Fold v-if="!isCollapsed" />
          <Expand v-else />
        </el-icon>
        <transition name="n-fade">
          <span v-if="!isCollapsed" style="font-size: 12px">收起菜单</span>
        </transition>
      </div>
    </el-aside>

    <!-- ── Main Area ─────────────────────────────────────────────────── -->
    <el-container class="n-main-container">
      <!-- Header -->
      <el-header class="n-header">
        <div class="n-header__left">
          <!-- Breadcrumb-like page indicator could go here -->
        </div>

        <div class="n-header__right">
          <!-- Notifications -->
          <el-popover
            :visible="notificationPopoverVisible"
            placement="bottom-end"
            :width="440"
            trigger="click"
            :show-arrow="false"
          >
            <template #reference>
              <div class="n-header__action" :class="{ 'n-bell--active': unreadCount > 0 }" @click="handleBellClick">
                <el-badge :value="unreadCount" :hidden="unreadCount === 0" :max="99">
                  <el-icon :size="18"><Bell /></el-icon>
                </el-badge>
              </div>
            </template>

            <div class="n-notification-panel">
              <div class="n-notification-panel__header">
                <span class="n-notification-panel__title">通知</span>
                <el-button
                  v-if="unreadCount > 0"
                  type="primary"
                  link
                  size="small"
                  @click="handleMarkAllReadClick"
                >
                  全部已读
                </el-button>
              </div>

              <el-scrollbar max-height="360px">
                <div v-if="notifications.length === 0" class="n-notification-panel__empty">
                  暂无通知
                </div>
                <div
                  v-for="item in notifications"
                  :key="item.id"
                  class="n-notification-item"
                  :class="{ 'n-notification-item--unread': !item.readFlag }"
                  @click="handleNotificationClick(item)"
                >
                  <span v-if="!item.readFlag" class="n-notification-item__dot" />
                  <div class="n-notification-item__content">
                    <div class="n-notification-item__title">{{ item.title }}</div>
                    <div class="n-notification-item__desc">{{ item.content }}</div>
                    <div class="n-notification-item__time">{{ getTimeAgo(item.createdAt) }}</div>
                  </div>
                </div>
              </el-scrollbar>
            </div>
          </el-popover>

          <!-- User -->
          <div class="n-header__user">
            <div class="n-header__avatar">
              {{ (authStore.user?.displayName ?? 'U').charAt(0) }}
            </div>
            <span class="n-header__username">
              {{ authStore.user?.displayName ?? authStore.user?.username ?? '' }}
            </span>
          </div>

          <div class="n-header__action" @click="navigateTo('/profile')" title="个人中心" style="cursor: pointer">
            <el-icon :size="16"><Setting /></el-icon>
          </div>

          <div class="n-header__divider" />

          <div class="n-header__action n-header__action--logout" @click="handleLogout">
            <el-icon :size="16"><SwitchButton /></el-icon>
          </div>
        </div>
      </el-header>

      <!-- Content -->
      <el-main class="n-content">
        <el-watermark
          :content="watermarkContent"
          :font="{ fontSize: 14, color: 'rgba(0, 0, 0, 0.06)' }"
          :gap="[180, 180]"
          :rotate="-22"
          :z-index="9"
        >
          <router-view v-slot="{ Component }">
            <transition name="n-slide-up" mode="out-in">
              <component :is="Component" />
            </transition>
          </router-view>
        </el-watermark>
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
/* ── Layout Shell ───────────────────────────────────────────────────── */

.n-layout {
  height: 100vh;
  overflow: hidden;
}

/* ── Sidebar ────────────────────────────────────────────────────────── */

.n-sidebar {
  background: var(--n-sidebar-bg);
  background-image: linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 40%);
  display: flex;
  flex-direction: column;
  transition: width var(--n-transition-slow);
  overflow: hidden;
  z-index: var(--n-z-sidebar);
  border-right: 1px solid rgba(255, 255, 255, 0.03);
}

.n-sidebar__logo {
  height: var(--n-header-height);
  display: flex;
  align-items: center;
  gap: var(--n-space-3);
  padding: 0 var(--n-space-5);
  border-bottom: 1px solid var(--n-sidebar-border);
  flex-shrink: 0;
}

.n-sidebar__logo-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--n-sidebar-text-active);
  flex-shrink: 0;
  background: linear-gradient(135deg, rgba(184,134,78,0.12), rgba(184,134,78,0.04));
  border-radius: 8px;
  border: 1px solid rgba(184,134,78,0.08);
}

.n-sidebar__logo-text {
  font-family: var(--n-font-display);
  font-size: var(--n-font-size-lg);
  font-weight: var(--n-font-weight-bold);
  color: rgba(255, 255, 255, 0.88);
  letter-spacing: 0.03em;
  white-space: nowrap;
}

.n-sidebar__nav {
  flex: 1;
  overflow: hidden;
}

.n-sidebar__nav :deep(.el-menu) {
  border-right: none;
  padding: var(--n-space-2) var(--n-space-2);
}

.n-sidebar__nav :deep(.el-menu-item),
.n-sidebar__nav :deep(.el-sub-menu__title) {
  height: 40px;
  line-height: 40px;
  border-radius: var(--n-radius-md);
  margin-bottom: 2px;
  font-size: var(--n-font-size-base);
}

.n-sidebar__nav :deep(.el-menu-item) {
  position: relative;
}

.n-sidebar__footer {
  height: 44px;
  display: flex;
  align-items: center;
  gap: var(--n-space-2);
  padding: 0 var(--n-space-5);
  color: var(--n-sidebar-text);
  cursor: pointer;
  border-top: 1px solid var(--n-sidebar-border);
  flex-shrink: 0;
  transition: color var(--n-transition-fast);
}

.n-sidebar__footer:hover {
  color: var(--n-sidebar-text-hover);
}

/* ── Main Container ─────────────────────────────────────────────────── */

.n-main-container {
  flex-direction: column;
  overflow: hidden;
}

/* ── Header ─────────────────────────────────────────────────────────── */

.n-header {
  height: var(--n-header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--n-space-6);
  background: var(--n-header-bg);
  border-bottom: 1px solid var(--n-header-border);
  z-index: var(--n-z-header);
  flex-shrink: 0;
}

.n-header__right {
  display: flex;
  align-items: center;
  gap: var(--n-space-3);
}

.n-header__action {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--n-radius-md);
  cursor: pointer;
  color: var(--n-text-secondary);
  transition: all var(--n-transition-fast);
}

.n-header__action:hover {
  background: #f1f5f9;
  color: var(--n-text-primary);
}

.n-bell--active {
  animation: bell-pulse 2s ease-in-out infinite;
}
.n-bell--active .el-icon {
  color: var(--el-color-primary);
}
@keyframes bell-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.15); filter: drop-shadow(0 0 6px rgba(64, 158, 255, 0.5)); }
}

.n-header__action--logout:hover {
  background: #fee2e2;
  color: var(--n-danger);
}

.n-header__user {
  display: flex;
  align-items: center;
  gap: var(--n-space-2);
}

.n-header__avatar {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--n-primary), var(--n-primary-light));
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--n-font-display);
  font-size: var(--n-font-size-sm);
  font-weight: var(--n-font-weight-bold);
}

.n-header__username {
  font-size: var(--n-font-size-base);
  font-weight: var(--n-font-weight-medium);
  color: var(--n-text-primary);
}

.n-header__divider {
  width: 1px;
  height: 20px;
  background: var(--n-header-border);
}

/* ── Content ────────────────────────────────────────────────────────── */

.n-content {
  background: var(--n-page-bg);
  overflow-y: auto;
  padding: var(--n-space-5);
}

/* ── Notification Panel ─────────────────────────────────────────────── */

.n-notification-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: var(--n-space-3);
  border-bottom: 1px solid #f1f5f9;
  margin-bottom: var(--n-space-2);
}

.n-notification-panel__title {
  font-weight: var(--n-font-weight-semibold);
  font-size: var(--n-font-size-md);
  color: var(--n-text-primary);
}

.n-notification-panel__empty {
  text-align: center;
  padding: var(--n-space-10) 0;
  color: var(--n-text-tertiary);
  font-size: var(--n-font-size-base);
}

.n-notification-item {
  display: flex;
  gap: var(--n-space-2);
  padding: var(--n-space-3);
  border-radius: var(--n-radius-md);
  cursor: pointer;
  transition: background var(--n-transition-fast);
}

.n-notification-item:hover {
  background: #f8fafc;
}

.n-notification-item--unread {
  background: #f0fdfa;
}

.n-notification-item--unread:hover {
  background: #e6fffa;
}

.n-notification-item__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--n-primary);
  flex-shrink: 0;
  margin-top: 6px;
}

.n-notification-item__content {
  flex: 1;
  min-width: 0;
}

.n-notification-item__title {
  font-size: var(--n-font-size-base);
  font-weight: var(--n-font-weight-medium);
  color: var(--n-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.n-notification-item__desc {
  font-size: var(--n-font-size-sm);
  color: var(--n-text-tertiary);
  margin-top: 2px;
  /* 允许最多 3 行展示，超出再省略 */
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.5;
  word-break: break-all;
}

.n-notification-item__time {
  font-size: var(--n-font-size-xs);
  color: var(--n-text-disabled);
  margin-top: 4px;
}
</style>
