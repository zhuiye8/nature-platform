<!--
@input Auth API adapters, router navigation, and auth store session mutators
@output Username/password and DingTalk login actions with session bootstrap and post-login redirect
@position Public entry page that gates access into the protected application shell
@doc-sync Update this header and folder INDEX.md when this file changes.
-->
<template>
  <div class="login-page">
    <div class="login-layout">
      <section class="login-intro">
        <div class="intro-badge">Nature Platform</div>
        <h1>等保流程统一工作台</h1>
        <p>统一管理客户、合同、项目登记、审核任务与通知中心，支持账号密码与钉钉登录。</p>
        <ul>
          <li>流程状态实时可见，节点推进清晰</li>
          <li>审核待办集中处理，反馈及时</li>
          <li>通知中心联动未读计数，处理闭环</li>
        </ul>
      </section>

      <el-card class="login-card" shadow="never">
        <div class="card-head">
          <h2>账号登录</h2>
          <span>请输入账号密码</span>
        </div>
        <el-form :model="form" @submit.prevent="handleLogin">
          <el-form-item label="用户名">
            <el-input
              v-model="form.username"
              placeholder="请输入用户名"
              autocomplete="username"
              @keyup.enter="handleLogin"
            />
          </el-form-item>
          <el-form-item label="密码">
            <el-input
              v-model="form.password"
              type="password"
              show-password
              placeholder="请输入密码"
              autocomplete="current-password"
              @keyup.enter="handleLogin"
            />
          </el-form-item>
          <el-form-item>
            <div class="action-row">
              <el-button type="primary" :loading="loading" @click="handleLogin">登录</el-button>
              <el-button :loading="loading" @click="handleDingTalk">钉钉登录</el-button>
            </div>
          </el-form-item>
        </el-form>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { useRouter } from "vue-router";
import { useAuthStore } from "./auth-store";
import { fetchCurrentUser, fetchDingTalkLoginUrl, login } from "./auth-service";

const router = useRouter();
const authStore = useAuthStore();

const loading = ref(false);
const form = reactive({
  username: "admin",
  password: "admin123"
});

async function handleLogin() {
  loading.value = true;
  try {
    const data = await login(form.username, form.password);
    authStore.setSession(data.token, data.username, []);
    try {
      const profile = await fetchCurrentUser();
      authStore.setRoles(profile.roles || []);
    } catch {
      authStore.setRoles([]);
    }
    if (data.mustChangePassword) {
      ElMessage.warning("首次登录请尽快修改默认密码。");
    } else {
      ElMessage.success("登录成功");
    }
    await router.push("/dashboard");
  } catch (error) {
    console.error(error);
    ElMessage.error("登录失败，请检查账号密码");
  } finally {
    loading.value = false;
  }
}

async function handleDingTalk() {
  try {
    const url = await fetchDingTalkLoginUrl();
    window.location.href = url;
  } catch (error) {
    console.error(error);
    ElMessage.error("钉钉登录链接获取失败");
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
}

.login-layout {
  width: min(1080px, 100%);
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 20px;
}

.login-intro {
  border-radius: var(--np-radius-lg);
  border: 1px solid rgba(31, 94, 210, 0.2);
  background: linear-gradient(155deg, rgba(31, 94, 210, 0.92), rgba(43, 128, 236, 0.88));
  color: #f8fbff;
  box-shadow: var(--np-shadow-md);
  padding: 30px;
}

.login-intro h1 {
  margin: 10px 0 12px;
  font-size: clamp(28px, 3vw, 36px);
  line-height: 1.2;
}

.login-intro p {
  margin: 0;
  color: rgba(248, 251, 255, 0.92);
}

.login-intro ul {
  margin: 18px 0 0;
  padding-left: 20px;
  display: grid;
  gap: 8px;
  color: rgba(248, 251, 255, 0.95);
}

.intro-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.34);
  background: rgba(255, 255, 255, 0.18);
  padding: 4px 10px;
  font-size: 12px;
}

.login-card {
  border-radius: var(--np-radius-lg);
  background: rgba(255, 255, 255, 0.94);
}

.card-head {
  margin-bottom: 10px;
}

.card-head h2 {
  margin: 0;
  font-size: 24px;
}

.card-head span {
  color: var(--np-color-text-muted);
  font-size: 13px;
}

.action-row {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

@media (max-width: 900px) {
  .login-layout {
    grid-template-columns: 1fr;
  }

  .login-intro {
    padding: 22px;
  }
}

@media (max-width: 480px) {
  .action-row {
    grid-template-columns: 1fr;
  }
}
</style>
