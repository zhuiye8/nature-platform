<!--
@input Auth store session state, active route metadata, shell layout components, and Element Plus zh-CN locale object
@output Application shell that conditionally renders login-only view or sidebar/topbar workspace frame with global Chinese locale provider
@position Root Vue component that orchestrates global navigation shell, locale policy, and routed page transitions
@doc-sync Update this header and folder INDEX.md when this file changes.
-->
<template>
  <el-config-provider :locale="zhCn">
    <div class="app-shell" :class="{ 'with-frame': showFrame, 'sidebar-collapsed': sidebarCollapsed }">
      <template v-if="showFrame">
        <aside class="app-nav app-sidebar">
          <AppSidebar :active-path="activeMenu" :collapsed="sidebarCollapsed" @select="onSelect" />
        </aside>

        <div class="app-workspace">
          <AppTopbar
            :title="currentTitle"
            :display-name="authStore.displayName || authStore.username || ''"
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

        <el-dialog
          :model-value="mustChangePasswordVisible"
          title="首次登录请设置密码"
          width="460px"
          :show-close="false"
          :close-on-click-modal="false"
          :close-on-press-escape="false"
        >
          <el-form label-width="90px" class="password-form">
            <el-form-item label="新密码" required>
              <el-input
                v-model="passwordForm.newPassword"
                type="password"
                show-password
                placeholder="请设置 6-64 位密码"
                maxlength="64"
              />
            </el-form-item>
            <el-form-item label="确认密码" required>
              <el-input
                v-model="passwordForm.confirmPassword"
                type="password"
                show-password
                placeholder="请再次输入密码"
                maxlength="64"
                @keyup.enter="submitPasswordChange"
              />
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="logout">退出登录</el-button>
            <el-button type="primary" :loading="passwordSubmitting" @click="submitPasswordChange">
              确认设置
            </el-button>
          </template>
        </el-dialog>
      </template>

      <router-view v-else />
    </div>
  </el-config-provider>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { useRoute, useRouter } from "vue-router";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import { useAuthStore } from "./auth-store";
import { resolveNavItem } from "./navigation";
import { changePassword } from "./auth-service";
import AppSidebar from "./components/layout/AppSidebar.vue";
import AppTopbar from "./components/layout/AppTopbar.vue";
import PageContainer from "./components/layout/PageContainer.vue";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const sidebarCollapsed = ref(false);
const mobileMenuVisible = ref(false);
const passwordSubmitting = ref(false);
const passwordForm = reactive({
  newPassword: "",
  confirmPassword: ""
});

const showFrame = computed(() => route.path !== "/login" && !!authStore.token);
const mustChangePasswordVisible = computed(
  () => showFrame.value && Boolean(authStore.mustChangePassword)
);

const activeMenu = computed(() => resolveNavItem(route.path)?.path || "/dashboard");

const currentTitle = computed(() => {
  return resolveNavItem(route.path)?.label || (route.meta.title as string) || "工作台";
});

function onSelect(path: string) {
  mobileMenuVisible.value = false;
  void router.push(path);
}

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value;
}

function logout() {
  authStore.clearSession();
  passwordForm.newPassword = "";
  passwordForm.confirmPassword = "";
  mobileMenuVisible.value = false;
  void router.push("/login");
}

function readErrorMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof message === "string" && message.trim().length ? message : fallback;
}

async function submitPasswordChange() {
  if (!authStore.token || !authStore.username) {
    return;
  }
  if (!passwordForm.newPassword || passwordForm.newPassword.length < 6) {
    ElMessage.warning("新密码长度至少 6 位");
    return;
  }
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    ElMessage.warning("两次输入的密码不一致");
    return;
  }

  passwordSubmitting.value = true;
  try {
    const profile = await changePassword(passwordForm.newPassword);
    authStore.setSession(
      authStore.token,
      profile.username || authStore.username,
      profile.displayName || profile.username || authStore.displayName || authStore.username,
      profile.roles || authStore.roles,
      profile.resources || profile.permissions || authStore.resources,
      profile.menuTree || authStore.menuTree,
      false
    );
    passwordForm.newPassword = "";
    passwordForm.confirmPassword = "";
    ElMessage.success("密码设置成功");
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "密码设置失败"));
  } finally {
    passwordSubmitting.value = false;
  }
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
  background: linear-gradient(180deg, #f8fcfc, #f3f7f8);
}

.app-sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  z-index: 30;
  border-right: 1px solid rgba(255, 255, 255, 0.15);
  background:
    radial-gradient(700px 560px at -5% -12%, rgba(102, 188, 164, 0.3), transparent 64%),
    linear-gradient(180deg, #1c3648 0%, #182c3c 100%);
}

.app-workspace {
  position: relative;
  min-width: 0;
  background: linear-gradient(180deg, rgba(250, 253, 254, 0.94), rgba(243, 247, 248, 0.98));
}

.app-workspace::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(880px 540px at 95% -18%, rgba(45, 184, 146, 0.1), transparent 72%),
    radial-gradient(840px 520px at -8% 9%, rgba(47, 110, 162, 0.08), transparent 72%);
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

