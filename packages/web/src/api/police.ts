import request from './request'
import axios from 'axios'

export interface PoliceItem {
  id: number
  projectRegisterId: number
  applicationName: string | null
  systemItemCount: number
  pmName: string | null
  pmMobile: string | null
  hasFile: boolean
  status: string
  createdAt: string
}

export const getPoliceRegisterPage = (params: Record<string, any>) =>
  request.get('/police/page', { params })

export const getPoliceRegisterDetail = (id: number) =>
  request.get(`/police/${id}`)

export async function exportPoliceExcel(id: number) {
  const token = localStorage.getItem('token')
  const res = await axios.get(`/api/police/${id}/export`, {
    responseType: 'blob',
    headers: { Authorization: `Bearer ${token}` },
  })

  const blob = new Blob([res.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url

  // Extract filename from Content-Disposition header
  const cd = res.headers['content-disposition']
  let fileName = `公安登记-${new Date().toISOString().slice(0, 10)}.xlsx`
  if (cd) {
    const match = cd.match(/filename\*=UTF-8''(.+)/i)
    if (match) fileName = decodeURIComponent(match[1].replace(/"/g, ''))
  }

  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}
