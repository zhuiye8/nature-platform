import axios from 'axios'
import type { AxiosRequestConfig } from 'axios'
import type { ApiResponse } from '@nature/shared'
import { ElMessage } from 'element-plus'

const instance = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

instance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

instance.interceptors.response.use(
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

const request = {
  get<T = unknown, D = unknown>(url: string, config?: AxiosRequestConfig<D>) {
    return instance.get<unknown, T, D>(url, config)
  },
  post<T = unknown, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig<D>) {
    return instance.post<unknown, T, D>(url, data, config)
  },
  put<T = unknown, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig<D>) {
    return instance.put<unknown, T, D>(url, data, config)
  },
  patch<T = unknown, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig<D>) {
    return instance.patch<unknown, T, D>(url, data, config)
  },
  delete<T = unknown, D = unknown>(url: string, config?: AxiosRequestConfig<D>) {
    return instance.delete<unknown, T, D>(url, config)
  },
}

export default request
