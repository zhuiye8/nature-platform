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

export function getDownloadUrl(fileId: number) {
  return request.get<any, { url: string; fileName: string }>(`/file/download/${fileId}`)
}

export function getPreviewUrl(fileId: number) {
  return request.get<any, { url: string; fileName: string }>(`/file/download/${fileId}`, { params: { mode: 'preview' } })
}

export function deleteFile(fileId: number, bizType?: string, nodeKey?: string) {
  if (bizType && nodeKey) {
    // Delete by bizType + bizId + nodeKey
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
