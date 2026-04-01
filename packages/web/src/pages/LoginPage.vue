<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const formRef = ref()
const loading = ref(false)

const form = reactive({ username: '', password: '' })
const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function handleLogin() {
  await formRef.value?.validate()
  loading.value = true
  try {
    await authStore.login(form.username, form.password)
    ElMessage.success('登录成功')
    const redirect = (route.query.redirect as string) || '/'
    router.push(redirect)
  } catch { /* handled by interceptor */ }
  finally { loading.value = false }
}
</script>

<template>
  <div class="lp">
    <!-- Ambient background -->
    <div class="lp-bg">
      <div class="lp-bg__noise" />
      <div class="lp-bg__orb lp-bg__orb--warm" />
      <div class="lp-bg__orb lp-bg__orb--cool" />
      <div class="lp-bg__grid" />
    </div>

    <!-- Card -->
    <div class="lp-card">
      <div class="lp-card__accent" />

      <div class="lp-brand">
        <div class="lp-brand__mark">N</div>
        <div class="lp-brand__text">
          <h1>Nature</h1>
          <p>等保测评管理平台</p>
        </div>
      </div>

      <el-form ref="formRef" :model="form" :rules="rules" size="large" @keyup.enter="handleLogin">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="用户名" :prefix-icon="User" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" placeholder="密码" show-password :prefix-icon="Lock" />
        </el-form-item>
        <el-form-item style="margin-bottom: 0">
          <el-button type="primary" :loading="loading" class="lp-submit" @click="handleLogin">
            登 录
          </el-button>
        </el-form-item>
      </el-form>

      <div class="lp-alt">
        <span class="lp-alt__line" />
        <span class="lp-alt__text">其他方式</span>
        <span class="lp-alt__line" />
      </div>

      <button class="lp-dingtalk" title="钉钉扫码登录（即将上线）">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>
        <span>钉钉登录</span>
      </button>
    </div>

    <footer class="lp-footer">Nature System · 2026</footer>
  </div>
</template>

<style scoped>
.lp {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--n-login-bg);
  position: relative;
  overflow: hidden;
}

/* ── Background ─────────────────────────────────────────────────────── */
.lp-bg { position: absolute; inset: 0; pointer-events: none; }

.lp-bg__noise {
  position: absolute; inset: 0;
  background: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
  background-size: 256px;
}

.lp-bg__grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
}

.lp-bg__orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(120px);
}

.lp-bg__orb--warm {
  width: 500px; height: 500px;
  background: rgba(184, 134, 78, 0.08);
  top: -150px; right: -100px;
  animation: float-warm 20s ease-in-out infinite;
}

.lp-bg__orb--cool {
  width: 350px; height: 350px;
  background: rgba(91, 106, 191, 0.06);
  bottom: -100px; left: -80px;
  animation: float-cool 25s ease-in-out infinite;
}

@keyframes float-warm {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(-30px, 20px); }
}
@keyframes float-cool {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(20px, -15px); }
}

/* ── Card ───────────────────────────────────────────────────────────── */
.lp-card {
  width: 380px;
  padding: 36px 32px 28px;
  background: var(--n-login-card-bg);
  border: 1px solid var(--n-login-card-border);
  border-radius: 16px;
  backdrop-filter: blur(24px) saturate(1.2);
  position: relative;
  z-index: 1;
  animation: card-in 0.7s var(--n-ease-out) both;
  overflow: hidden;
}

.lp-card__accent {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--n-primary-light), transparent);
  opacity: 0.6;
}

@keyframes card-in {
  from { opacity: 0; transform: translateY(16px) scale(0.98); }
  to { opacity: 1; transform: none; }
}

/* ── Brand ──────────────────────────────────────────────────────────── */
.lp-brand {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 32px;
}

.lp-brand__mark {
  width: 44px; height: 44px;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(184,134,78,0.15), rgba(184,134,78,0.05));
  border: 1px solid rgba(184,134,78,0.12);
  color: var(--n-primary-light);
  font-family: var(--n-font-display);
  font-size: 22px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lp-brand__text h1 {
  font-family: var(--n-font-display);
  font-size: 22px;
  font-weight: 700;
  color: rgba(255,255,255,0.92);
  margin: 0;
  letter-spacing: 0.03em;
}

.lp-brand__text p {
  font-size: 12px;
  color: rgba(255,255,255,0.3);
  margin: 3px 0 0;
  letter-spacing: 0.04em;
}

/* ── Form Skin ──────────────────────────────────────────────────────── */
.lp-card :deep(.el-input__wrapper) {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  box-shadow: none;
  border-radius: 8px;
}
.lp-card :deep(.el-input__wrapper:hover) { border-color: rgba(255,255,255,0.12); }
.lp-card :deep(.el-input__wrapper.is-focus) {
  border-color: var(--n-primary-light) !important;
  box-shadow: 0 0 0 3px rgba(184,134,78,0.12) !important;
}
.lp-card :deep(.el-input__inner) { color: rgba(255,255,255,0.88); }
.lp-card :deep(.el-input__inner::placeholder) { color: rgba(255,255,255,0.2); }
.lp-card :deep(.el-input__prefix .el-icon) { color: rgba(255,255,255,0.25); }
.lp-card :deep(.el-form-item__error) { color: #e57373; }

.lp-submit {
  width: 100%;
  height: 42px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.08em;
  border-radius: 8px;
}

/* ── Alt Login ──────────────────────────────────────────────────────── */
.lp-alt {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 22px 0 14px;
}

.lp-alt__line { flex: 1; height: 1px; background: rgba(255,255,255,0.05); }
.lp-alt__text { font-size: 11px; color: rgba(255,255,255,0.18); letter-spacing: 0.04em; }

.lp-dingtalk {
  width: 100%;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(255,255,255,0.025);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px;
  color: rgba(255,255,255,0.3);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--n-transition-fast);
  font-family: inherit;
}
.lp-dingtalk:hover {
  border-color: rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.5);
  background: rgba(255,255,255,0.04);
}

/* ── Footer ─────────────────────────────────────────────────────────── */
.lp-footer {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  color: rgba(255,255,255,0.1);
  letter-spacing: 0.05em;
}
</style>
