import request from './request'

export interface CompileFileItem {
  id: number
  projectRegisterId: number
  fileName: string
  fileSize: number
  contentType: string | null
  remark: string | null
  compiledBy: number
  compilerName: string | null
  uploadedAt: string
}

export function getCompileFiles(projectRegisterId: number) {
  return request.get<CompileFileItem[]>(`/compile-file/${projectRegisterId}`)
}

export function uploadCompileFile(
  projectRegisterId: number,
  file: File,
  remark?: string,
) {
  const formData = new FormData()
  formData.append('file', file)
  return request.post(
    `/compile-file/${projectRegisterId}${remark ? '?remark=' + encodeURIComponent(remark) : ''}`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
}

export function getCompileFileDownloadPath(fileId: number) {
  const token = localStorage.getItem('token')
  return `/api/compile-file/download/${fileId}?token=${token}`
}

export function deleteCompileFile(fileId: number) {
  return request.delete(`/compile-file/remove/${fileId}`)
}
