<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ElMessage } from 'element-plus'
import { User, Lock, Right } from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const loading = ref(false)
const particleCanvas = ref<HTMLCanvasElement | null>(null)
const year = new Date().getFullYear()

const form = reactive({ username: '', password: '' })

let animationFrame = 0
let detachResize: (() => void) | null = null

async function handleLogin() {
  if (!form.username || !form.password) {
    ElMessage.warning('请输入用户名和密码')
    return
  }
  loading.value = true
  try {
    await authStore.login(form.username, form.password)
    ElMessage.success('登录成功')
    const redirect = (route.query.redirect as string) || '/'
    router.push(redirect)
  } catch { /* handled by interceptor */ }
  finally { loading.value = false }
}

function initParticles() {
  const canvas = particleCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const resize = () => {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
  }
  resize()
  window.addEventListener('resize', resize)
  detachResize = () => window.removeEventListener('resize', resize)

  const particles = Array.from({ length: 60 }).map(() => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    radius: Math.random() * 1.6 + 0.6,
    alpha: Math.random() * 0.4 + 0.15,
  }))

  const tick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x
        const dy = particles[i].y - particles[j].y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 120) {
          ctx.beginPath()
          ctx.moveTo(particles[i].x, particles[i].y)
          ctx.lineTo(particles[j].x, particles[j].y)
          ctx.strokeStyle = `rgba(184, 158, 120, ${0.1 * (1 - dist / 120)})`
          ctx.lineWidth = 0.6
          ctx.stroke()
        }
      }
    }
    particles.forEach((p) => {
      p.x += p.vx
      p.y += p.vy
      if (p.x < 0 || p.x > canvas.width) p.vx *= -1
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(200, 175, 140, ${p.alpha})`
      ctx.fill()
    })
    animationFrame = window.requestAnimationFrame(tick)
  }
  tick()
}

onMounted(() => initParticles())
onUnmounted(() => {
  if (animationFrame) cancelAnimationFrame(animationFrame)
  if (detachResize) detachResize()
})
</script>

<template>
  <div class="lp">
    <canvas ref="particleCanvas" class="lp-particles" />
    <div class="lp-grid" />

    <div class="lp-orbs" aria-hidden="true">
      <div class="lp-orb lp-orb--1" />
      <div class="lp-orb lp-orb--2" />
      <div class="lp-orb lp-orb--3" />
    </div>

    <div class="lp-wrapper">
      <!-- Brand Section -->
      <section class="lp-brand">
        <div class="lp-logo">
          <div class="lp-logo__ring" />
          <div class="lp-logo__ring lp-logo__ring--2" />
          <div class="lp-logo__core">N</div>
        </div>
        <h1 class="lp-brand__title"><span class="lp-gradient">Nature</span> Platform</h1>
        <p class="lp-brand__tagline">等保测评 · 项目流程管理系统</p>
        <div class="lp-brand__lines">
          <span v-for="i in 3" :key="i" class="lp-brand__line" />
        </div>
      </section>

      <!-- Login Card -->
      <div class="lp-card">
        <div class="lp-card__glow" />

        <div class="lp-card__header">
          <div class="lp-card__icon">
            <el-icon><Lock /></el-icon>
          </div>
          <h2>欢迎登录</h2>
          <p>使用账号密码登录系统</p>
        </div>

        <form class="lp-form" @submit.prevent="handleLogin">
          <div class="lp-field">
            <label>用户名</label>
            <el-input v-model="form.username" placeholder="请输入用户名" size="large" @keyup.enter="handleLogin">
              <template #prefix><el-icon><User /></el-icon></template>
            </el-input>
          </div>

          <div class="lp-field">
            <label>密码</label>
            <el-input v-model="form.password" type="password" show-password placeholder="请输入密码" size="large" @keyup.enter="handleLogin">
              <template #prefix><el-icon><Lock /></el-icon></template>
            </el-input>
          </div>

          <button type="submit" class="lp-btn" :disabled="loading">
            <span class="lp-btn__bg" />
            <span class="lp-btn__content">
              <template v-if="!loading">
                <el-icon><Right /></el-icon>
                登 录
              </template>
              <template v-else>
                <span class="lp-spinner" />
                登录中...
              </template>
            </span>
          </button>
        </form>

        <div class="lp-badge">
          <span>安全认证 · 全量操作留痕</span>
        </div>
      </div>
    </div>

    <footer class="lp-footer">
      <p>&copy; {{ year }} Nature Platform · 等保测评项目管理系统</p>
    </footer>
  </div>
</template>

<style scoped>
.lp {
  min-height: 100vh;
  background: #0c1218;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

/* ── Particles ── */
.lp-particles { position: fixed; inset: 0; z-index: 0; }

/* ── Grid ── */
.lp-grid {
  position: fixed; inset: 0; z-index: 1;
  background: linear-gradient(90deg, rgba(184,158,120,0.04) 1px, transparent 1px),
              linear-gradient(rgba(184,158,120,0.04) 1px, transparent 1px);
  background-size: 50px 50px;
  animation: grid-drift 22s linear infinite;
}
@keyframes grid-drift {
  0% { transform: perspective(500px) rotateX(55deg) translateY(0); }
  100% { transform: perspective(500px) rotateX(55deg) translateY(50px); }
}

/* ── Orbs ── */
.lp-orbs { position: fixed; inset: 0; z-index: 2; pointer-events: none; }
.lp-orb { position: absolute; border-radius: 50%; filter: blur(80px); animation: orb-drift 16s ease-in-out infinite; }
.lp-orb--1 { width: 380px; height: 380px; background: radial-gradient(circle, rgba(184,134,78,0.25), transparent 70%); top: -10%; right: 5%; }
.lp-orb--2 { width: 300px; height: 300px; background: radial-gradient(circle, rgba(91,106,191,0.2), transparent 70%); bottom: 5%; left: -5%; animation-delay: -5s; }
.lp-orb--3 { width: 220px; height: 220px; background: radial-gradient(circle, rgba(160,140,100,0.18), transparent 70%); top: 50%; left: 45%; animation-delay: -10s; }
@keyframes orb-drift {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(20px, -18px) scale(1.06); }
}

/* ── Wrapper ── */
.lp-wrapper {
  position: relative; z-index: 10;
  display: flex; align-items: center; gap: 70px; padding: 36px;
}

/* ── Brand ── */
.lp-brand { text-align: center; animation: slide-left 0.8s ease-out; }
@keyframes slide-left { from { opacity: 0; transform: translateX(-30px); } }

.lp-logo { position: relative; width: 110px; height: 110px; margin: 0 auto 28px; }
.lp-logo__ring {
  position: absolute; inset: -10px;
  border: 2px solid transparent; border-top-color: #c8a870;
  border-radius: 50%; animation: ring-spin 3s linear infinite;
}
.lp-logo__ring--2 { inset: -18px; border-top-color: #7b8ec6; animation-direction: reverse; animation-duration: 4.5s; }
.lp-logo__core {
  width: 100%; height: 100%; border-radius: 28px;
  background: linear-gradient(140deg, rgba(120,95,60,0.9), rgba(80,65,45,0.9));
  display: grid; place-items: center;
  font-size: 46px; font-weight: 700; color: #f0e6d6;
  box-shadow: 0 0 28px rgba(184,134,78,0.25);
  font-family: 'Plus Jakarta Sans', serif;
}
@keyframes ring-spin { to { transform: rotate(360deg); } }

.lp-brand__title {
  font-size: 38px; font-weight: 700; color: #f5f0ea;
  margin: 0 0 10px; letter-spacing: 1.5px;
  font-family: 'Plus Jakarta Sans', serif;
}
.lp-gradient {
  background: linear-gradient(135deg, #c8a870 0%, #9eaee0 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
}
.lp-brand__tagline { font-size: 13px; color: rgba(220,210,195,0.7); letter-spacing: 4px; margin-bottom: 30px; }
.lp-brand__lines { display: flex; justify-content: center; gap: 7px; }
.lp-brand__line {
  width: 50px; height: 3px; border-radius: 2px;
  background: linear-gradient(90deg, transparent, #c8a870, transparent);
  animation: line-pulse 2.2s ease-in-out infinite;
}
.lp-brand__line:nth-child(2) { width: 70px; animation-delay: 0.3s; }
.lp-brand__line:nth-child(3) { animation-delay: 0.6s; }
@keyframes line-pulse {
  0%, 100% { opacity: 0.3; transform: scaleX(0.8); }
  50% { opacity: 1; transform: scaleX(1); }
}

/* ── Card ── */
.lp-card {
  width: 430px; position: relative; border-radius: 22px;
  border: 1px solid rgba(160,145,120,0.18);
  background: rgba(14,20,28,0.85); backdrop-filter: blur(20px);
  padding: 36px; color: #f0ece5; animation: slide-right 0.8s ease-out;
}
@keyframes slide-right { from { opacity: 0; transform: translateX(30px); } }

.lp-card__glow {
  position: absolute; top: -1px; left: 16%; right: 16%; height: 2px;
  background: linear-gradient(90deg, transparent, #c8a870, #8a9bd4, transparent);
  filter: blur(1px);
}

.lp-card__header { text-align: center; margin-bottom: 22px; }
.lp-card__icon {
  width: 50px; height: 50px; margin: 0 auto 12px; border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  color: #d4b88a; border: 1px solid rgba(200,168,112,0.3);
  background: linear-gradient(135deg, rgba(184,134,78,0.18), rgba(120,140,200,0.1));
}
.lp-card__icon .el-icon { font-size: 26px; }
.lp-card__header h2 { margin: 0 0 6px; font-size: 22px; letter-spacing: 1px; font-weight: 600; }
.lp-card__header p { margin: 0; color: rgba(210,200,185,0.7); font-size: 13px; }

/* ── Form ── */
.lp-field { margin-bottom: 16px; }
.lp-field label { display: block; font-size: 12px; font-weight: 600; color: rgba(210,200,185,0.8); margin-bottom: 6px; }
.lp-field :deep(.el-input__wrapper) {
  min-height: 46px; border: 1px solid rgba(140,130,115,0.25);
  background: rgba(30,38,48,0.7); box-shadow: none !important; color: #ede6da;
}
.lp-field :deep(.el-input__wrapper.is-focus) { border-color: #c8a870; box-shadow: 0 0 0 3px rgba(200,168,112,0.18) !important; }
.lp-field :deep(.el-input__inner) { color: #ede8e0; }
.lp-field :deep(.el-input__inner::placeholder) { color: rgba(200,190,175,0.5); }
.lp-field :deep(.el-input__prefix-inner .el-icon) { color: rgba(190,180,160,0.6); }

.lp-btn {
  width: 100%; height: 48px; border: none; border-radius: 12px;
  background: none; cursor: pointer; position: relative; overflow: hidden; margin-top: 4px;
}
.lp-btn__bg {
  position: absolute; inset: 0;
  background: linear-gradient(135deg, #c8a870 0%, #8a9bd4 100%);
  transition: all 0.3s;
}
.lp-btn__content {
  position: relative; z-index: 1; color: #fff; font-size: 15px; font-weight: 700;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
}
.lp-btn:hover:not(:disabled) .lp-btn__bg { filter: brightness(1.1); box-shadow: 0 8px 28px rgba(184,134,78,0.3); }
.lp-btn:disabled { opacity: 0.7; cursor: not-allowed; }

.lp-spinner {
  width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
  border-radius: 50%; animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.lp-badge {
  margin-top: 18px; padding-top: 14px;
  border-top: 1px solid rgba(160,145,120,0.18);
  text-align: center; font-size: 11px; color: rgba(200,190,175,0.6);
}

/* ── Footer ── */
.lp-footer { position: absolute; bottom: 18px; text-align: center; z-index: 10; }
.lp-footer p { margin: 0; font-size: 11px; color: rgba(200,190,175,0.4); }

/* ── Responsive ── */
@media (max-width: 900px) {
  .lp-wrapper { flex-direction: column; gap: 30px; padding: 20px; }
  .lp-brand { display: none; }
  .lp-card { width: 100%; max-width: 400px; padding: 28px; }
}
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; } }
</style>
