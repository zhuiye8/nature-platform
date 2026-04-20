import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserInfo, LoginResponse } from '@nature/shared'
import request from '@/api/request'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('token'))
  const user = ref<UserInfo | null>(null)

  const isLoggedIn = computed(() => !!token.value)
  const permissions = computed(() => user.value?.permissions ?? [])

  async function login(
    username: string,
    password: string,
    captchaId?: string,
    captchaAnswer?: string,
  ) {
    const data = (await request.post('/auth/login', {
      username,
      password,
      captchaId,
      captchaAnswer,
    })) as unknown as LoginResponse
    token.value = data.accessToken
    user.value = data.user
    localStorage.setItem('token', data.accessToken)
  }

  async function fetchProfile() {
    const data = (await request.get('/auth/me')) as unknown as UserInfo
    user.value = data
  }

  function logout() {
    // Clear storage first so any in-flight requests fail cleanly
    localStorage.removeItem('token')
    // Use a hard navigation to /login so all in-memory state (Pinia stores,
    // SSE connections, watchers) is fully reset. This avoids the Suspense
    // "stuck on old view" issue that happens when token/user refs are
    // nulled while the current route's component tree still depends on them.
    window.location.href = '/login'
  }

  return {
    token,
    user,
    isLoggedIn,
    permissions,
    login,
    fetchProfile,
    logout,
  }
})
