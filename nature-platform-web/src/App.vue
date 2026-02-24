<!--
@input Auth store session state, active route metadata, and shell layout components
@output Application shell that conditionally renders login-only view or sidebar/topbar workspace frame
@position Root Vue component that orchestrates global navigation shell and routed page transitions
@doc-sync Update this header and folder INDEX.md when this file changes.
-->
<template>
  <div class="app-shell" :class="{ 'with-frame': showFrame, 'sidebar-collapsed': sidebarCollapsed }">
    <template v-if="showFrame">
      <aside class="app-nav app-sidebar">
        <AppSidebar :active-path="activeMenu" :collapsed="sidebarCollapsed" @select="onSelect" />
      </aside>

      <div class="app-workspace">
        <AppTopbar
          :title="currentTitle"
          :username="authStore.username || ''"
          @toggle-sidebar="toggleSidebar"
          @open-mobile-menu="mobileMenuVisible = true"
          @logout="logout"
        />

        <PageContainer>
          <router-view v-slot="{ Component, route: currentRoute }">
            <transition name="np-page" mode="out-in">
              <component :is="Component" :key="currentRoute.fullPath" />
            </transition>
          </router-view>
        </PageContainer>
      </div>

      <el-drawer v-model="mobileMenuVisible" title="导航" size="260px" class="mobile-drawer" append-to-body>
        <AppSidebar :active-path="activeMenu" :collapsed="false" @select="onSelect" />
      </el-drawer>
    </template>

    <router-view v-else />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "./auth-store";
import { resolveNavItem } from "./navigation";
import AppSidebar from "./components/layout/AppSidebar.vue";
import AppTopbar from "./components/layout/AppTopbar.vue";
import PageContainer from "./components/layout/PageContainer.vue";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const sidebarCollapsed = ref(false);
const mobileMenuVisible = ref(false);

const showFrame = computed(() => route.path !== "/login" && !!authStore.token);

const activeMenu = computed(() => resolveNavItem(route.path)?.path || "/dashboard");

const currentTitle = computed(() => resolveNavItem(route.path)?.label || "工作台");

function onSelect(path: string) {
  mobileMenuVisible.value = false;
  void router.push(path);
}

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value;
}

function logout() {
  authStore.clearSession();
  mobileMenuVisible.value = false;
  void router.push("/login");
}

watch(
  () => route.path,
  () => {
    mobileMenuVisible.value = false;
  }
);
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
}

.app-shell.with-frame {
  display: grid;
  grid-template-columns: var(--np-sidebar-width) 1fr;
}

.app-sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  z-index: 30;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  background:
    radial-gradient(800px 600px at -10% -20%, rgba(112, 161, 255, 0.25), transparent 65%),
    linear-gradient(180deg, #213354 0%, #1d2d49 100%);
}

.app-workspace {
  min-width: 0;
  background: linear-gradient(180deg, rgba(248, 251, 255, 0.9) 0%, rgba(243, 247, 255, 0.95) 100%);
}

.sidebar-collapsed.with-frame {
  grid-template-columns: var(--np-sidebar-width-collapsed) 1fr;
}

@media (max-width: 1024px) {
  .app-shell.with-frame {
    grid-template-columns: 1fr;
  }

  .app-sidebar {
    display: none;
  }
}
</style>
