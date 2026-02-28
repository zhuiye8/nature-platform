<!--
@input Backend-driven menuTree session state and active route metadata from app shell
@output Collapsible grouped sidebar menu with resource-aware runtime navigation rendering
@position Left navigation rail for desktop shell and drawer navigation with backend resource-tree alignment
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
      <div v-for="group in runtimeGroups" :key="group.groupKey" class="nav-group">
        <p v-if="!collapsed" class="group-title">{{ group.groupLabel }}</p>
        <el-menu
          :default-active="activePath"
          class="sidebar-menu"
          :collapse="collapsed"
          :collapse-transition="false"
          @select="handleSelect"
        >
          <el-menu-item
            v-for="item in group.children"
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
import { buildRuntimeMenuGroups } from "../../navigation";
import { useAuthStore } from "../../auth-store";

const props = defineProps<{
  activePath: string;
  collapsed: boolean;
}>();

const emit = defineEmits<{
  select: [path: string];
}>();

const authStore = useAuthStore();

const runtimeGroups = computed(() =>
  buildRuntimeMenuGroups(authStore.menuTree)
    .map((group) => ({
      ...group,
      children: group.children.filter(
        (item) => !item.resourceKey || authStore.hasResource(item.resourceKey)
      )
    }))
    .filter((group) => group.children.length > 0)
);

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
  min-height: 74px;
  padding: 15px 14px 13px;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.brand-mark {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-weight: 700;
  color: #ecfffa;
  background: linear-gradient(140deg, rgba(56, 181, 146, 0.95), rgba(37, 127, 170, 0.92));
  box-shadow: 0 10px 22px rgba(9, 31, 45, 0.32);
}

.brand-text-wrap {
  min-width: 0;
}

.brand {
  font-size: 15px;
  font-weight: 700;
  color: #effaf9;
  letter-spacing: 0.2px;
}

.brand-sub {
  margin-top: 2px;
  font-size: 12px;
  color: rgba(216, 236, 246, 0.74);
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
  color: rgba(201, 226, 237, 0.72);
  letter-spacing: 0.28px;
}

.sidebar-menu {
  border-right: none;
  background: transparent;
}

:deep(.sidebar-menu .el-menu-item) {
  height: 39px;
  margin: 4px 0;
  border-radius: 12px;
  color: rgba(233, 246, 251, 0.84);
  font-weight: 500;
}

:deep(.sidebar-menu .el-menu-item:hover) {
  color: #fff;
  background: rgba(86, 173, 198, 0.2);
}

:deep(.sidebar-menu .el-menu-item.is-active) {
  color: #fff;
  box-shadow: inset 0 0 0 1px rgba(162, 229, 213, 0.28);
  background: linear-gradient(90deg, rgba(59, 171, 144, 0.35), rgba(43, 114, 169, 0.45));
}

:deep(.sidebar-menu .el-menu-item .el-icon) {
  margin-right: 8px;
}
</style>
