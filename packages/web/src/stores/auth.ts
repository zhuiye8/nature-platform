import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserInfo, LoginResponse } from '@nature/shared'
import request from '@/api/request'
import router from '@/router'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('token'))
  const user = ref<UserInfo | null>(null)

  const isLoggedIn = computed(() => !!token.value)
  const permissions = computed(() => user.value?.permissions ?? [])

  async function login(username: string, password: string) {
    const data = (await request.post('/auth/login', {
      username,
      password,
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
    token.value = null
    user.value = null
    localStorage.removeItem('token')
    router.push('/login')
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
