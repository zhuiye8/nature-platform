import request from './request'

export interface CaptchaResponse {
  enabled: boolean
  captchaId?: string
  svg?: string
}

export function getCaptcha() {
  return request.get<CaptchaResponse>('/auth/captcha')
}

export function getDingtalkAuthUrl() {
  return request.get<{ url: string; state: string }>('/auth/dingtalk/auth-url')
}

export function dingtalkLogin(authCode: string) {
  return request.post<any>('/auth/dingtalk/login', { authCode })
}

export function dingtalkBind(userId: number, password: string, dingtalkInfo: any) {
  return request.post<any>('/auth/dingtalk/bind', { userId, password, dingtalkInfo })
}

export function dingtalkCreate(dingtalkInfo: any) {
  return request.post<any>('/auth/dingtalk/create', { dingtalkInfo })
}

export function dingtalkUnbind() {
  return request.delete('/auth/dingtalk/unbind')
}
