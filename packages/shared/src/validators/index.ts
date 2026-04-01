import { z } from 'zod'

/** Login form validation */
export const loginSchema = z.object({
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().min(1, '密码不能为空'),
})
export type LoginInput = z.infer<typeof loginSchema>

/** Pagination query validation */
export const pageQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
  keyword: z.string().optional(),
})
export type PageQueryInput = z.infer<typeof pageQuerySchema>
