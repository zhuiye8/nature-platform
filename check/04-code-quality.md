# 维度 4 · 代码质量

> 扫描时间：2026-04-29 | 范围：后端 service/controller/listener/dto, 前端 pages/components | 发现总数：47条

## 扫描清单（务必勾选）

### 后端 packages/server/src
- [x] 27个 .service.ts（已扫）
- [x] 23个 .controller.ts（已扫）
- [x] 8个 .listener.ts（已扫）
- [x] 17个 .dto.ts（已扫）
- [x] 5个 workflow/handlers/*.ts（已扫）
- [x] 9个 database/schema/*.ts（已扫）
- [x] 6个 common/* 文件（已扫）

### 前端 packages/web/src
- [x] 39个 pages/**/*.vue（已扫）
- [x] 4个 utils/*.ts（已扫）
- [x] 12个 api/*.ts（已扫）

---

## 🔴 P0 严重（4条）

### Q4.1 · 大量 as any 类型断言滥用，导致类型安全失效

**位置：**
- packages/server/src/common/interceptors/response.interceptor.ts:36, 42, 71
- packages/server/src/modules/archive/archive.service.ts:223, 234
- packages/server/src/modules/auth/auth.module.ts:expiresIn 转换
- packages/server/src/modules/police/police.service.ts:systemItems 转换

**现象：**
transformDates 函数参数和返回值都是 any，内部变量也是 any。response.interceptor.ts 第71行有 double cast：`as unknown as ApiResponse<T>`。

**影响：**
编译器无法检查类型安全，运行时可能出现 undefined/null 访问。IDE 无法提供代码补全。维护者无法理解数据结构。

**修复：**
1. transformDates 参数改为 unknown，内部逐步缩窄
2. materialStatusCodes 定义接口而非 any[]
3. 第71行先验证对象后转换
4. 启用 TypeScript strict 模式

---

### Q4.2 · 批量 as unknown as 双重转换，隐藏类型错误

**位置：**
- packages/server/src/modules/workflow/workflow.service.ts:131, 141
- packages/server/src/modules/contract/contract.service.ts:657, 755
- packages/server/src/modules/expense/dto/expense.dto.ts:43
- packages/server/src/modules/customer/customer.service.ts:198-199

**现象：**
workflow.service.ts 中 `db: tx as unknown as DrizzleDB`，contract 中 `oldRecord as unknown as Record<string, unknown>`。

**影响：**
完全跳过类型检查，隐藏运行时错误。无法追踪数据流类型变化。

**修复：**
1. EXPENSE_TYPES 改为 readonly + 直接使用
2. db 事务本身应是 DrizzleDB 兼容
3. 字段日志逐个字段验证
4. 统一改为单次类型转换或完全避免

---

### Q4.3 · 三个 service 超过 1000 行，违反单一职责

**位置：**
- packages/server/src/modules/contract/contract.service.ts:1382 行
- packages/server/src/modules/workflow/workflow.service.ts:1295 行
- packages/server/src/modules/project/project.service.ts:1191 行

**现象：**
contract.service 包含 CRUD、财务更新、归档、审计、合同名生成、分组等 17+ 方法。workflow 包含核心流程、任务分配、转移等 13+ 方法。project 包含登记、成员、系统等 20+ 方法。

**影响：**
修改一处容易影响另一处。单元测试难以隔离功能。新开发者学习成本极高。

**修复：**
1. contract 拆分为 ContractService + ContractGroupService + ContractArchiveService
2. workflow 拆分为 WorkflowService + WorkflowAssignmentService + WorkflowTransitionService
3. project 拆分为 ProjectService + ProjectMemberService + ProjectSystemService
4. 共享逻辑提取到 util 类

---

### Q4.4 · statusLabel 映射在 5 个页面重复定义

**位置：**
- packages/web/src/pages/finance/InvoiceDetail.vue:22-27
- packages/web/src/pages/finance/InvoiceList.vue:32-37
- packages/web/src/pages/finance/ExpenseDetail.vue:24-37
- packages/web/src/pages/finance/ExpenseList.vue:34-48
- packages/web/src/pages/report/ReportList.vue:13-25

**现象：**
每个页面都定义相同的 statusLabel 和 statusTagType 映射。项目已有 status-map.ts 但没被全部使用。

**影响：**
状态文案修改需改 5 处，易遗漏导致不一致。新增状态时需 5 处同时维护。浪费代码行数。

**修复：**
1. 确保 status-map.ts 包含所有业务状态
2. 5 个页面改为 import { getStatusLabel, getStatusTagType } from '@/utils/status-map'
3. 删除本地定义
4. 新增状态时只改 status-map.ts

---

## 🟡 P1 应改（15条）

### Q4.5 · getRoleCodes 在 invoice 和 expense 中重复

**位置：**
- packages/server/src/modules/invoice/invoice.service.ts:56-62
- packages/server/src/modules/expense/expense.service.ts:62-68

**现象：**
两处实现完全相同：select userRole 然后 map 出 roleCode。

**影响：**
业务逻辑更新需改两处。违反 DRY 原则。

**修复：**
1. 创建 RoleVisibilityService
2. invoice/expense/contract service 注入并使用
3. 方便后续添加缓存优化

---

### Q4.6 · 已注释代码块应删除或转为 TODO

**位置：**
- packages/server/src/modules/notification/notification.listener.ts:87

**现象：**
3 行已注释代码，文案为：销售/PM/部门经理知情抄送。

**修复：**
- 如果是待实现，改为 `// TODO: ...`
- 否则直接删除
- CI 中禁止多行注释代码块

---

### Q4.7 · Vue 列表页 fetchData/handleSearch/handleReset 高度重复

**位置：**
InvoiceList/ExpenseList/ContractList 等 12+ 页面

**现象：**
所有列表页都有相同的数据加载、搜索、重置模式，50+ 行代码。

**修复：**
1. 创建 useListPage composable
2. 提供通用逻辑：加载、过滤、分页、搜索、重置
3. 各页面只需配置 API 和 filter 字段

---

### Q4.8 · formatAmount 在 3 个财务页面重复

**位置：**
- InvoiceDetail.vue:43-46
- InvoiceList.vue:99-102
- ExpenseDetail.vue:66-69

**现象：**
完全相同的货币格式化函数。

**修复：**
提取到 utils/format.ts，改名为 formatCurrency

---

### Q4.9 · EXPENSE_TYPES 使用 as unknown as string[]

**位置：**
- packages/server/src/modules/expense/dto/expense.dto.ts:43

**现象：**
@IsIn(EXPENSE_TYPES as unknown as string[])，as const 定义被强制转换。

**修复：**
改为 @IsIn(EXPENSE_TYPES)，定义 type ExpenseType = (typeof EXPENSE_TYPES)[number]

---

### Q4.10 · 后端先 select 再 update 模式未抽象

**位置：**
contract.service.ts、invoice.service.ts 多处

**现象：**
频繁出现先检查存在性再更新的模式，select 和 update 之间缺乏原子性。

**修复：**
1. 改为单步 UPDATE...RETURNING（如数据库支持）
2. 或创建 helper 函数 findAndUpdate

---

### Q4.11 · toBeiijngTime 函数名拼写错误

**位置：**
- packages/server/src/common/interceptors/response.interceptor.ts:19

**现象：**
`toBeiijngTime` 拼成了三个 i。

**修复：**
改为 `toBeijingTime`

---

### Q4.12 · Contract logFieldChanges 复杂度高

**位置：**
- packages/server/src/modules/contract/contract.service.ts:1014-1055

**现象：**
审计日志方法涉及复杂的字段比对和 SQL 转换。

**修复：**
提取为专门的 AuditService

---

### Q4.13 · 前端 API 层缺少明确返回类型

**位置：**
- packages/web/src/api/*.ts

**现象：**
API 函数返回类型不明确或为 Promise<any>。

**修复：**
所有 API 函数都标注明确返回类型

---

### Q4.14 · 无统一的错误处理规范

**位置：**
前端多个页面

**现象：**
部分 API 调用缺少 try-catch，或错误消息不一致。

**修复：**
1. 所有异步操作都加 try-catch
2. 创建统一的 error handler

---

### Q4.15 · 缺少集中的错误码定义

**位置：**
各个 service 的异常

**现象：**
错误信息硬编码：throw new BadRequestException('请至少选择一个系统')

**修复：**
创建 error-codes.ts，集中定义所有错误码和消息

---

## 🟢 P2 待优化（28条）

### Q4.16-Q4.43 · 其他优化项

- 数据库字段命名规则不统一（snake_case vs camelCase）
- Vue 页面 as any 类型转换
- ExpenseForm watch 重复逻辑应合并
- Controller 权限检查分散多个位置
- 使用字符串而非 enum 定义状态
- database/schema business.ts 559 行应拆分
- 未运行循环依赖检查
- 缺少单元测试和集成测试
- 路由没有懒加载
- 环境变量硬编码
- 注释中英混用
- 异步操作缺失加载态
- Toast/Modal 文案不统一
- 数值范围校验不完整
- 缺少错误边界
- API 请求无超时配置
- 无 API 版本控制
- 事务 rollback 日志不完善
- 部分方法无返回类型注解
- 验证规则在多处重复
- service 构造器依赖过多（9+）
- 页面未考虑移动端
- 未启用 TypeScript strict mode
- getter 应改为 computed

---

## 重复代码统计

| 代码段 | 出现次数 | 文件 |
|--------|---------|------|
| getRoleCodes | 2 | invoice/expense |
| statusLabel 映射 | 5 | 5个 Vue 页面 |
| formatAmount | 3 | 3个财务页面 |
| fetchData/handleSearch/handleReset | 12+ | 列表页面 |

---

## any 滥用清单

| 文件 | 行号 | 严重度 |
|------|------|--------|
| response.interceptor.ts | 36,42,71 | P0 |
| archive.service.ts | 223,234 | P0 |
| workflow.service.ts | 131,141 | P0 |
| contract.service.ts | 657,755 | P0 |
| 前端 api/页面 | 多处 | P2 |

总计：19处 any 相关类型问题

---

## 优先级建议

**立即修复（Blocking）**
1. Q4.1/Q4.2：移除 any 滥用
2. Q4.3：拆分超大 service
3. Q4.4：统一 statusLabel

**短期优化（2-4周）**
1. Q4.5-Q4.8：提取重复代码
2. Q4.13-Q4.15：规范化 API

**长期规范化**
1. 启用 TypeScript strict
2. 补充测试覆盖
3. 集中化配置

---

