import request from './request'

export interface ArchiveItem {
  id: number
  projectRegisterId: number
  materialStatusCodes: string[]
  fileCount: number | null
  storageLocation: string | null
  remark: string | null
  status: string
  submittedBy: number | null
  submittedAt: string | null
  createdAt: string
}

export const getArchivePage = (params: Record<string, any>) =>
  request.get('/archive/page', { params })

export const getArchiveByProject = (projectRegisterId: number) =>
  request.get(`/archive/${projectRegisterId}`) as any

export const submitArchive = (data: {
  projectRegisterId: number
  materialStatusCodes?: string[]
  fileCount?: number
  storageLocation?: string
  remark?: string
}) => request.post('/archive/submit', data)
