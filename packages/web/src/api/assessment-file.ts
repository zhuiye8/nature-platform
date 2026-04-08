import request from './request'

export interface AssessmentFileItem {
  id: number
  projectRegisterId: number
  filePool: string
  fileName: string
  fileSize: number
  contentType: string | null
  remark: string | null
  uploadedBy: number
  uploaderName: string | null
  uploadedAt: string
}

export function getAssessmentFiles(projectRegisterId: number, pool?: string) {
  return request.get<AssessmentFileItem[]>(`/assessment-file/${projectRegisterId}`, {
    params: pool ? { pool } : {},
  })
}

export function uploadAssessmentFile(
  projectRegisterId: number,
  pool: string,
  file: File,
  remark?: string,
) {
  const formData = new FormData()
  formData.append('file', file)
  return request.post(
    `/assessment-file/${projectRegisterId}?pool=${pool}${remark ? '&remark=' + encodeURIComponent(remark) : ''}`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
}

export function getAssessmentFileDownloadPath(fileId: number) {
  const token = localStorage.getItem('token')
  return `/api/assessment-file/download/${fileId}?token=${token}`
}

export function deleteAssessmentFile(fileId: number) {
  return request.delete(`/assessment-file/remove/${fileId}`)
}
