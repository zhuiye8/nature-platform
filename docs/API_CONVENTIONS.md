# API 规范约定 — Nature 等保测评平台

> 所有 AI 编码助手在生成 NestJS Controller / Vue API 层代码时必须遵循本文档。
> 最后更新：2026-03-23

---

## 1. 基础 URL

```
开发环境：http://localhost:3010/api
生产环境：通过 Nginx 反代，前端同域 /api
```

---

## 2. 响应格式

### 成功响应

```json
{
  "code": 0,
  "data": { ... },
  "message": "ok"
}
```

### 列表响应（分页）

```json
{
  "code": 0,
  "data": {
    "list": [ ... ],
    "total": 100,
    "page": 1,
    "pageSize": 20
  },
  "message": "ok"
}
```

### 错误响应

```json
{
  "code": 40001,
  "data": null,
  "message": "合同已提交，不可编辑"
}
```

### 校验错误响应

```json
{
  "code": 42200,
  "data": {
    "errors": [
      { "field": "paymentAmount", "message": "金额必须大于 0" },
      { "field": "customerName", "message": "客户名称不能为空" }
    ]
  },
  "message": "参数校验失败"
}
```

---

## 3. 错误码规范

| 范围 | 含义 | 示例 |
|------|------|------|
| 0 | 成功 | — |
| 40000-40099 | 认证/权限 | 40001=未登录, 40003=无权限 |
| 40100-40199 | 业务参数错误 | 40101=合同已提交不可编辑 |
| 40400-40499 | 资源不存在 | 40401=合同不存在 |
| 40900-40999 | 冲突 | 40901=该合同年份已存在项目登记 |
| 42200-42299 | 校验失败 | 42200=参数校验失败 |
| 50000-50099 | 服务器内部错误 | 50000=未知错误 |

---

## 4. 分页、排序、筛选

### 分页请求

```
GET /api/contracts?page=1&pageSize=20
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | number | 1 | 页码（从 1 开始） |
| pageSize | number | 20 | 每页条数（最大 100） |

### 排序

```
GET /api/contracts?sort=createdAt&order=desc
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| sort | string | createdAt | 排序字段（驼峰命名） |
| order | string | desc | asc / desc |

### 筛选

```
GET /api/contracts?reviewStatus=APPROVED&customerName=医院
```

- 精确匹配：`?status=APPROVED`
- 模糊搜索：`?keyword=医院`（后端根据实体决定搜索哪些字段）
- 范围筛选：`?createdAtFrom=2026-01-01&createdAtTo=2026-12-31`

---

## 5. RESTful URL 规范

### CRUD 基础

```
GET    /api/{resources}          列表（分页）
GET    /api/{resources}/:id      详情
POST   /api/{resources}          创建
PUT    /api/{resources}/:id      更新
DELETE /api/{resources}/:id      软删除
```

### 业务操作（非 CRUD）

```
POST   /api/{resources}/:id/submit          提交审核
POST   /api/{resources}/:id/approve         审核通过
POST   /api/{resources}/:id/reject          审核驳回（body 含 remark）
POST   /api/{resources}/:id/archive         归档
POST   /api/contracts/batch-delete           批量删除 body: { ids: [1,2,3] }
```

### 子资源

```
GET    /api/contracts/:id/system-items       合同的系统明细列表
POST   /api/contracts/:id/system-items       添加系统明细
PUT    /api/contracts/:id/system-items/:itemId  更新系统明细
DELETE /api/contracts/:id/system-items/:itemId  删除系统明细
```

### 工作流操作

```
GET    /api/workflow/my-tasks               我的待办任务
POST   /api/workflow/tasks/:taskId/complete  完成任务 body: { result, remark, formData }
```

### 文件

```
POST   /api/files/upload                    单文件上传（返回 file_attachment 记录）
POST   /api/files/upload-chunk              分片上传（大文件）
GET    /api/files/:id/presigned-url         获取预签名下载 URL
```

---

## 6. 命名规范

| 位置 | 规范 | 示例 |
|------|------|------|
| URL 路径 | kebab-case | `/api/project-registers` |
| 查询参数 | camelCase | `?pageSize=20&reviewStatus=APPROVED` |
| 请求/响应 JSON 字段 | camelCase | `{ contractName, paymentAmount }` |
| 数据库列 | snake_case | `contract_name, payment_amount` |
| TypeScript 接口 | PascalCase | `ContractDetailDto` |

> Drizzle ORM 自动做 snake_case ↔ camelCase 转换。

---

## 7. 认证

### 请求头

```
Authorization: Bearer <jwt_token>
```

### JWT 有效期

| 场景 | 有效期 |
|------|--------|
| Access Token | 2 小时 |
| Refresh Token | 7 天 |

### 登录接口

```
POST /api/auth/login              账号密码登录
POST /api/auth/dingtalk/login     钉钉 OAuth 登录
POST /api/auth/refresh            刷新 Token
GET  /api/auth/me                 获取当前用户信息 + 权限列表
```

---

## 8. 时间格式

| 方向 | 格式 | 示例 |
|------|------|------|
| 请求（前端→后端） | ISO 8601 | `2026-03-23T10:00:00+08:00` |
| 响应（后端→前端） | ISO 8601 | `2026-03-23T02:00:00.000Z` |
| 前端展示 | Asia/Shanghai | `2026-03-23 10:00:00` |

---

## 9. 端口配置

| 服务 | 端口 |
|------|------|
| PostgreSQL | 5442 |
| Redis | 6389 |
| MinIO API | 9010 |
| MinIO Console | 9011 |
| NestJS 后端 | 3010 |
| Vue 前端（dev） | 5183 |
| Gotenberg | 3011 |
