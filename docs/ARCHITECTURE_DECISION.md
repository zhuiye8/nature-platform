# Architecture Decision Record — Nature 等保测评平台

> 本文档是系统架构设计的唯一事实来源，记录所有已对齐的架构决策。
> 最后更新：2026-05-07
>
> **2026-04 ~ 2026-05 增量决策**（详见本文末"附录 A：增量决策记录"）：
> - 财务模块新增 4 张菜单：合同财务、开票申请、费用请款、结算管理（FIN_INVOICE + FIN_EXPENSE 工作流）
> - PM 资格独立成 `project_manager` 角色（与测评师等级解耦）
> - 新增 `chairman` 预留角色（董事长）
> - migration 0016 修复 m-to-n 绑定表缺唯一约束的历史 bug
> - **2026-05-07：注册平台引入业务编号 `platform_no`（P-0001 格式）**
> - **2026-05-07：回收站从空架子复活 — 4 处 remove 改走 `RecycleService.softDelete` 统一入口**

---

## 1. 项目定位

企业内部等保测评项目管理平台，核心能力：

- **业务流程管理**：客户 → 合同 → 项目 → 测评 → 审核 → 报告 → 归档
- **多角色审批流**：自研状态机驱动，支持串行、并行、多人协作节点
- **细粒度数据可见性**：行级 + 列级 + 操作级，纯角色驱动
- **离线现场测评**：Electron 终端，支持断网采集 + 包文件交换
- **文件资产管理**：大文件上传、跨节点可见、预签名下载
- **报告模板生成**：Word 模板填充 + PDF 转换
- **AI 能力预留**：OCR、本地 LLM、Agent 自动化
- **审计留痕**：字段级变更记录
- **无缝拓展**：等保优先，运维/培训/渗透后续接入零代码变更

---

## 2. 技术栈

### 2.1 技术选型决策理由

本项目 **90% 由 AI 编码助手开发，人类仅审核**。技术选型的首要原则是 **AI 生成代码质量 + 全栈统一语言**。

关键调研结论：
- TypeScript 在 AI 编码准确率排名第二（73-81%），仅次于 Python（89%）
- TypeScript 的类型系统能在**编译期捕获 AI 幻觉错误**，Python 运行时不强制类型
- 全栈 TypeScript 使 AI 助手和人类审核者只需掌握一种语言
- Java/Spring Boot 生成速度比 TypeScript 慢 1.5-2x，样板代码量是 2 倍
- NestJS 的模块/装饰器/守卫模式直接借鉴 Spring，架构能力等价

### 2.2 后端

| 组件 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 运行时 | Node.js | 22 LTS | 事件循环，SSE 天然支持 |
| 框架 | NestJS | 11 | 模块化 + 装饰器 + DI |
| ORM | Drizzle ORM | latest | 纯 TS、类型安全、原生 JSONB、无二进制依赖 |
| 数据库 | PostgreSQL | 16 | JSONB 原生、RLS 备用、全文搜索 |
| 缓存 | Redis | 8.x | 会话 + 缓存（ioredis） |
| 文件存储 | MinIO | latest | S3 兼容对象存储（@aws-sdk/client-s3 v3） |
| 认证 | @nestjs/passport + @nestjs/jwt | latest | JWT 认证 |
| 权限 | CASL | latest | 同构授权库，支持字段级权限，前后端共享 |
| SSE | NestJS 内置 @Sse() | — | 零额外依赖 |
| 报告生成 | easy-template-x | latest | MIT 免费，含图片/表格/循环，纯 TypeScript |
| PDF 转换 | Gotenberg | 8 | Docker 微服务，HTTP API，处理中文字体 |
| 校验 | Zod | latest | 前后端共享校验 schema |
| 工作流 | 自研状态机 | — | 7 表引擎 + Strategy 模式 |

### 2.3 前端（Web 平台）

| 组件 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 框架 | Vue | 3.5 | 组合式 API |
| 构建 | Vite | 7.x | 开发 + 构建 |
| UI 库 | Element Plus | latest | 中国企业组件库标准 |
| 状态管理 | Pinia | latest | 权限状态 |
| 语言 | TypeScript | 5.x（strict 模式） | 类型安全 |
| 实时通知 | VueUse useEventSource | latest | 响应式 SSE |
| 权限指令 | v-permission | 自定义 | 按钮级控制 |

### 2.4 离线终端

| 组件 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 框架 | Electron | latest | 桌面应用容器 |
| UI | Vue 3 + Element Plus | 同 Web | 与 Web 平台共享组件 |
| 本地数据库 | better-sqlite3 | latest | 同步 API，60GB+ 支持，2000+ QPS |
| 语言 | TypeScript | 同 Web | 全栈统一 |
| 打包 | electron-builder | latest | MSI 企业分发 |

### 2.5 AI 能力（渐进接入）

| 能力 | 当前方案（NestJS 内） | 未来升级 |
|------|---------------------|---------|
| 调用 LLM | Ollama REST API + ollama-js | — |
| AI Agent | Vercel AI SDK 6.0（官方支持 NestJS） | — |
| OCR | PaddleOCR ONNX via onnxruntime-node | FastAPI 微服务（GPU 加速） |
| RAG | LangChain.js / LangGraph.js | — |
| 模型微调 | — | FastAPI 微服务 |

> 原则：当前 AI 需求全在 Node.js 生态内解决。仅当需要 GPU 推理或模型训练时，按需加 Python FastAPI 微服务。

### 2.6 基础设施

| 组件 | 说明 |
|------|------|
| 容器 | Docker Compose |
| 网关 | Nginx |
| PDF 转换 | Gotenberg 8（Docker 容器） |
| LLM 推理 | Ollama（Docker 容器，按需启动） |
| 环境 | 本地机房 + 公网映射 |
| 并发 | ~20 人同时在线 |

### 2.7 Monorepo 结构

```
nature/
├── packages/
│   ├── shared/          ← 共享 TypeScript 类型 + Zod schema + CASL 权限 + 工具函数
│   │   ├── types/       ← 测评项、项目包、标准库类型定义
│   │   ├── validators/  ← 前后端 + 终端共用校验逻辑
│   │   └── constants/   ← 等保标准枚举等
│   ├── web/             ← Vue 3 Web 平台
│   ├── server/          ← NestJS 后端
│   └── terminal/        ← Electron 离线终端
├── docker/              ← Docker Compose 配置
├── docs/                ← 文档
└── pnpm-workspace.yaml
```

全栈统一优势：
- AI 助手只需理解一种语言的模式
- 前后端 + 终端共享类型定义、校验逻辑、权限规则
- 人类审核者只需 TypeScript 一种技能

---

## 3. 业务流程（13 节点）

### 3.1 流程全图

```
  ┌──────────────┐
  │  ① 客户管理   │  销售录入客户信息
  └──────┬───────┘
         │ 客户 1:N 合同
  ┌──────▼───────┐
  │  ② 合同管理   │  录入中标信息 + 合同信息 + 系统明细
  └──────┬───────┘
         │ 提交审核
  ┌──────▼───────┐
  │  ③ 合同审核   │  审批通过→自动生成编号/名称；驳回→回②
  └──────┬───────┘
         │
  ┌──────▼───────┐
  │  ④ 合同归档   │  商务填写归档信息 + 上传扫描件
  └──────┬───────┘  归档完成→抄送合同创建人
         │
  ┌──────▼───────┐
  │ ⑤ 项目登记申请 │  选合同+年份，填系统明细
  └──────┬───────┘  申请单名称自动生成
         │ 提交审核
  ┌──────▼─────────────┐
  │ ⑥ 审核项目登记      │  审核通过 + 分配项目组成员
  │    + 分配项目组      │  （项目经理 + 测评师若干）
  └──────┬─────────────┘
         │
  ┌──────▼───────┐
  │  ⑦ 公安登记   │  专职角色处理：上传公安登记证明 + 选择项目经理
  └──────┬───────┘
         │
  ┌──────▼────────────┐
  │ ⑧ 现场测评实施     │  多人协作：PM + 测评师各自提交各自部分
  │   （多人协作节点）  │  全员提交完毕→节点完成
  │                    │  PM 可点「发起质量审核」按钮
  └──────┬────────────┘
         │ 自动选人（回避本项目 PM + 测评师）
  ┌──────▼──────────────────────────┐
  │ ⑨ 质量审核（四路并行）            │
  │  ┌──────────┐  ┌──────────────┐ │
  │  │整体技术   │  │报告内容审核   │ │
  │  │审核 ×1   │  │ A / B / C ×3 │ │
  │  └────┬─────┘  └──────┬───────┘ │
  │       └───────┬───────┘         │
  │               │ 全部通过         │
  └───────────────┼─────────────────┘
                  │
  ┌───────────────▼──┐
  │ ⑩ 报告编制任务分配 │  指定单人编制
  └──────┬───────────┘
  ┌──────▼───────┐
  │ ⑪ 报告编制上传 │  编制人上传报告
  └──────┬───────┘
  ┌──────▼───────┐
  │  ⑫ 报告审核   │  最终审批
  └──────┬───────┘
  ┌──────▼───────┐
  │  ⑬ 材料归档   │  人工提交归档
  └──────────────┘
```

### 3.2 节点类型映射

| 节点 | 引擎节点类型 | 说明 |
|------|------------|------|
| ①②⑤ | `SIMPLE` | 单人录入/提交 |
| ③⑥⑫ | `REVIEW` | 单人审核（通过/驳回） |
| ⑦ | `SIMPLE` | 专职角色操作 |
| ⑧ | `MULTI_ASSIGNEE` | 多人各自提交，全部完成→节点完成 |
| ⑨ | `PARALLEL_REVIEW` | 四路并行审核，全部通过→流转 |
| ⑩ | `SIMPLE` | 分配任务 |
| ⑪ | `SIMPLE` | 编制人提交 |
| ④⑬ | `SIMPLE` | 归档操作 |

### 3.3 关键业务规则

#### 合同编号自动生成
- 格式：`YZN-YYYY-0001`（4 位序号，每年重置）
- 仅在**审核通过后**生成，生成后不可修改
- 驳回后重新通过：重新生成编号和名称

#### 合同名称自动拼接
- 规则：客户名称 + 系统展示 + 服务年份展示
- 系统展示：总数 ≤ 3 全展示；> 3 仅展示等级 + 数量
- 年份展示：连续用 `2026-2028`，非连续用 `2026,2027,2029`

#### 项目登记唯一性
- 约束：`contract_id + contract_year`（未删除范围内唯一）
- 已存在同合同同年份未删除记录时，该年份不可选

#### 质量审核回避机制
- 从审核人角色池按序取候选人
- 回避名单：本项目的 PM + 全部测评师（来自 `project_member` 表）
- 按序取第一个不在回避名单中的候选人
- 无可用人选时提示管理员手动指定

#### 现场测评多人协作
- 项目组成员各自提交各自部分
- 全部成员提交完毕 → 节点完成
- 仅项目经理可见「发起质量审核」按钮

---

## 4. 权限模型

### 4.1 核心原则

```
部门 = 仅用于展示和筛选标签，不参与权限判定
权限 = 完全由角色驱动
可见性 = 角色权限 + 数据归属（创建人 / 指派人）
```

### 4.2 权限三层模型

| 层 | 作用 | 实现方式 |
|----|------|---------|
| **菜单/按钮级** | 控制 UI 元素可见性 | RBAC：角色 → 菜单/权限标识 |
| **API 接口级** | 控制接口访问 | NestJS Guards + CASL |
| **数据级** | 控制能看到哪些记录和字段 | Service 层显式查询 + 不同 DTO 类 |

### 4.3 数据可见性矩阵

#### 行级可见性（哪些记录）

| 模块 | 列表可见规则 |
|------|-------------|
| 客户 | 所有人 |
| 合同 | 所有销售（摘要列）；商务角色看全部列 |
| 合同归档 | 商务 + 管理员 |
| 项目登记 | 所有人（摘要列）；管理员看全部 |
| 公安登记 | 专职角色 + 管理员 |
| 现场测评 | **仅被分配的项目组成员 + 项目经理** |
| 质量审核 | **仅被分配的审核人** + 管理员 |
| 报告编制 | **仅被分配的编制人** + 管理员 |
| 报告审核 | 有审核权限者 + 管理员 |
| 材料归档 | 有归档权限者 + 管理员 |

#### 列级可见性（哪些字段）

| 场景 | 返回 DTO | 可见字段 |
|------|---------|---------|
| 合同列表（非创建人销售） | `ContractListDto` | 合同名、归属人、状态 |
| 合同详情（创建人） | `ContractDetailDto` | 全部字段 |
| 合同详情（其他销售） | `ContractSummaryDto` | 部分字段（不含金额等敏感信息） |
| 合同详情（商务/管理员） | `ContractDetailDto` | 全部字段 |

> 交互统一：所有销售都能点进详情页，但非创建人看到的是部分字段版本。

#### 操作级可见性（能做什么）

| 操作 | 权限规则 |
|------|---------|
| 编辑 | 创建人（草稿态）/ 商务（补充字段）/ 被指派人 |
| 删除 | 仅创建人（仅合同 + 项目登记，草稿态） |
| 审核 | 仅被指派的审核人 |
| 恢复 | 仅超管 |
| 发起质量审核 | 仅项目经理 |

### 4.4 行级可见性实现方案

**决策：Service 层显式查询，不用 ORM 拦截器。**

理由：
- 20 人系统，SQL 量不大，显式 WHERE 清晰可调试
- 每个模块可见性规则不同，拦截器反而要写大量条件分支
- 新人接手看 Service 代码一目了然

实现模式：
```
所有人可见         → 普通 SELECT
创建人可见         → WHERE creator_id = #{currentUserId}
指派可见（项目组）  → JOIN project_member WHERE user_id = #{currentUserId}
角色可见           → Service 检查 hasRole('xxx')
混合              → WHERE creator_id = #{currentUserId} OR hasRole('commercial')
```

### 4.5 列级可见性实现方案

**决策：不同 DTO 类，不用动态字段屏蔽。**

理由：
- 编译期类型安全，无运行时反射
- 接口返回什么字段一目了然
- 前端根据接口返回自然渲染，无需额外 `v-if`

### 4.6 前端权限实现

| 层 | 机制 | 说明 |
|----|------|------|
| 路由级 | 动态路由注册 | 登录后按角色权限只注册可访问的路由 |
| 按钮级 | `v-permission` 指令 | `<el-button v-permission="'project:create'">` |
| 字段级 | 后端 DTO 驱动 | 前端按接口返回的字段渲染，不做额外判断 |

---

## 5. 自研工作流引擎

### 5.1 设计决策

| 决策项 | 结论 | 理由 |
|--------|------|------|
| 引擎类型 | 自研表驱动 | 完全可控，无外部重依赖 |
| 不用 Flowable | 确认 | 40+ 张表太重，16 节点不需要 |
| 扩展方式 | INSERT 配置行 | 新流程零代码变更 |
| 可视化配置 | Phase1 表单 → Phase2 钉钉风格编辑器 | 渐进交付 |

### 5.2 核心表设计（7 张表）

```
┌─────────────────┐     ┌──────────────┐     ┌───────────────────┐
│  wf_definition   │────▶│   wf_node    │────▶│  wf_transition    │
│  流程定义        │     │  节点定义     │     │  流转规则          │
│  (等保/运维/...) │     │  (类型+配置)  │     │  (from→to+事件)   │
└─────────────────┘     └──────────────┘     └───────────────────┘

┌─────────────────┐     ┌──────────────┐
│  wf_instance     │────▶│   wf_task    │
│  流程实例        │     │  任务         │
│  (当前节点+状态)  │     │  (指派人+结果)│
└─────────────────┘     └──────────────┘

┌─────────────────────┐  ┌──────────────┐
│  wf_assignment_rule  │  │ wf_action_log│
│  分配规则            │  │  操作日志     │
│  (角色池+回避规则)    │  │  (审计留痕)   │
└─────────────────────┘  └──────────────┘
```

#### wf_definition — 流程定义

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | — |
| def_key | VARCHAR(64) | 流程标识，如 `DENGBAO_ASSESSMENT` |
| version | INT | 版本号 |
| def_name | VARCHAR(128) | 流程名称 |
| status | VARCHAR(16) | `DRAFT` / `ACTIVE` / `DEPRECATED` |
| created_at | TIMESTAMPTZ | — |

> UNIQUE(def_key, version)

#### wf_node — 节点定义

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | — |
| definition_id | BIGINT FK | 所属流程定义 |
| node_key | VARCHAR(64) | 节点标识，如 `CONTRACT_REVIEW` |
| node_name | VARCHAR(128) | 节点名称 |
| node_type | VARCHAR(32) | `SIMPLE` / `REVIEW` / `PARALLEL_REVIEW` / `MULTI_ASSIGNEE` / `AUTO` |
| node_order | INT | 排序 |
| config_json | JSONB | 节点类型专属配置 |

> UNIQUE(definition_id, node_key)

#### wf_transition — 流转规则

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | — |
| definition_id | BIGINT FK | 所属流程定义 |
| from_node_key | VARCHAR(64) | 来源节点（空字符串 = 起点） |
| to_node_key | VARCHAR(64) | 目标节点（空字符串 = 终点） |
| event | VARCHAR(64) | 触发事件：`SUBMIT` / `APPROVE` / `REJECT` / `ALL_COMPLETE` / `ALL_APPROVED` / `ANY_REJECTED` |
| guard_expr | VARCHAR(500) | 条件表达式（可选） |
| priority | INT | 优先级（高优先） |

> UNIQUE(definition_id, from_node_key, event, priority)

#### wf_instance — 流程实例

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | — |
| definition_id | BIGINT FK | 绑定的流程定义（版本锁定） |
| biz_type | VARCHAR(64) | 业务类型 |
| biz_id | BIGINT | 业务记录 ID |
| current_node | VARCHAR(64) | 当前节点 |
| status | VARCHAR(32) | `RUNNING` / `COMPLETED` / `CANCELLED` |
| started_by | BIGINT | 发起人 |
| started_at | TIMESTAMPTZ | — |
| finished_at | TIMESTAMPTZ | — |
| variables_json | JSONB | 流程级变量 |

> UNIQUE(biz_type, biz_id)

#### wf_task — 任务

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | — |
| instance_id | BIGINT FK | 所属实例 |
| node_key | VARCHAR(64) | 所属节点 |
| slot_key | VARCHAR(64) | 插槽标识（并行审核：`TECH` / `CONTENT_A` 等） |
| assignee_id | BIGINT | 指派人 |
| status | VARCHAR(32) | `PENDING` / `COMPLETED` / `CANCELLED` / `SKIPPED` |
| result | VARCHAR(32) | `APPROVED` / `REJECTED` / `SUBMITTED` |
| remark | VARCHAR(1000) | 审核意见 |
| completed_at | TIMESTAMPTZ | — |
| created_at | TIMESTAMPTZ | — |

#### wf_assignment_rule — 分配规则

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | — |
| node_key | VARCHAR(64) | 节点标识 |
| slot_key | VARCHAR(64) | 插槽标识 |
| slot_label | VARCHAR(128) | 插槽显示名 |
| role_code | VARCHAR(64) | 候选角色编码 |
| avoidance_rule | VARCHAR(32) | 回避规则：`SAME_PROJECT` / `NONE` |
| priority | INT | 候选优先级（低优先数值先选） |

> UNIQUE(node_key, slot_key, role_code)

#### wf_action_log — 操作日志

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | — |
| instance_id | BIGINT FK | 所属实例 |
| task_id | BIGINT | 关联任务（可选） |
| node_key | VARCHAR(64) | 节点 |
| action | VARCHAR(32) | `SUBMIT` / `APPROVE` / `REJECT` / `REASSIGN` |
| operator_id | BIGINT | 操作人 |
| remark | VARCHAR(1000) | 备注 |
| created_at | TIMESTAMPTZ | — |

### 5.3 节点类型行为定义

| 类型 | 进入时创建任务 | 完成条件 | 完成事件 |
|------|--------------|---------|---------|
| `SIMPLE` | 1 个（提交人） | 任务完成 | `SUBMIT` |
| `REVIEW` | 1 个（审核人） | 审核人操作 | `APPROVE` 或 `REJECT` |
| `PARALLEL_REVIEW` | N 个（每个 slot 一个） | 全部通过 | `ALL_APPROVED`；任一驳回 → `ANY_REJECTED` |
| `MULTI_ASSIGNEE` | N 个（每个成员一个） | 全部完成 | `ALL_COMPLETE` |
| `AUTO` | 0 个 | 自动执行 | `AUTO` |

### 5.4 引擎核心架构

```
WorkflowEngine（编排器）
├── NodeHandlerRegistry（节点类型 → Handler 映射）
│   ├── SimpleNodeHandler
│   ├── ReviewNodeHandler
│   ├── ParallelReviewNodeHandler
│   ├── MultiAssigneeNodeHandler
│   └── AutoNodeHandler
├── TransitionResolver（评估 guard 条件，确定下一节点）
├── AssignmentResolver（从规则 + 回避名单选人）
└── WorkflowEventPublisher（NestJS EventEmitter 发通知）
```

核心方法：
```
signal(instanceId, taskId, action, remark, operatorId)
  → 验证操作人是 assignee
  → 更新 task 状态
  → 检查节点完成条件
  → 完成 → 解析 transition → 进入下一节点
  → 下一节点创建 task → 发通知
```

### 5.5 版本管理策略

- 运行中实例绑定 `definition_id`，不受新版本影响
- 新实例使用最新 `ACTIVE` 版本
- 废弃旧版本：`status = DEPRECATED`，已有实例继续跑完

### 5.6 可视化配置（分期交付）

| 阶段 | 方案 | 工作量 |
|------|------|--------|
| Phase 1 | Element Plus 表单 + 表格管理节点/流转/规则 | 1 周 |
| Phase 2 | 钉钉审批风格竖向卡片树编辑器 | 2-3 周 |

Phase 2 技术方案：
- Fork [StavinLi/Workflow-Vue3](https://github.com/StavinLi/Workflow-Vue3)（~2000 行 Vue 3 代码）
- 替换节点类型为 5 种自定义类型
- 保存时扁平化为 `wf_node` + `wf_transition` 行

---

## 6. 项目成员表（贯穿全流程）

### 6.1 表结构

```sql
project_member (
    id              BIGINT PK GENERATED ALWAYS AS IDENTITY,
    project_id      BIGINT NOT NULL,
    user_id         BIGINT NOT NULL,
    role_type       VARCHAR(32) NOT NULL,
    status          VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    assigned_at     TIMESTAMPTZ NOT NULL,
    assigned_by     BIGINT NOT NULL,
    removed_at      TIMESTAMPTZ NULL,
    UNIQUE (project_id, user_id, role_type)
)
```

### 6.2 role_type 枚举

| 值 | 说明 |
|----|------|
| `PM` | 项目经理 |
| `ASSESSOR` | 测评师 |
| `TECH_REVIEWER` | 整体技术审核人 |
| `CONTENT_REVIEWER_A` | 内容审核人 A |
| `CONTENT_REVIEWER_B` | 内容审核人 B |
| `CONTENT_REVIEWER_C` | 内容审核人 C |
| `REPORT_WRITER` | 报告编制人 |

### 6.3 该表解决的问题

| 场景 | 查询方式 |
|------|---------|
| 现场测评可见性 | `WHERE role_type IN ('PM','ASSESSOR') AND project_id = ?` |
| 质量审核回避名单 | `WHERE project_id = ? AND status = 'ACTIVE'` |
| 审核人变更 | `UPDATE status = 'REMOVED'` + 新 INSERT |
| 任务分配记录 | `assigned_by` + `assigned_at` |

---

## 7. 通知系统

### 7.1 设计决策

| 决策 | 结论 |
|------|------|
| 推送方式 | SSE（NestJS `@Sse()` 装饰器），不用 WebSocket |
| 持久化 | `system_notification` 表 |
| 删除方式 | 物理删除 |
| 保存策略 | 永久保存 |

### 7.2 通知触发规则

| 事件 | 通知对象 |
|------|---------|
| 合同审核通过 | 拥有商务权限的全部用户 |
| 合同归档完成 | 合同创建人 |
| 审核节点进入（有 assignee） | 仅 assignee |
| 审核节点进入（无 assignee） | 该角色池全部用户 |

### 7.3 接口

- `GET /api/notifications/unread-count` — 未读数
- `GET /api/notifications` — 通知列表（默认最近 20 条）
- `PUT /api/notifications/:id/read` — 标记已读
- `PUT /api/notifications/read-all` — 全部已读
- `DELETE /api/notifications/:id` — 删除通知
- `GET /api/notifications/stream` — SSE 实时推送

---

## 8. 文件管理

### 8.1 设计决策

| 决策 | 结论 |
|------|------|
| 存储 | MinIO（S3 兼容，@aws-sdk/client-s3 v3） |
| 大文件 | 分片上传（5MB/片） |
| 下载 | 预签名 URL（30 分钟过期） |
| 访问控制 | 后端验权后才生成预签名 URL |
| 单文件上限 | 500MB |

### 8.2 文件元数据表

```sql
file_attachment (
    id              BIGINT PK,
    biz_type        VARCHAR(64),     -- CONTRACT / PROJECT / ASSESSMENT / REPORT
    biz_id          BIGINT,
    node_key        VARCHAR(64),     -- 上传时的节点
    file_name       VARCHAR(256),
    file_size       BIGINT,
    content_type    VARCHAR(128),
    storage_path    VARCHAR(512),    -- MinIO 路径
    uploader_id     BIGINT,
    uploaded_at     TIMESTAMPTZ
)
```

跨节点可见：查询 `WHERE biz_type = ? AND biz_id = ?`（不过滤 node_key）。

---

## 9. 审计留痕

### 9.1 设计决策

| 决策 | 结论 |
|------|------|
| V1 范围 | 字段级留痕 |
| 实现方式 | Service 层手动 diff |
| 快照页 | V2 |

### 9.2 留痕表

```sql
field_change_log (
    id              BIGINT PK,
    biz_type        VARCHAR(64),
    biz_id          BIGINT,
    field_name      VARCHAR(128),
    old_value       TEXT,
    new_value       TEXT,
    operator_id     BIGINT,
    operated_at     TIMESTAMPTZ
)
```

### 9.3 留痕范围

| 模块 | 留痕字段 |
|------|---------|
| 客户 | 全部可编辑字段 |
| 合同（商务补充） | 服务年份详情、回款状态 |

---

## 10. 回收站

| 规则 | 说明 |
|------|------|
| 可删除模块 | 仅合同 + 项目登记 |
| 删除方式 | 软删除（`deleted` 标记） |
| 回收站展示 | 统一页面，Tab 区分 |
| 恢复权限 | 仅超管 |
| 恢复冲突校验 | 若存在同 `contract_id + contract_year` 未删除记录，不可恢复 |
| 留痕 | 删除/恢复操作不做留痕 |

---

## 11. 时间规则

- 所有业务编号、申请单日期、页面展示时间统一使用 `Asia/Shanghai`
- 数据库使用 `TIMESTAMPTZ`（PostgreSQL 带时区时间戳）
- 后端：统一 dayjs + Asia/Shanghai
- 前端：统一时间格式化工具函数，强制 CST

---

## 12. 报告生成

| 决策 | 结论 |
|------|------|
| 模板引擎 | easy-template-x（MIT，纯 TypeScript，含图片/表格/循环） |
| 模板格式 | `.docx`，使用 `{变量}` 占位符 |
| PDF 转换 | Gotenberg 8（Docker 容器，HTTP API） |
| 模板管理 | 管理后台上传/维护模板文件 |
| 生成流程 | 数据填充 → 生成 .docx → POST 到 Gotenberg 转 PDF → 存 MinIO |

---

## 13. 离线终端（现场测评）

### 13.1 设计决策

| 决策 | 结论 | 理由 |
|------|------|------|
| 技术 | Electron + Vue 3 + better-sqlite3 | 与 Web 共享组件，AI 编码全 TypeScript |
| 不用 Tauri | 确认 | Rust 后端 AI 编码质量差，borrow checker 频繁失败 |
| 不用 PWA | 确认 | IndexedDB 不适合大量标准库数据，无原生文件系统访问 |
| 本地数据库 | SQLite（better-sqlite3） | 同步 API，60GB+ 支持，2000+ QPS |
| 与 Web 共享 | 共享 Vue 组件 + TypeScript 类型 + Zod schema | monorepo pnpm workspace |

### 13.2 数据交换方案

#### 包格式：`.npkg`（实际是 ZIP）

**项目导出包（平台 → 终端）：**
```
project-export-20260401.npkg
├── manifest.json         ← 元数据、schema 版本、文件校验和
├── data.sqlite           ← 项目信息 + 测评项 + 标准库
├── evidence/             ← 已有证据文件
└── signature.hmac        ← HMAC-SHA256 签名（防篡改）
```

**结果导出包（终端 → 平台）：**
```
results-20260403-assessorA.npkg
├── manifest.json         ← 元数据、测评师信息
├── data.sqlite           ← 变更记录 + base 版本（用于三路合并）
├── evidence/             ← 新采集的照片/截图
└── signature.hmac        ← HMAC-SHA256 签名
```

#### 数据流

```
平台导出                     终端离线工作                  平台导入
┌─────────┐                 ┌─────────────┐              ┌──────────────┐
│ 查询项目  │                │ 解压 .npkg  │              │ 解压 .npkg   │
│ 测评项    │                │ 导入 SQLite │              │ 验证 HMAC    │
│ + 标准库  │   ──.npkg──▶  │ 到本地工作库 │  ──.npkg──▶  │ 验证 schema  │
│          │   (U盘拷贝)    │             │  (U盘拷回)   │              │
│ 打包成    │                │ 测评师填写   │              │ 三路合并     │
│ SQLite    │                │ 拍照取证    │              │ 冲突队列审核 │
│ + HMAC    │                │ 各自提交部分 │              │ 合并入主库   │
└─────────┘                 └─────────────┘              └──────────────┘
```

#### 冲突合并策略

**核心思路：测评项按人分配 → 从根源上避免冲突**

```
测评师 A 负责：网络安全 1-50 项
测评师 B 负责：物理安全 51-100 项
→ 两人导出的结果不会冲突
```

**万一冲突：三路合并**

| 情况 | 处理 |
|------|------|
| 终端没改（theirs == base） | 保留平台值 |
| 平台没改（ours == base） | 采用终端值 |
| 都改成一样 | 无冲突 |
| 非关键字段冲突（备注） | 按时间戳 last-write-wins |
| 关键字段冲突（合规评分） | 进冲突队列，人工审核 |
| 附件 | 永远合并（union），UUID 文件名防碰撞 |

#### 数据完整性

| 层 | 机制 | 说明 |
|----|------|------|
| 防损坏 | SHA-256 校验和（manifest.json 内） | 每个文件独立校验 |
| 防篡改 | HMAC-SHA256 签名 | 平台持有密钥 |
| 版本兼容 | `schema_version` + `min_compatible_version` | 终端拒绝不支持的版本 |
| 审计 | 每次导入/导出写 audit_log | 记录包哈希、时间、操作人 |

---

## 14. AI 能力集成

### 14.1 架构原则

```
当前：所有 AI 能力在 NestJS 进程内解决
未来：仅当需要 GPU 推理或模型训练时，按需加 Python FastAPI 微服务
```

### 14.2 技术方案

```
┌──────────────────────────┐
│     NestJS 主后端         │
│                          │
│  Vercel AI SDK 6.0       │ ← Agent 编排、tool calling、MCP
│  ollama-js               │ ← 本地 LLM 调用
│  onnxruntime-node        │ ← OCR（PaddleOCR ONNX 模型）
│  LangChain.js            │ ← RAG 检索增强（按需）
│                          │
└────────┬─────────────────┘
         │ HTTP
         ▼
┌──────────────────────────┐
│  Ollama（Docker 容器）    │ ← 运行 Qwen/Llama 等本地模型
└──────────────────────────┘

未来按需加：
┌──────────────────────────┐
│  FastAPI 微服务（Docker） │ ← GPU OCR / 模型微调 / 复杂 RAG
└──────────────────────────┘
```

### 14.3 AI 功能路线

| 阶段 | 能力 | 用途 |
|------|------|------|
| V1 | 无 AI | 先跑通业务流程 |
| V2 | Ollama 集成 | 报告内容辅助生成、模板智能填充 |
| V2 | OCR | 扫描件自动识别公安登记证明 |
| V3 | Agent | 自动化审核辅助、数据质量检查 |
| V3+ | GPU 推理 | 复杂文档理解、大批量 OCR |

---

## 15. V1 / V2 边界

### V1 必须包含
- 登录：账号密码 + 钉钉登录
- RBAC 权限体系（纯角色驱动，CASL）
- 等保 13 节点全链路跑通
- 质量审核自动选人 + 回避机制
- 现场测评多人协作
- 文件上传 + 跨节点可见
- 系统内通知（SSE + 仪表盘集成）
- 合同/项目登记回收站
- 字段级留痕
- 报告模板生成（easy-template-x + Gotenberg）
- 工作流表单配置（管理后台）

### V2 规划
- 离线测评终端（Electron）
- 离线数据交换（.npkg 包）
- AI 辅助（Ollama + OCR）
- 历史快照页
- 钉钉消息通知
- 工作流可视化编辑器（钉钉风格）
- 运维/培训/渗透流程接入
- 测评项标准库（等保 2.0）
- 报告模板可视化配置

---

## 16. 实现节奏

```
Phase 1 — 骨架
├── Monorepo 搭建（pnpm workspace + shared 包）
├── NestJS 后端骨架（认证 / RBAC / CASL / Drizzle）
├── Vue 3 前端骨架（动态路由 / v-permission / SSE）
├── 数据 CRUD：客户 → 合同 → 项目登记（含系统明细）
├── 工作流引擎：7 表 + 5 种 NodeHandler
└── 审核流跑通：合同审核 + 项目审核

Phase 2 — 全链路
├── 公安登记 + 现场测评（多人协作）
├── 质量审核（自动选人 + 回避）
├── 报告编制 + 报告审核
└── 材料归档 + 回收站

Phase 3 — 报告 + 体验
├── 报告模板管理 + easy-template-x 生成 + Gotenberg PDF
├── 字段级留痕
├── 工作流表单配置（管理后台）
└── 整体联调 + E2E 测试

Phase 4 — 离线终端
├── Electron 终端骨架（better-sqlite3 + 共享组件）
├── 数据导出/导入（.npkg 包）
├── 三路合并 + 冲突审核 UI
└── 终端 ↔ 平台联调

Phase 5 — AI 增强
├── Ollama 集成 + 报告辅助生成
├── OCR（PaddleOCR ONNX）
├── 工作流可视化编辑器
└── 其他业务线接入
```

---

## 附录 A：技术调研参考来源

### 技术选型
- [ai-coding-lang-bench：13 种语言 Claude Code 基准测试](https://github.com/mame/ai-coding-lang-bench) — TypeScript vs Java AI 生成效率对比
- [TypeScript 在 AI 时代的崛起（GitHub Blog）](https://github.blog/developer-skills/programming-languages-and-frameworks/typescripts-rise-in-the-ai-era-insights-from-lead-architect-anders-hejlsberg/) — 类型系统作为 AI 护栏
- [NestJS vs Spring Boot（BetterStack）](https://betterstack.com/community/guides/scaling-nodejs/nestjs-vs-spring-boot/) — 框架对比
- [Drizzle vs Prisma vs TypeORM](https://dev.to/sasithwarnakafonseka/best-orm-for-nestjs-in-2025-drizzle-orm-vs-typeorm-vs-prisma-229c) — ORM 选型

### 权限模型
- [芋道（Yudao）DataPermission 设计](https://doc.iocoder.cn/data-permission/) — 数据权限拦截器参考
- [RuoYi 权限设计分析](https://www.cnblogs.com/kuangdaoyizhimei/p/14419180.html) — @DataScope 注解方案

### 工作流引擎
- [Workflow Patterns — WCP-27](http://www.workflowpatterns.com/patterns/control/new/wcp27.php) — 多实例任务完成模式
- [Camunda 流程版本管理](https://docs.camunda.io/docs/components/best-practices/operations/versioning-process-definitions/) — 版本锁定策略
- [ExceptionNotFound 工作流数据库设计](https://exceptionnotfound.net/designing-a-workflow-engine-database-part-4-states-and-transitions/) — 表驱动引擎参考
- [StavinLi/Workflow-Vue3](https://github.com/StavinLi/Workflow-Vue3) — 钉钉风格审批流编辑器

### 文档生成
- [easy-template-x（GitHub）](https://github.com/alonrbar/easy-template-x) — MIT TypeScript Word 模板引擎
- [Gotenberg（GitHub）](https://github.com/gotenberg/gotenberg) — Docker PDF 转换服务
- [docxtemplater 定价](https://docxtemplater.com/pricing/) — 图片模块付费

### 离线终端
- [Electron vs Tauri（DoltHub）](https://www.dolthub.com/blog/2025-11-13-electron-vs-tauri/) — 桌面框架对比
- [better-sqlite3（GitHub）](https://github.com/WiseLibs/better-sqlite3) — Node.js SQLite
- [SQLite 作为应用文件格式](https://www.sqlite.org/appfileformat.html) — 官方推荐

### 数据交换
- [离线同步与冲突解决模式](https://www.sachith.co.uk/offline-sync-conflict-resolution-patterns-architecture-trade%E2%80%91offs-practical-guide-feb-19-2026/) — 三路合并
- [Salesforce 冲突检测](https://developer.salesforce.com/docs/platform/mobile-sdk/guide/entity-framework-conflict-detection.html) — 字段级合并

### AI 集成
- [Vercel AI SDK 6.0](https://vercel.com/blog/ai-sdk-6) — NestJS 官方支持
- [Ollama JavaScript 库](https://github.com/ollama/ollama-js) — Node.js LLM 集成
- [onnxruntime-node](https://onnxruntime.ai/docs/get-started/with-javascript/node.html) — Node.js OCR 推理
- [纯 JS PaddleOCR](https://github.com/VrajVyas11/Multilingual_PureJS_Based_OCR) — 无 Python 依赖 OCR

---

## 附录 A：增量决策记录

### A.1 财务模块（2026-04 上线）

新增 4 张前端菜单 + 2 个工作流定义：

| 菜单 | 后端模块 | 工作流 | 关键能力 |
|------|---------|--------|---------|
| 合同财务 | `payment-record` | — | 合同回款记录 CRUD（财务角色专用） |
| 开票申请 | `invoice` | `FIN_INVOICE` | 申请人提交 → 财务审核 → 已开票/需修改；与合同 + 系统明细多对多 |
| 费用请款 | `expense` | `FIN_EXPENSE` | 请款人 → 部门负责人 → 财务 → 抄送董事长（双层审核） |
| 结算管理 | `settlement` | — | 按合同维度聚合：开票总额 + 回款总额 + 费用总额 + 毛利计算 |

**累计校验并发安全**：开票/请款金额累计校验使用 `SELECT ... FOR UPDATE` 行锁，避免并发提交超合同金额（A 批次修复，commit fb0bedd）。

### A.2 PM 资格独立化（2026-04-29）

**问题**：原系统将 PM 资格隐式绑定到"中/高级测评师"等级 → 业务上中级测评师不一定都能担任 PM（如颜佳威）。

**方案**：
- 引入 `project_manager` 角色作为"资格标志位"，**不附带任何权限/资源**，仅作筛选标记。
- DIRECTOR_REVIEW 节点 PM 候选过滤：`project_manager` ∩ `senior_assessor`/`middle_assessor`，按等级分组显示。
- 持有 PM 资格的人**必须同时持有**某等级测评师角色（菜单/权限由测评师角色提供）。
- 具体项目的 PM 指派关系仍由 `project_member.roleType='PM'` 实现（运行时关系，与角色资格独立）。

**与历史方案区别**：

| 维度 | 历史（已废弃） | 当前（2026-04 起） |
|------|--------------|------------------|
| `project_manager` 角色 | 固定权限角色，自动赋予所有 PM | 资格标志位，由项目主管手工授予 |
| PM 候选 | senior + middle assessor 自动取 | senior + middle assessor ∩ project_manager |
| 删除条件 | 测评师身份废弃同时删 | 与等级独立维护 |

### A.3 chairman（董事长）预留角色（2026-04-29）

需求：业务方需要能给"董事长"账号挂角色，但具体权限/菜单等待管理员后台手工配置。

方案：
- 在 `iam_role` 中预留 `chairman` 角色（system_flag=TRUE）
- 不预先 grant 任何 `iam_role_permission` / `iam_role_resource`
- 通过 seed.sql 第 7 步的"非 super_admin 自动有 dashboard"规则，chairman 默认可登录看 dashboard
- 后续按需在管理端"角色管理"页面挂权限

### A.4 m-to-n 绑定表唯一约束修复（migration 0016）

**问题**：`user_role` / `iam_role_permission` / `iam_role_resource` 三张关联表只有自增主键 `id`，缺 `(user/role, role/perm/resource)` 复合唯一约束。导致 seed.sql 中的 `ON CONFLICT DO NOTHING` 因找不到约束而失效，每次 deploy 都重复插入一行。生产累积出 4 倍重复（876/303、488/182）。

**修复**（migration `0016_lame_baron_zemo.sql`）：

```sql
-- 1. 先去重（保留 id 最小的那条）
DELETE FROM iam_role_permission WHERE id NOT IN (SELECT MIN(id) FROM iam_role_permission GROUP BY role_code, permission_code);
DELETE FROM user_role WHERE id NOT IN (SELECT MIN(id) FROM user_role GROUP BY user_id, role_code);
DELETE FROM iam_role_resource WHERE id NOT IN (SELECT MIN(id) FROM iam_role_resource GROUP BY role_code, resource_key);
-- 2. 加唯一约束
ALTER TABLE ... ADD CONSTRAINT ... UNIQUE (...);
```

后续 seed.sql 重复执行将真正幂等。

### A.5 业务编号 `platform_no` + 回收站基础设施重构（2026-05-07）

**A.5.1 注册平台业务编号（migration 0017）**

需求：用户视角的注册平台主标识应当是业务编号（`P-0001` 格式）而非裸 ID。

设计：
- `registration_platform.platform_no VARCHAR(32) UNIQUE` 字段
- 单行 `platform_serial` 表（与 `contract_serial` 同模式）维护自增计数器
- `platform.service.create / batchCreate` 用 UPSERT `platform_serial` 生成编号，与 `auto.handler.generateContractNo` 保持一致的并发安全模式
- 一次性 backfill 给历史 156 条按 id ASC 赋号

> ⚠ 业务编号也会跳号（PG sequence 单调递增是固有行为）。它解决"用户视角看 P-0001 比 id=1 友好"，不解决"绝对连续"。

**A.5.2 回收站基础设施（无 schema 变更）**

**问题（之前发现）**：
- `recycle_bin` 表只有读路径（list/restore/permanentDelete），**从无任何写路径**
- `contract / project / platform / contract_group` 的 `.remove` 都只 `set deleted=true`，从不写 recycle_bin
- 历史"软删数据"全部不在 recycle_bin —— 主列表和回收站都看不到（死区）
- `BUSINESS_RULES.md` 第 5 章描述"回收站永久保留" — 与代码完全脱节，是 dead doc

**修复**：
- `RecycleService.softDelete(opts)` 通用入口：业务侧通过 `applyDelete` 回调提供"打 deleted 标记 + 连带子记录"动作，与 INSERT recycle_bin 同事务执行
- `restore` 加 PLATFORM / CONTRACT_GROUP 分支 + CONTRACT / PROJECT_REGISTER 唯一性校验 + 子记录连带恢复
- `permanentDelete` 加 4 种 bizType 真物理删除原表（含子记录）
- `findPage` 增强：JOIN `user_account` 返回 `deletedByName`
- 4 处 `remove` 改造（contract / contract_group / project / platform），3 个模块 import RecycleModule
- 前端 RecycleBin.vue：4 个 tab + 删除人/原 ID 列 + 危险操作二次确认
- 一次性 backfill SQL 把现有 deleted=TRUE 的记录补写进 recycle_bin（prod 3 条：1 contract + 1 group + 1 platform）

**长期纪律**：
> 新增任何带 `deleted` 字段的业务表，**`.remove` 必须走 `RecycleService.softDelete`**，不允许业务侧直接 `set deleted=true`。否则会重新出现"孤立软删"反模式。
