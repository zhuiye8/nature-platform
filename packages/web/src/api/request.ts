import axios from 'axios'
import type { ApiResponse } from '@nature/shared'
import { ElMessage } from 'element-plus'

const request = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

request.interceptors.response.use(
  (response) => {
    const res = response.data as ApiResponse
    if (res.code !== 0) {
      ElMessage.error(res.message || '请求失败')
      if (res.code === 401) {
        localStorage.removeItem('token')
        window.location.href = '/login'
      }
      return Promise.reject(new Error(res.message || '请求失败'))
    }
    return res.data as any
  },
  (error) => {
    const msg = error.response?.data?.message || error.message || '网络错误'
    if (error.response?.status === 401) {
      // If already on login page, just show error (e.g. wrong password)
      if (window.location.pathname === '/login') {
        ElMessage.error(msg)
      } else {
        localStorage.removeItem('token')
        window.location.href = '/login'
      }
    } else {
      ElMessage.error(msg)
    }
    return Promise.reject(error)
  },
)

export default request
