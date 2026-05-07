# CLAUDE.md

为 Claude Code (claude.ai/code) 提供本仓库的工作指引。最近一次大更新：2026-04-30。

> 本文件**只描述事实**。如果你发现下面任何内容与代码不符，以代码为准并告知用户更新本文档。

---

## 项目概述

Nature 等保测评项目管理平台 — 企业内部使用，覆盖**客户 → 合同 → 项目登记 → 公安登记 → 现场测评 → 质量审核 → 报告编制 → 材料归档** 全链路，附带**财务模块**（合同回款、开票申请、费用请款、结算汇总）。

**生产环境**：192.168.9.170 (Docker 部署)，已于 2026-04-29 正式启用。

## 技术栈（实际状态，非历史描述）

| 层 | 技术 | 备注 |
|----|------|------|
| 后端 | **NestJS 11** + Node.js 22 | 模块化 + DI + 装饰器 |
| ORM | **Drizzle ORM** | TS 类型安全，迁移文件在 `packages/server/drizzle/` |
| DB | **PostgreSQL 16** | JSONB 重度使用 |
| 缓存 | Redis 8 | ioredis |
| 文件 | **MinIO** (S3 兼容) | @aws-sdk/client-s3 v3 |
| 工作流 | **自研状态机** | `wf_definition`/`wf_node`/`wf_transition`/`wf_instance`/`wf_task` |
| 前端 | Vue 3 + Element Plus + Pinia + Vite | TS 严格模式 |
| 认证 | @nestjs/passport + @nestjs/jwt | JWT 支持 Header + Query token |
| 监控 | logging via `@nestjs/common` Logger | 业务事件→ EventEmitter2 |

> ⚠ 历史上的 Spring Boot / Flowable / MySQL / bpmn-js 描述都是**错的**，已纠正。

## 仓库结构（pnpm workspace monorepo）

```
nature-platform/
├── packages/
│   ├── server/           # NestJS 后端
│   │   ├── src/modules/  # 业务模块（25 个，见下文）
│   │   ├── src/database/schema/   # Drizzle schema 定义
│   │   ├── drizzle/      # 自动生成的迁移 SQL
│   │   └── package.json
│   ├── web/              # Vue 3 前端
│   │   ├── src/pages/    # 页面组件
│   │   ├── src/api/      # 后端 API 封装
│   │   ├── src/components/、layouts/、router/、stores/、utils/
│   │   └── package.json
│   ├── shared/           # 前后端共用类型
│   └── terminal/         # Electron 离线终端（Phase 4 预留，可能未启用）
├── docker/               # 本地 Docker 编排（postgres + redis + minio）
├── scripts/              # SQL 工具：seed.sql / cleanup-* / seed-prod-staff.sql 等
├── docs/                 # 设计文档（见下方索引）
└── deploy/               # 生产部署脚本
```

## 后端模块清单（packages/server/src/modules/）

| 模块 | 职责 |
|------|------|
| `auth` | 登录、JWT、当前用户 |
| `user` / `role` | 用户/角色/权限管理 |
| `dingtalk` | 钉钉 OAuth 登录 |
| `customer` / `partner` | 客户/合作方主数据 |
| `contract` | 合同组、合同、系统明细、提交审核、归档 |
| `project` | 项目登记、系统明细、成员分配 |
| `workflow` | 通用流程引擎（启动/推进/查待办） |
| `police` | 公安登记 |
| `assessment` / `assessment-file` / `compile-file` | 现场测评 + 文件管理 |
| `review-opinion` | 审核意见模板 + 历史 |
| `report` | 报告分配、编制、提交、终审 |
| `archive` | 材料归档 |
| `file` | 通用文件上传下载（MinIO 代理）|
| `notification` | 系统通知 |
| `recycle` | 回收站（合同 + 项目登记） |
| `platform` | 注册平台主数据 |
| `payment-record` | 合同回款记录 |
| `invoice` | 开票申请（FIN_INVOICE 流程）|
| `expense` | 费用请款（FIN_EXPENSE 流程）|
| `settlement` | 结算管理（聚合查询）|

## 工作流定义（4 个）

| def_key | 名称 | 节点链 |
|---------|------|--------|
| `CONTRACT_FLOW` | 合同流程 | CREATE → REVIEW → AUTO_NUMBER → ARCHIVE |
| `PROJECT_ASSESSMENT_FLOW` | 项目测评流程 | REGISTER → DEPT_REVIEW（可跳过）→ DIRECTOR_REVIEW → POLICE_REGISTER → ON_SITE_ASSESSMENT → TECH_REVIEW → CONTENT_REVIEW（3 路并行）→ REPORT_ASSIGN → REPORT_COMPILE → FINAL_REVIEW → MATERIAL_ARCHIVE |
| `FIN_INVOICE` | 开票申请流程 | 申请 → 财务审核 → 已开票/需修改 |
| `FIN_EXPENSE` | 费用请款流程 | 请款 → 部门审核 → 财务审核 → 抄送董事长 |

## 角色（19 个，定义在 `iam_role` 表）

| 类型 | 角色 |
|------|------|
| 业务发起 | sales（销售）、commercial（商务）、dept_manager（部门经理）、project_director（项目主管）|
| 测评师等级 | senior_assessor / middle_assessor / junior_assessor |
| **PM 资格** | **project_manager**（独立标志位，与等级解耦，由项目主管显式授予）|
| 公安登记 | police_register |
| 审核 | tech_reviewer、content_reviewer_tech / mgmt / network |
| 报告 | report_writer、report_assigner |
| 归档 | archiver |
| 财务 | finance |
| 预留 | chairman（董事长，权限手工配置）|
| 系统 | super_admin |

> **PM 资格设计要点（2026-04-29 决策）**：
> - 原"中/高级测评师自动有 PM 资格"被废弃，因为业务上中级测评师不一定能担任 PM
> - 现在 PM 候选 = `project_manager` 角色用户 ∩ senior/middle_assessor，需项目主管手工授权
> - 具体项目的 PM 指派仍通过 `project_member.roleType='PM'`

## 常用命令

### 启动开发环境（Windows）

```powershell
# 1. 启动 docker 中间件（postgres + redis + minio）
cd C:\work\nature\claude
pnpm docker:up

# 2. 装依赖（仅首次）
pnpm install

# 3. 跑迁移 + 种子（仅首次或 schema 变更后）
pnpm db:migrate
docker exec -i nature-postgres psql -U nature -d nature < scripts/seed.sql

# 4. 启动前后端（同时）
pnpm dev          # 等价 pnpm dev:server + pnpm dev:web
```

### 单独命令

```powershell
pnpm dev:server                  # 仅后端
pnpm dev:web                     # 仅前端
pnpm build                       # 构建（先 server 后 web）
pnpm typecheck                   # 全仓库类型检查
pnpm db:generate                 # schema 变更 → 生成 migration
pnpm db:migrate                  # 应用 migration 到 DB
pnpm db:push                     # 危险：直接同步 schema 到 DB（仅原型期）
```

### Docker 卷重置（开发环境清库）

```powershell
docker compose -f docker/docker-compose.yml down -v
pnpm docker:up
pnpm db:migrate
docker exec -i nature-postgres psql -U nature -d nature < scripts/seed.sql
```

## 数据库连接（开发）

| 项 | 值 |
|----|----|
| Host | localhost |
| Port | **5442**（不是默认 5432）|
| User | nature |
| Password | nature123 |
| DB | nature |

Redis: `localhost:6389` / MinIO: `http://localhost:9010`（控制台 `:9011`）

## 关键路径

| 需求 | 文件位置 |
|------|---------|
| 加新业务模块 | `packages/server/src/modules/<name>/` 三件套 (controller/service/module) |
| 改 schema | `packages/server/src/database/schema/*.ts` → `pnpm db:generate` |
| 加新流程 | INSERT 到 `wf_definition` + `wf_node` + `wf_transition`（参考 `scripts/seed.sql`）|
| 加新角色 | `scripts/seed.sql` 里的 `iam_role` INSERT 块 |
| 加新菜单 | `scripts/seed.sql` 里的 `iam_resource` + `iam_role_resource` |
| 前端加页面 | `packages/web/src/pages/` + `router/index.ts` |
| 钉钉对接 | `packages/server/src/modules/dingtalk/` |

## 默认账号

| 用途 | 用户名 | 密码 |
|------|--------|------|
| 超级管理员 | `admin` | `admin123` |
| 生产员工首登 | 拼音全拼 | `nature@2026`（首登强制改密）|

## 文档索引（docs/）

| 文档 | 用途 |
|------|------|
| `ARCHITECTURE_DECISION.md` | 架构决策记录（ADR），技术选型/数据模型/工作流 |
| `BUSINESS_RULES.md` | 业务规则确认记录，避免反复讨论 |
| `ENTITY_FIELDS.md` | 实体表字段说明 |
| `API_CONVENTIONS.md` | API 命名/响应/错误约定 |
| `项目业务流程与模块职责.md` | 流程图 + 模块拆分总览 |
| `等保项目测试说明.md` | 历史功能迭代记录 |
| `TESTING_WORKFLOW_GUIDE.md` | 工作流 e2e 测试 SOP |
| `TEST_FINANCE_*.md` | 财务模块测试 SOP（批 1/2/全量） |
| `PROD_DEPLOYMENT_2026-04.md` | 生产环境部署清单 |

## 修复 / 历史 bug 索引

| 时间 | 位置 | 内容 |
|------|------|------|
| 2026-04-29 | migration 0016 | 给 `user_role` / `iam_role_permission` / `iam_role_resource` 三张表加唯一约束（修复 seed 重复跑导致绑定累积重复的历史 bug）|
| 2026-04-29 | seed.sql + TaskDetail.vue | PM 资格独立成 `project_manager` 角色，与测评师等级解耦 |
| 2026-05-07 | migration 0017 + platform.service | 注册平台引入业务编号 `platform_no`（P-0001 格式），单行 `platform_serial` 维护自增 |
| 2026-05-07 | recycle.service + 4 处 remove | 回收站从空架子复活：`RecycleService.softDelete` 通用入口；contract / project / platform / contract_group 的 `remove` 改走此入口；新增软删表必须遵循此约定 |

## 给 Claude 的工作偏好

1. **修代码前先看现状**：用 Glob/Grep 定位真实结构，不要凭空假设。
2. **schema 变更必走 drizzle**：改 `*.ts` schema 文件 → `pnpm db:generate` → 检查 migration → `pnpm db:migrate`。绝不要直接写 SQL 改 schema。
3. **seed.sql 必须幂等**：所有 INSERT 用 `ON CONFLICT DO NOTHING`（前提是表上有合适的 unique 约束）。
4. **改文档先核对**：任何文档要写"已确认/最后更新"的，先核对真实代码状态再写。
5. **生产操作只读**：除非用户明确同意，所有 SSH 到生产的操作都用 SELECT/journalctl 等只读命令。
6. **专业术语必须中英对照**：与用户的所有汇报/文档/对话中，凡涉及以下内容首次出现时必须用 `中文（英文）` 形式同时给出，方便用户与代码/数据库一一对照：
   - **角色**：销售（sales）/ 档案管理员（archiver）/ 部门经理（dept_manager）/ 项目主管（project_director）/ 项目经理（project_manager）/ 财务（finance）/ 董事长（chairman）/ 整体技术审核员（tech_reviewer）/ 内容审核员-技术/管理/网络（content_reviewer_tech / mgmt / network）/ 报告编制员（report_writer）/ 报告分配人（report_assigner）/ 公安登记专员（police_register）/ 高/中/初级测评师（senior/middle/junior_assessor）/ 商务（commercial）/ 超级管理员（super_admin）等
   - **工作流定义**：合同流程（CONTRACT_FLOW）/ 项目测评流程（PROJECT_ASSESSMENT_FLOW）/ 开票申请流程（FIN_INVOICE）/ 费用请款流程（FIN_EXPENSE）
   - **工作流节点**：项目登记申请（PROJECT_REGISTER）/ 部门经理确认（DEPT_REVIEW）/ 项目主管审核（DIRECTOR_REVIEW）/ 公安登记（POLICE_REGISTER）/ 现场测评（ON_SITE_ASSESSMENT）/ 技术审核（TECH_REVIEW）/ 内容审核（CONTENT_REVIEW）/ 报告分配（REPORT_ASSIGN）/ 报告编制（REPORT_COMPILE）/ 最终审核（FINAL_REVIEW）/ 材料归档（MATERIAL_ARCHIVE）/ 财务审核（FIN_INVOICE_REVIEW）/ 部门负责人审核（FIN_EXPENSE_DEPT_REVIEW）等
   - **状态码**：草稿（DRAFT）/ 已提交（SUBMITTED）/ 已通过（APPROVED）/ 已驳回（REJECTED）/ 部门审核通过（DEPT_APPROVED）/ 待归档（PENDING_ARCHIVE）/ 已归档（ARCHIVED）/ 未回款（UNPAID）/ 部分回款（PARTIAL）/ 已回款（PAID）等
   - **bizType**：合同（CONTRACT）/ 合同组（CONTRACT_GROUP）/ 项目登记（PROJECT_REGISTER）/ 注册平台（PLATFORM）等
   - **权限点**：合同列表（contract:list）/ 编辑财务信息（contract:update_financial）/ 发起开票申请（invoice:apply）等
   - **菜单/页面**：合同财务（/finance/contract）/ 开票申请（/finance/invoice）等
