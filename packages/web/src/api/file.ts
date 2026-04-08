import request from './request'

export interface FileItem {
  id: number
  fileName: string
  fileSize: number
  contentType: string
  uploaderId: number
  uploaderName: string
  uploadedAt: string
}

export function getFileList(bizType: string, bizId: number) {
  return request.get<any, FileItem[]>('/file/list', { params: { bizType, bizId } })
}

/** Get preview path — appends token as query param for direct browser access */
export function getFilePreviewPath(fileId: number) {
  const token = localStorage.getItem('token')
  return `/api/file/download/${fileId}?mode=preview&token=${token}`
}

/** Get download path — appends token as query param for direct browser access */
export function getFileDownloadPath(fileId: number) {
  const token = localStorage.getItem('token')
  return `/api/file/download/${fileId}?token=${token}`
}

export function deleteFile(fileId: number, bizType?: string, nodeKey?: string) {
  if (bizType && nodeKey) {
    return request.delete(`/file/by-biz`, { params: { bizType, bizId: fileId, nodeKey } })
  }
  return request.delete(`/file/${fileId}`)
}

export function getUploadUrl(bizType: string, bizId: number, nodeKey?: string) {
  let url = `/api/file/upload?bizType=${bizType}&bizId=${bizId}`
  if (nodeKey) url += `&nodeKey=${nodeKey}`
  return url
}

export async function uploadFileRaw(bizType: string, bizId: number, nodeKey: string, file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return request.post(`/file/upload?bizType=${bizType}&bizId=${bizId}&nodeKey=${nodeKey}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
