<template>
  <div class="page-shell dashboard-page section-stack">
    <header class="page-header">
      <div class="page-title-group">
        <h2 class="page-title">仪表盘</h2>
        <p class="page-subtitle">快速进入核心流程节点，关注通知和待处理事项。</p>
      </div>
      <el-space>
        <el-tag type="warning" size="large">未读 {{ unreadCount }}</el-tag>
        <el-button :loading="refreshing" @click="handleRefresh">刷新</el-button>
        <el-button :loading="refreshing" @click="handleMarkAllRead">全部已读</el-button>
      </el-space>
    </header>

    <section class="stats-grid">
      <el-card class="stat-card stat-card-a" shadow="hover">
        <p class="stat-label">未读通知</p>
        <strong class="stat-value">{{ unreadCount }}</strong>
        <span class="stat-desc">实时联动通知中心计数</span>
      </el-card>
      <el-card class="stat-card stat-card-b" shadow="hover">
        <p class="stat-label">最近通知</p>
        <strong class="stat-value">{{ notifications.length }}</strong>
        <span class="stat-desc">默认展示最近 20 条</span>
      </el-card>
      <el-card class="stat-card stat-card-c" shadow="hover">
        <p class="stat-label">快捷入口</p>
        <strong class="stat-value">{{ quickEntries.length }}</strong>
        <span class="stat-desc">覆盖核心业务路径</span>
      </el-card>
    </section>

    <el-row :gutter="12" class="entry-row">
      <el-col v-for="item in quickEntries" :key="item.path" :xs="24" :sm="12" :md="6">
        <el-card class="entry-card" shadow="hover" @click="go(item.path)">
          <div class="entry-head">
            <h3>{{ item.title }}</h3>
            <el-tag size="small" effect="plain">{{ item.tag }}</el-tag>
          </div>
          <p>{{ item.desc }}</p>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="notice-card">
      <template #header>
        <div class="notice-title">最近通知</div>
      </template>

      <el-empty v-if="notifications.length === 0" description="暂无通知" />
      <el-timeline v-else>
        <el-timeline-item
          v-for="item in notifications"
          :key="item.id"
          :timestamp="formatShanghaiDateTime(item.createdAt)"
          :type="item.read ? 'info' : 'primary'"
        >
          <div class="item-title">
            <span>{{ item.title }}</span>
            <el-tag v-if="!item.read" size="small" type="danger">未读</el-tag>
          </div>
          <div class="item-content">{{ item.content }}</div>
          <el-space>
            <el-button v-if="!item.read" size="small" type="primary" link @click="handleMarkRead(item.id)">
              标记已读
            </el-button>
            <el-button size="small" type="danger" link @click="handleDelete(item.id)">删除</el-button>
          </el-space>
        </el-timeline-item>
      </el-timeline>
    </el-card>
  </div>
</template>

<script setup lang="ts">
/**
 * @input Notification APIs, router navigation helpers, and time-format utility for dashboard orchestration
 * @output Dashboard widgets for unread counters, quick entries, and recent notifications with read/delete actions
 * @position Landing workspace page that surfaces system health signals and high-frequency operation shortcuts
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { useRouter } from "vue-router";
import {
  deleteNotification,
  fetchNotifications,
  fetchUnreadCount,
  markAllAsRead,
  markAsRead,
  type NotificationRecord
} from "./notification-service";
import { formatShanghaiDateTime } from "./time";

interface QuickEntry {
  path: string;
  title: string;
  tag: string;
  desc: string;
}

const quickEntries: QuickEntry[] = [
  { path: "/customers", title: "客户管理", tag: "基础", desc: "维护客户基础信息与联系人。" },
  {
    path: "/contract-submissions",
    title: "合同提审",
    tag: "主流程",
    desc: "创建合同、编辑草稿并提交审核。"
  },
  {
    path: "/contract-archives",
    title: "合同归档",
    tag: "主流程",
    desc: "对审核通过合同补录归档信息并完成归档。"
  },
  { path: "/project-registers", title: "项目登记", tag: "节点 5", desc: "基于已归档合同发起项目登记。" },
  { path: "/workflow", title: "待办审批", tag: "任务", desc: "集中处理合同、项目与报告审核任务。" }
];

const router = useRouter();
const unreadCount = ref(0);
const notifications = ref<NotificationRecord[]>([]);
const refreshing = ref(false);

function readErrorMessage(error: unknown, fallback: string) {
  const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof msg === "string" && msg.trim() ? msg : fallback;
}

async function refresh() {
  const [count, list] = await Promise.all([fetchUnreadCount(), fetchNotifications(20)]);
  unreadCount.value = count;
  notifications.value = list;
}

function go(path: string) {
  void router.push(path);
}

async function handleRefresh() {
  refreshing.value = true;
  try {
    await refresh();
    ElMessage.success("仪表盘已刷新");
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "刷新失败"));
  } finally {
    refreshing.value = false;
  }
}

async function handleMarkRead(id: number) {
  try {
    await markAsRead(id);
    await refresh();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "标记已读失败"));
  }
}

async function handleMarkAllRead() {
  try {
    await markAllAsRead();
    await refresh();
    ElMessage.success("已全部标记为已读");
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "全部已读失败"));
  }
}

async function handleDelete(id: number) {
  try {
    await deleteNotification(id);
    await refresh();
    ElMessage.success("通知已删除");
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "删除通知失败"));
  }
}

onMounted(async () => {
  refreshing.value = true;
  try {
    await refresh();
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "通知加载失败"));
  } finally {
    refreshing.value = false;
  }
});
</script>

<style scoped>
.dashboard-page {
  padding-top: 24px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.stat-card {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.8);
}

.stat-card::after {
  content: "";
  position: absolute;
  right: -30px;
  bottom: -36px;
  width: 118px;
  height: 118px;
  border-radius: 50%;
  opacity: 0.38;
}

.stat-card-a {
  background: linear-gradient(130deg, #f9fcfd, #ecf7f4);
}

.stat-card-a::after {
  background: radial-gradient(circle, rgba(45, 184, 146, 0.3), transparent 72%);
}

.stat-card-b {
  background: linear-gradient(130deg, #fbfdff, #eef4fa);
}

.stat-card-b::after {
  background: radial-gradient(circle, rgba(47, 110, 162, 0.25), transparent 72%);
}

.stat-card-c {
  background: linear-gradient(130deg, #fffcf8, #f8f1e7);
}

.stat-card-c::after {
  background: radial-gradient(circle, rgba(201, 136, 34, 0.26), transparent 72%);
}

.stat-label {
  margin: 0;
  color: var(--np-color-text-muted);
  font-size: 13px;
}

.stat-value {
  display: block;
  margin-top: 11px;
  font-size: 34px;
  line-height: 1;
  color: var(--np-color-ink-900);
}

.stat-desc {
  margin-top: 8px;
  display: block;
  color: var(--np-color-text-secondary);
  font-size: 13px;
}

.entry-row {
  margin-bottom: 2px;
}

.entry-card {
  cursor: pointer;
  min-height: 126px;
  border: 1px solid rgba(210, 224, 229, 0.86);
  background: linear-gradient(180deg, #ffffff, #f9fcfc);
  transition: transform var(--np-trans-base) ease;
}

.entry-card:hover {
  transform: translateY(-3px);
}

.entry-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.entry-head h3 {
  margin: 0;
  font-size: 16px;
}

.entry-card p {
  margin: 10px 0 0;
  color: var(--np-color-text-secondary);
  line-height: 1.6;
}

.notice-title {
  font-weight: 700;
  letter-spacing: 0.2px;
}

.item-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.item-content {
  color: var(--np-color-text-secondary);
  margin-bottom: 4px;
}

@media (max-width: 900px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>