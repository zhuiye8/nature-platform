<!--
@input Current route title, authenticated username, and shell toolbar events
@output Sticky top toolbar with breadcrumb context and session action controls
@position Main workspace header for desktop/mobile shell operations
@doc-sync Update this header and folder INDEX.md when this file changes.
-->
<template>
  <div class="topbar-wrap">
    <div class="topbar-left">
      <el-button class="btn-desktop" text circle :icon="Fold" @click="$emit('toggleSidebar')" />
      <el-button class="btn-mobile" text circle :icon="Menu" @click="$emit('openMobileMenu')" />
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>工作台</el-breadcrumb-item>
        <el-breadcrumb-item>{{ title }}</el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div class="topbar-right">
      <el-tag type="info" effect="light">{{ username || "当前用户" }}</el-tag>
      <el-button type="danger" plain @click="$emit('logout')">退出登录</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Fold, Menu } from "@element-plus/icons-vue";

defineProps<{
  title: string;
  username: string;
}>();

defineEmits<{
  toggleSidebar: [];
  openMobileMenu: [];
  logout: [];
}>();
</script>

<style scoped>
.topbar-wrap {
  height: var(--np-topbar-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 18px;
  border-bottom: 1px solid var(--np-color-border);
  background: rgba(248, 251, 255, 0.92);
  backdrop-filter: blur(10px);
}

.topbar-left,
.topbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-mobile {
  display: none;
}

@media (max-width: 1024px) {
  .btn-desktop {
    display: none;
  }

  .btn-mobile {
    display: inline-flex;
  }
}

@media (max-width: 640px) {
  .topbar-wrap {
    padding: 0 12px;
  }

  .topbar-right :deep(.el-tag) {
    display: none;
  }
}
</style>
