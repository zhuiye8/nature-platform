<!--
@input Auth API adapters, router navigation, and auth store session mutators
@output Username/password and DingTalk login actions with role/resource/menu session bootstrap and redirect
@position Public entry page that gates access into the protected application shell
@doc-sync Update this header and folder INDEX.md when this file changes.
-->
<template>
  <div class="login-page">
    <canvas ref="particleCanvas" class="particle-canvas"></canvas>
    <div class="cyber-grid"></div>

    <div class="orb-container" aria-hidden="true">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      <div class="orb orb-3"></div>
    </div>

    <div class="login-wrapper">
      <section class="brand-section">
        <div class="logo-wrapper" aria-hidden="true">
          <div class="logo-ring"></div>
          <div class="logo-ring ring-2"></div>
          <div class="logo-core">N</div>
        </div>
        <h1 class="brand-title"><span class="text-gradient">Nature</span> Platform</h1>
        <p class="brand-tagline">等保测评 · 项目流程管理系统</p>

        <div class="cyber-lines" aria-hidden="true">
          <div class="cyber-line" v-for="i in 3" :key="i"></div>
        </div>
      </section>

      <el-card class="login-card" shadow="never">
        <div class="card-glow"></div>

        <div class="card-header">
          <div class="header-icon" aria-hidden="true">
            <el-icon><Lock /></el-icon>
          </div>
          <h2>欢迎登录</h2>
          <p>使用账号密码或钉钉授权登录</p>
        </div>

        <el-form :model="form" class="login-form" @submit.prevent="handleLogin">
          <div class="input-wrapper">
            <el-form-item label="用户名">
              <el-input
                v-model="form.username"
                placeholder="请输入用户名"
                autocomplete="username"
                @keyup.enter="handleLogin"
              >
                <template #prefix>
                  <el-icon><User /></el-icon>
                </template>
              </el-input>
            </el-form-item>
          </div>

          <div class="input-wrapper">
            <el-form-item label="密  码">
              <el-input
                v-model="form.password"
                type="password"
                show-password
                placeholder="请输入密码"
                autocomplete="current-password"
                @keyup.enter="handleLogin"
              >
                <template #prefix>
                  <el-icon><Key /></el-icon>
                </template>
              </el-input>
            </el-form-item>
          </div>

          <button type="button" class="login-btn primary-btn" :disabled="loading" @click="handleLogin">
            <span class="btn-bg"></span>
            <span v-if="!loading" class="btn-content">
              <el-icon><Right /></el-icon>
              账号密码登录
            </span>
            <span v-else class="btn-content">
              <span class="btn-spinner"></span>
              登录中...
            </span>
          </button>
        </el-form>

        <div class="login-divider">
          <span class="divider-line"></span>
          <span class="divider-text">或</span>
          <span class="divider-line"></span>
        </div>

        <button type="button" class="dingtalk-btn" :disabled="loading" @click="handleDingTalk">
          <el-icon><Connection /></el-icon>
          钉钉授权登录
        </button>

        <div class="security-badge">
          <el-icon><CircleCheck /></el-icon>
          <span>OAuth 授权 · 全量操作留痕</span>
        </div>
      </el-card>
    </div>

    <footer class="login-footer">
      <p>© {{ year }} Nature Platform · 等保测评项目管理系统</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { CircleCheck, Connection, Key, Lock, Right, User } from "@element-plus/icons-vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "./auth-store";
import {
  dingTalkLogin,
  fetchCurrentUser,
  fetchDingTalkAuthorizeUrl,
  login,
  type LoginResponse
} from "./auth-service";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const loading = ref(false);
const particleCanvas = ref<HTMLCanvasElement | null>(null);
const year = new Date().getFullYear();

const form = reactive({
  username: "admin",
  password: "admin123"
});

let animationFrame = 0;
let detachResize: (() => void) | null = null;

function readErrorMessage(error: unknown, fallback: string) {
  const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof msg === "string" && msg.trim().length > 0 ? msg : fallback;
}

async function bootstrapSession(data: LoginResponse) {
  authStore.setSession(data.token, data.username, data.username, [], [], [], data.mustChangePassword);
  try {
    const profile = await fetchCurrentUser();
    authStore.setSession(
      data.token,
      profile.username || data.username,
      profile.displayName || profile.username || data.username,
      profile.roles || [],
      profile.resources || profile.permissions || [],
      profile.menuTree || [],
      Boolean(profile.mustChangePassword ?? data.mustChangePassword)
    );
  } catch {
    authStore.setRoles([]);
    authStore.setResources([]);
    authStore.setMenuTree([]);
    authStore.setMustChangePassword(data.mustChangePassword);
  }
}

async function handleLogin() {
  loading.value = true;
  try {
    const data = await login(form.username, form.password);
    await bootstrapSession(data);
    if (data.mustChangePassword) {
      ElMessage.warning("首次登录请尽快修改默认密码。");
    } else {
      ElMessage.success("登录成功");
    }
    await router.push("/dashboard");
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "登录失败，请检查账号密码"));
  } finally {
    loading.value = false;
  }
}

async function handleDingTalk() {
  try {
    const redirect = `${window.location.origin}/login`;
    const url = await fetchDingTalkAuthorizeUrl(redirect);
    window.location.href = url;
  } catch (error) {
    ElMessage.error(readErrorMessage(error, "钉钉登录链接获取失败"));
  }
}

async function handleDingTalkCallback() {
  const authCode = typeof route.query.authCode === "string" ? route.query.authCode : "";
  const error = typeof route.query.error === "string" ? route.query.error : "";
  if (error) {
    ElMessage.error(`钉钉授权失败：${error}`);
    await router.replace("/login");
    return;
  }
  if (!authCode) {
    return;
  }

  loading.value = true;
  try {
    const data = await dingTalkLogin(authCode);
    await bootstrapSession(data);
    if (data.mustChangePassword) {
      ElMessage.warning("首次钉钉登录后请先修改密码。");
    } else {
      ElMessage.success("登录成功");
    }
    await router.replace("/dashboard");
  } catch (errorInfo) {
    ElMessage.error(readErrorMessage(errorInfo, "钉钉登录失败"));
    await router.replace("/login");
  } finally {
    loading.value = false;
  }
}

function initParticles() {
  const canvas = particleCanvas.value;
  if (!canvas) {
    return;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resize();

  window.addEventListener("resize", resize);
  detachResize = () => window.removeEventListener("resize", resize);

  const particles = Array.from({ length: 72 }).map(() => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: (Math.random() - 0.5) * 0.38,
    vy: (Math.random() - 0.5) * 0.38,
    radius: Math.random() * 1.8 + 0.8,
    alpha: Math.random() * 0.45 + 0.2
  }));

  const tick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < particles.length; i += 1) {
      for (let j = i + 1; j < particles.length; j += 1) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 126) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(52, 216, 188, ${0.12 * (1 - dist / 126)})`;
          ctx.lineWidth = 0.7;
          ctx.stroke();
        }
      }
    }

    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0 || p.x > canvas.width) {
        p.vx *= -1;
      }
      if (p.y < 0 || p.y > canvas.height) {
        p.vy *= -1;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(114, 229, 207, ${p.alpha})`;
      ctx.fill();
    });

    animationFrame = window.requestAnimationFrame(tick);
  };

  tick();
}

onMounted(() => {
  initParticles();
  void handleDingTalkCallback();
});

onUnmounted(() => {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
  }
  if (detachResize) {
    detachResize();
  }
});
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background: #0a1117;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.particle-canvas {
  position: fixed;
  inset: 0;
  z-index: 0;
}

.cyber-grid {
  position: fixed;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(52, 216, 188, 0.06) 1px, transparent 1px),
    linear-gradient(rgba(52, 216, 188, 0.06) 1px, transparent 1px);
  background-size: 52px 52px;
  z-index: 1;
  animation: grid-move 20s linear infinite;
}

@keyframes grid-move {
  0% {
    transform: perspective(500px) rotateX(58deg) translateY(0);
  }

  100% {
    transform: perspective(500px) rotateX(58deg) translateY(52px);
  }
}

.orb-container {
  position: fixed;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}

.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(76px);
  animation: orb-float 14s ease-in-out infinite;
}

.orb-1 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgba(52, 216, 188, 0.36), transparent 70%);
  top: -12%;
  right: 7%;
}

.orb-2 {
  width: 320px;
  height: 320px;
  background: radial-gradient(circle, rgba(66, 170, 238, 0.28), transparent 70%);
  bottom: 6%;
  left: -6%;
  animation-delay: -4s;
}

.orb-3 {
  width: 250px;
  height: 250px;
  background: radial-gradient(circle, rgba(136, 220, 174, 0.26), transparent 70%);
  top: 54%;
  left: 48%;
  animation-delay: -8s;
}

@keyframes orb-float {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }

  50% {
    transform: translate(24px, -20px) scale(1.08);
  }
}

.login-wrapper {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 74px;
  padding: 38px;
}

.brand-section {
  text-align: center;
  animation: fade-left 0.8s ease-out;
}

@keyframes fade-left {
  from {
    opacity: 0;
    transform: translateX(-36px);
  }
}

.logo-wrapper {
  position: relative;
  width: 120px;
  height: 120px;
  margin: 0 auto 30px;
}

.logo-ring {
  position: absolute;
  inset: -10px;
  border: 2px solid transparent;
  border-top-color: #35d7b5;
  border-radius: 50%;
  animation: ring-rotate 3s linear infinite;
}

.logo-ring.ring-2 {
  inset: -19px;
  border-top-color: #4aaaf5;
  animation-direction: reverse;
  animation-duration: 4s;
}

.logo-core {
  width: 100%;
  height: 100%;
  border-radius: 32px;
  background: linear-gradient(140deg, rgba(39, 111, 147, 0.9), rgba(34, 81, 114, 0.9));
  display: grid;
  place-items: center;
  font-size: 50px;
  font-family: "STZhongsong", "Source Han Sans SC", serif;
  color: #d9fff3;
  box-shadow: 0 0 30px rgba(53, 215, 181, 0.28);
}

@keyframes ring-rotate {
  to {
    transform: rotate(360deg);
  }
}

.brand-title {
  font-family: "STZhongsong", "Source Han Sans SC", serif;
  font-size: 42px;
  font-weight: 700;
  color: #f2fbff;
  margin: 0 0 12px;
  letter-spacing: 1.6px;
}

.brand-title .text-gradient {
  background: linear-gradient(135deg, #34d8bc 0%, #66baff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.brand-tagline {
  font-size: 14px;
  color: rgba(220, 239, 248, 0.82);
  letter-spacing: 4px;
  margin-bottom: 36px;
}

.cyber-lines {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.cyber-line {
  width: 58px;
  height: 3px;
  background: linear-gradient(90deg, transparent, #35d7b5, transparent);
  border-radius: 2px;
  animation: line-pulse 2s ease-in-out infinite;
}

.cyber-line:nth-child(2) {
  width: 78px;
  animation-delay: 0.26s;
}

.cyber-line:nth-child(3) {
  animation-delay: 0.5s;
}

@keyframes line-pulse {
  0%,
  100% {
    opacity: 0.34;
    transform: scaleX(0.82);
  }

  50% {
    opacity: 1;
    transform: scaleX(1);
  }
}

.login-card {
  width: 458px;
  position: relative;
  border-radius: 24px;
  border: 1px solid rgba(147, 181, 199, 0.2);
  background: rgba(12, 22, 31, 0.84);
  backdrop-filter: blur(18px);
  padding: 38px;
  color: #eff9ff;
  animation: fade-right 0.8s ease-out;
}

@keyframes fade-right {
  from {
    opacity: 0;
    transform: translateX(36px);
  }
}

.card-glow {
  position: absolute;
  top: -1px;
  left: 18%;
  right: 18%;
  height: 2px;
  background: linear-gradient(90deg, transparent, #35d7b5, #4aaaf5, transparent);
  filter: blur(1px);
}

.card-header {
  text-align: center;
  margin-bottom: 24px;
}

.header-icon {
  width: 56px;
  height: 56px;
  margin: 0 auto 14px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6fe9cd;
  border: 1px solid rgba(111, 233, 205, 0.36);
  background: linear-gradient(135deg, rgba(53, 215, 181, 0.2), rgba(74, 170, 245, 0.12));
}

.header-icon .el-icon {
  font-size: 29px;
}

.card-header h2 {
  margin: 0 0 8px;
  font-size: 24px;
  font-family: "STZhongsong", "Source Han Sans SC", serif;
  letter-spacing: 1px;
}

.card-header p {
  margin: 0;
  color: rgba(204, 226, 237, 0.82);
  font-size: 14px;
}

.login-form :deep(.el-form-item__label) {
  color: rgba(204, 226, 237, 0.86);
  font-size: 12px;
  font-weight: 600;
}

.input-wrapper {
  margin-bottom: 6px;
}

.input-wrapper :deep(.el-input__wrapper) {
  min-height: 48px;
  border: 1px solid rgba(117, 147, 165, 0.34);
  background: rgba(24, 39, 52, 0.7);
  box-shadow: none;
  color: #e9f5fb;
}

.input-wrapper :deep(.el-input__wrapper.is-focus) {
  border-color: #36d9b7;
  box-shadow: 0 0 0 3px rgba(54, 217, 183, 0.2);
}

.input-wrapper :deep(.el-input__inner) {
  color: #e9f6fb;
}

.input-wrapper :deep(.el-input__inner::placeholder) {
  color: rgba(193, 215, 227, 0.66);
}

.input-wrapper :deep(.el-input__prefix-inner .el-icon) {
  color: rgba(176, 217, 232, 0.8);
}

.login-btn.primary-btn {
  width: 100%;
  height: 52px;
  border: none;
  border-radius: 12px;
  background: none;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  margin-top: 2px;
}

.login-btn.primary-btn .btn-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #35d7b5 0%, #4aaaf5 100%);
  transition: all 0.3s;
}

.login-btn.primary-btn .btn-content {
  position: relative;
  z-index: 1;
  color: #f3feff;
  font-size: 16px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.login-btn.primary-btn:hover:not(:disabled) .btn-bg {
  filter: brightness(1.08);
  box-shadow: 0 8px 30px rgba(53, 215, 181, 0.35);
}

.login-btn.primary-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.32);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.login-divider {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 24px 0;
}

.divider-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(144, 173, 190, 0.48), transparent);
}

.divider-text {
  font-size: 12px;
  color: rgba(195, 217, 229, 0.8);
  letter-spacing: 2px;
}

.dingtalk-btn {
  width: 100%;
  height: 50px;
  border-radius: 12px;
  border: 1px solid rgba(74, 170, 245, 0.42);
  background: rgba(74, 170, 245, 0.12);
  color: #6ebdfb;
  font-size: 15px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  cursor: pointer;
  transition: all 0.24s ease;
}

.dingtalk-btn:hover:not(:disabled) {
  background: rgba(74, 170, 245, 0.22);
  border-color: rgba(74, 170, 245, 0.76);
  transform: translateY(-1px);
}

.dingtalk-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.security-badge {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(146, 173, 188, 0.24);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
}

.security-badge .el-icon {
  font-size: 16px;
  color: #67e7c8;
}

.security-badge span {
  font-size: 12px;
  color: rgba(198, 219, 230, 0.82);
}

.login-footer {
  position: absolute;
  bottom: 20px;
  left: 0;
  right: 0;
  text-align: center;
  z-index: 10;
}

.login-footer p {
  margin: 0;
  font-size: 12px;
  color: rgba(188, 208, 220, 0.66);
}

@media (max-width: 900px) {
  .login-wrapper {
    flex-direction: column;
    gap: 36px;
    padding: 22px;
  }

  .brand-section {
    display: none;
  }

  .login-card {
    width: 100%;
    max-width: 430px;
    padding: 30px;
  }
}

@media (max-width: 480px) {
  .login-card {
    padding: 22px;
    border-radius: 20px;
  }

  .card-header h2 {
    font-size: 21px;
  }
}

@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
