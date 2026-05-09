import { z } from 'zod'

/** Login form validation */
export const loginSchema = z.object({
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().min(1, '密码不能为空'),
})
export type LoginInput = z.infer<typeof loginSchema>

// ============================================================================
// USCC（统一社会信用代码）校验
// 标准：GB 32100-2015
// - 18 位字符
// - 字符集：0-9 + A-H, J-N, P-R, T-U, W-Y（不含 I O Z S V，避免与数字混淆）
// - 末位为校验码
//
// 校验码算法（GB 32100 附录 A）：
//   1) 前 17 位每个字符在字符集中的索引 × 对应权重，求和
//   2) checkCode = (31 - sum % 31) % 31
//   3) 字符集[checkCode] 应等于第 18 位
// ============================================================================
const USCC_CHARSET = '0123456789ABCDEFGHJKLMNPQRTUWXY'
const USCC_WEIGHTS = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28]
const USCC_PATTERN = /^[0-9A-HJ-NP-RTUWXY]{18}$/

export function isValidUSCC(code: string | null | undefined): boolean {
  if (!code || !USCC_PATTERN.test(code)) return false
  let sum = 0
  for (let i = 0; i < 17; i++) {
    const idx = USCC_CHARSET.indexOf(code[i])
    if (idx < 0) return false
    sum += idx * USCC_WEIGHTS[i]
  }
  const checkCode = (31 - (sum % 31)) % 31
  return USCC_CHARSET[checkCode] === code[17]
}

/** Pagination query validation */
export const pageQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
  keyword: z.string().optional(),
})
export type PageQueryInput = z.infer<typeof pageQuerySchema>
