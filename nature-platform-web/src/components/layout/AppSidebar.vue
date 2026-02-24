<!--
@input grouped navigation metadata and selected route state from app shell
@output Collapsible grouped sidebar menu with brand entry and route selection events
@position Left navigation rail for desktop shell and drawer navigation for mobile shell
@doc-sync Update this header and folder INDEX.md when this file changes.
-->
<template>
  <div class="sidebar-wrap">
    <div class="sidebar-brand" @click="handleSelect('/dashboard')">
      <div class="brand-mark">N</div>
      <div v-if="!collapsed" class="brand-text-wrap">
        <div class="brand">Nature 平台</div>
        <div class="brand-sub">等保流程控制台</div>
      </div>
    </div>

    <el-scrollbar class="sidebar-scroll">
      <div v-for="group in groups" :key="group" class="nav-group">
        <p v-if="!collapsed" class="group-title">{{ group }}</p>
        <el-menu
          :default-active="activePath"
          class="sidebar-menu"
          :collapse="collapsed"
          :collapse-transition="false"
          @select="handleSelect"
        >
          <el-menu-item
            v-for="item in grouped[group]"
            :key="item.path"
            :index="item.path"
          >
            <el-icon>
              <component :is="item.icon" />
            </el-icon>
            <template #title>{{ item.label }}</template>
          </el-menu-item>
        </el-menu>
      </div>
    </el-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { groupedNavItems, navGroups } from "../../navigation";

const props = defineProps<{
  activePath: string;
  collapsed: boolean;
}>();

const emit = defineEmits<{
  select: [path: string];
}>();

const groups = navGroups;
const grouped = groupedNavItems;

function handleSelect(path: string) {
  emit("select", path);
}

const collapsed = computed(() => props.collapsed);
</script>

<style scoped>
.sidebar-wrap {
  height: 100%;
  display: grid;
  grid-template-rows: auto 1fr;
}

.sidebar-brand {
  min-height: 70px;
  padding: 14px 14px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.brand-mark {
  width: 34px;
  height: 34px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  font-weight: 700;
  color: #eaf1ff;
  background: linear-gradient(140deg, rgba(110, 158, 255, 0.95), rgba(40, 98, 206, 0.9));
}

.brand-text-wrap {
  min-width: 0;
}

.brand {
  font-size: 15px;
  font-weight: 700;
  color: #f2f6ff;
  letter-spacing: 0.2px;
}

.brand-sub {
  margin-top: 2px;
  font-size: 12px;
  color: rgba(233, 241, 255, 0.72);
}

.sidebar-scroll {
  min-height: 0;
}

.nav-group {
  padding: 10px 10px 6px;
}

.group-title {
  margin: 0 0 8px;
  padding: 0 10px;
  font-size: 12px;
  color: rgba(220, 231, 252, 0.72);
}

.sidebar-menu {
  border-right: none;
  background: transparent;
}

:deep(.sidebar-menu .el-menu-item) {
  height: 38px;
  margin: 4px 0;
  border-radius: 10px;
  color: rgba(234, 242, 255, 0.84);
}

:deep(.sidebar-menu .el-menu-item:hover) {
  color: #fff;
  background: rgba(111, 149, 255, 0.2);
}

:deep(.sidebar-menu .el-menu-item.is-active) {
  color: #fff;
  background: linear-gradient(90deg, rgba(95, 149, 255, 0.34), rgba(52, 113, 228, 0.45));
}

:deep(.sidebar-menu .el-menu-item .el-icon) {
  margin-right: 8px;
}
</style>
