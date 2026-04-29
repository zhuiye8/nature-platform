# 项目代码 7 维度 Review · 整合汇总

> 整合时间：2026-04-29
> 调研方式：分两批 7 个 thorough Explore agent 独立扫描，每个写一份维度报告
> 涉及文件：~150 个（后端 + 前端 + SQL）

---

## 一、各维度评分与发现总览

| 维度 | 文件 | 评分 | P0 | P1 | P2 | 主要风险 |
|---|---|:---:|:---:|:---:|:---:|---|
| 1 数据权限 | 01-data-permission.md | 8.2/10 | 0 | 3 | 3 | file/assessment-file/compile-file 缺 PermissionGuard |
| 2 业务流程 | 02-business-flow.md | 8.5/10 | 0 | 5 | 3 | 5 处事件 listener 覆盖缺口 |
| 3 审核流程 | 03-review-flow.md | 8.5/10 | 1 | 3 | 5 | REPORT_COMPILE 无 REJECT 转换；财务审核按钮缺 |
| 4 代码质量 | 04-code-quality.md | 7.5/10 | 4 | 11 | 28 | 19 处 any 滥用；3 个 >1000 行 service；列表页大量重复 |
| 5 中文映射 | 05-i18n-mapping.md | 7.5/10 | 0 | 3 | 2 | status-map 缺财务状态；5 文件本地副本 |
| 6 自洽性 | 06-consistency.md | 7.9/10 | 0 | 3 | 2 | DECIMAL 类型不一致；7 个状态枚举未定义 |
| 7 鲁棒性 | 07-robustness.md | 6.5/10 | 11 | 13 | — | 并发累计漏洞 / Listener 异常吞掉 / signal 失败无回滚 |

**总计**：P0 × 16 / P1 × 41 / P2 × 43 = **100 条 finding**

---

## 二、跨维度共性问题（同一根因，多个 agent 发现）

下面 5 个问题被多个维度独立扫到，**优先级最高**（说明根因影响面广）。

### 共性 1 · statusLabel 重复定义在 5 个页面
- **维度 4** Q4.4：5 个 .vue 文件各自定义本地 `Record<string, string>` 副本
- **维度 5** P1-1：财务状态在 `status-map.ts` 完全未注册，导致页面被迫本地副本
- **维度 6** P1：前端缺少 7 个状态枚举定义
- **影响**：修文案要改 5 处；类型不安全；维护成本高
- **关联文件**：`status-map.ts` / `enums.ts` / 5 个页面（InvoiceList/InvoiceDetail/ExpenseList/ExpenseDetail/ContractList）

### 共性 2 · 财务审核入口路径不全
- **维度 3** P1-2：ActionButton.vue 的 NODE_ACTION_MAP 没加 FIN_INVOICE_REVIEW / FIN_EXPENSE_*
- **维度 5** P2-1：DashboardPage businessRouteMap 缺 4 个普通节点（DEPT_REVIEW 等）+ 财务 3 节点已加
- **影响**：财务审核人不能从列表"审核"按钮直达，必须走待办中心
- **关联文件**：`ActionButton.vue` / `DashboardPage.vue`

### 共性 3 · Listener 事务/异常/幂等性缺失
- **维度 2** F2.2：contract.listener 无事务保护
- **维度 2** F2.3：project.listener INSERT 无 ON CONFLICT
- **维度 7** P0-1：invoice.listener 异常吞掉
- **维度 7** P0-8：listener 异步执行 → workflow commit 后 listener 失败状态不同步
- **影响**：业务表与 wf_instance 状态不一致；重复事件 → 唯一约束冲突 → listener 报错
- **关联文件**：所有 8 个 listener.ts

### 共性 4 · DECIMAL 金融类型前后端不一致
- **维度 6** P1：DECIMAL 后端返 string，前端 form 要 number
- **维度 7** P0-4：paymentAmount 转换无 NaN 防护
- **影响**：精度丢失风险；NaN 比较永远 false → 状态判定错误
- **关联文件**：所有财务相关 service + api/*.ts

### 共性 5 · 累计校验竞态 + 提交无整体事务
- **维度 7** P0-5：开票申请累计校验并发漏洞（两个用户同时提交都过校验）
- **维度 7** P0-9：invoice.submit 验证/startInstance/UPDATE status 三步分离
- **维度 7** P0-7：工作流任务池领取竞态
- **影响**：金额突破合同上限；状态不一致
- **关联文件**：`invoice.service.ts` / `expense.service.ts` / `workflow.service.ts`

---

## 三、🔴 P0 严重问题清单（16 条 — 必须立即修）

### 数据权限（0 条）
（无 P0）

### 业务流程（0 条）
（无 P0）

### 审核流程（1 条）
1. **REPORT_COMPILE 无 REJECT 转换** — `seed.sql:208-213`，报告编制人无法驳回回退

### 代码质量（4 条）
2. **19 处 `as any` 滥用** — response.interceptor.ts / archive.service.ts / workflow.service.ts 等
3. **批量 `as unknown as` 双重转换** — contract/expense/workflow services
4. **3 个 service 超 1000 行** — contract:1382 / workflow:1295 / project:1191
5. **statusLabel 映射重复** — 5 个 Vue 页面（也是共性 1）

### 鲁棒性（11 条）
6. Listener 异常吞掉（`invoice.listener.ts:64-82`）
7. Workflow signal 失败无回滚（`contract.service.ts:861-900`）
8. Archive signal 异常处理（`contract.service.ts:1003-1006`）
9. paymentAmount NaN 无边界检查（`payment-record.service.ts:66-74`）
10. **并发开票申请累计超额**（`invoice.service.ts:241-242`）⚠ 严重
11. 系统额度竞态更新（`project.service.ts:406`）
12. 工作流任务池竞态（`workflow.service.ts:261-281`）
13. Listener 事务一致性（`invoice.listener.ts:37-83`）
14. Invoice submit 无整体事务（`invoice.service.ts:224-259`）
15. ProjectListener 插入冲突回滚（`project.listener.ts:66-100`）
16. Archive 不可逆操作权限不足（`contract.service.ts:937-1009`）

---

## 四、🟡 P1 应改问题清单（41 条 — 简化展示，按维度归类）

### 数据权限（3 条）
1.1 file.controller.ts 缺 PermissionGuard（`file.controller.ts:22`）
1.2 assessment-file.controller.ts 缺 PermissionGuard（`assessment-file.controller.ts:21`）
1.3 compile-file.controller.ts 缺 PermissionGuard（`compile-file.controller.ts:21`）

### 业务流程（5 条）
2.1 materialArchive status 推进缺 listener
2.2 contract.listener 无事务保护
2.3 project.listener INSERT 无 ON CONFLICT
2.4 project.member.assigned 事件无订阅者（被指派的人无通知）
2.5 workflow.instance.completed 事件缺失（项目完结无全局通知）

### 审核流程（3 条）
3.1 财务审核 ActionButton 映射缺失（与共性 2 重叠）
3.2 TECH/CONTENT/REPORT_ASSIGN REJECT 不累加 roundNo（不一致）
3.3 FINAL_REVIEW REVIEW 特殊逻辑硬编码（难维护）

### 代码质量（11 条）
4.1 getRoleCodes 在 6 个 service 重复
4.2 已注释代码块（notification.listener.ts:87）
4.3 Vue 列表页 fetchData/handleSearch/handleReset 12+ 页重复
4.4 formatAmount 在 3 个财务页面重复
4.5 EXPENSE_TYPES `as unknown as string[]` 不安全
4.6 后端"先 select 再 update"模式未抽象
4.7 toBeiijngTime 函数名拼写错误（应为 Beijing）
4.8 Contract logFieldChanges 复杂度高
4.9 前端 API 层缺明确返回类型
4.10 无统一错误处理规范
4.11 缺集中错误码定义

### 中文映射（3 条）
5.1 财务状态/角色/节点 status-map 缺失（与共性 1 重叠）
5.2 SQL 角色/节点中文与前端不一致（tech_reviewer "整体技术审核员" vs "技术审核人"）
5.3 通知文案风格不一（INVOICE "需修改" vs EXPENSE "被驳回（部门审核）"）

### 自洽性（3 条）
6.1 DECIMAL 后端 string vs 前端 number（与共性 4 重叠）
6.2 7 个状态枚举前端未定义（INVOICE_STATUS / EXPENSE_STATUS 等）
6.3 Expense 条件必填规则分散在 service 层（partner_* 字段，DTO 应用 @ValidateIf）

### 鲁棒性（13 条）
7.1 find[0] undefined 无检查（46 处）
7.2 ContractService N+1（reviewer label）
7.3 ProjectService 文件加载 N+1
7.4 NotificationService SSE 内存泄露（断开未清理）
7.5 ReminderScheduler 多实例并发竞态
7.6 类型安全 any 滥用（与 4.x 重叠）
7.7 Workflow variables 无类型（Record<string, any>）
7.8 DTO 校验不足（paymentAmount 可负数）
7.9 SQL 输入无长度限制
7.10 数字范围检查缺失（金额可 0/负）
7.11 时间边界时区问题（settlement.service.ts:62-65）
7.12 连接池无超时配置
7.13 ProjectRegister 变更无审计

---

## 五、🟢 P2 待优化问题清单（43 条 — 列出关键 10 条）

- F2.6 police_register 状态依赖文件上传事件
- F2.7 PROJECT_REGISTER roundNo 推进未文档化
- F3.5 SAME_PROJECT 回避 fallback 无日志
- F3.6 驳回缺详细理由通知
- F3.9 整改流程报告编制人恢复逻辑复杂
- 1.4 settlement.service 无角色可见性过滤（**注意：维度 1 标 P2 但维度 7 标 P0，应升级**）
- 1.5 invoice 权限码不一致（findPage 用 `invoice:apply` 应用 `invoice:list`）
- 1.6 review-opinion.controller.ts 无权限检查
- 6.4 systems 数组缺 @MinLength(1)
- 6.5 ServiceContent 无 DB CHECK 约束
- 4.16-4.43 28 条小优化（命名/注释/规范）

---

## 六、推荐修复批次

### 🚨 批次 A · 紧急 P0（数据/资金安全）— 1 天

| # | 修复 | 维度 |
|---|---|---|
| A1 | settlement 加权限校验 + 1.6 review-opinion 加权限 | 1 |
| A2 | 累计开票校验加 `SELECT FOR UPDATE` 行锁 | 7 |
| A3 | invoice/expense submit 包整体事务（startInstance 失败回滚 status）| 7 |
| A4 | Listener 加 try/catch + 不吞通知错误 | 7 |
| A5 | paymentAmount NaN 边界（`Number(x ?? 0)` + `<= 0` 校验） | 7 |
| A6 | REPORT_COMPILE 加 REJECT 转换（或显式禁止） | 3 |

### 🟡 批次 B · 共性问题清理（用户体验+可维护性）— 1.5 天

| # | 修复 | 维度 |
|---|---|---|
| B1 | status-map.ts 补全财务 status / 节点 / 角色 + 删 5 处本地副本 | 4+5 |
| B2 | enums.ts 补 7 个状态枚举 + 后端 DTO 用 @IsIn 共享枚举 | 6 |
| B3 | ActionButton + DashboardPage 路由表合并到一处 + 加财务 3 节点 | 3+5 |
| B4 | DECIMAL 类型统一（前端 interface 改 string，formatAmount 兜底）| 6+7 |
| B5 | file/assessment-file/compile-file 加 PermissionGuard | 1 |

### 🟢 批次 C · 业务流程加固（修事件覆盖缺口）— 1 天

| # | 修复 | 维度 |
|---|---|---|
| C1 | archive.listener.ts 新建（订阅 MATERIAL_ARCHIVE node.completed → status='ARCHIVED'）| 2 |
| C2 | project.listener INSERT 加 ON CONFLICT DO NOTHING | 2 |
| C3 | notification.listener 订阅 `project.member.assigned`（成员被指派通知）| 2 |
| C4 | workflow 加 `workflow.instance.completed` 事件 + 通知（项目完结全局通知）| 2 |
| C5 | CONTRACT_REVIEW REJECT 加销售通知 | 2+3 |

### 🔵 批次 D · 重构与代码质量（中长期，~3 天）

| # | 修复 | 维度 |
|---|---|---|
| D1 | 抽 `RoleService.getRoleCodes()`（消除 6 处重复） | 4 |
| D2 | 抽 `useDataList()` composable（消除 12 个列表页重复） | 4 |
| D3 | 19 处 `any` → 明确类型（API 层 + service 层） | 4+7 |
| D4 | contract.service / workflow.service / project.service 拆分（>1000 行） | 4 |
| D5 | N+1 优化（reviewer label / 文件附件批量加载） | 7 |
| D6 | SSE 流断开清理 + 连接池超时配置 | 7 |

### ⚪ 批次 E · 边角优化（按需）— 0.5 天

- 拼写错误（toBeiijngTime → toBeijingTime）
- 注释/文档同步
- DTO @Min @Max 边界
- 时区统一处理

---

## 七、给 Daisy 的决策建议

**强烈建议立刻做**：批次 A（1 天）+ 批次 B（1.5 天）= 2.5 天
- 批次 A 解决数据安全/资金风险（并发漏洞、权限漏洞、状态不一致）
- 批次 B 一次性解决用户最频繁碰到的"修个状态文案要改 5 处"

**建议安排做**：批次 C（1 天）
- 修事件 listener 缺口，让"项目归档完成"、"成员被指派"等场景能真正发通知

**视情况做**：批次 D（3 天）+ 批次 E（0.5 天）
- D 是技术债清理，不影响功能但维护成本高
- E 是细节优化

**建议节奏**：
- 第 1 周：批次 A + B（关键风险全清）
- 第 2 周：批次 C
- 第 3-4 周：批次 D
- 持续：批次 E

---

## 八、文件索引

```
check/
├── README.md                  ← 调研规则与进度
├── 00-summary.md              ← 本文件（整合汇总）
├── 01-data-permission.md      ← 数据权限（22 controller + 13 service 全扫）
├── 02-business-flow.md        ← 业务流程（4 工作流 + 8 listener + 13 service）
├── 03-review-flow.md          ← 审核流程（5 handler + 21 分配规则）
├── 04-code-quality.md         ← 代码质量（150 个文件，43 条 finding）
├── 05-i18n-mapping.md         ← 中文映射（status-map + 通知文案 + SQL）
├── 06-consistency.md          ← 自洽性（DTO ↔ interface 全核对）
└── 07-robustness.md           ← 鲁棒性（错误/并发/N+1/类型 9 子维度）
```

---

**结论**：项目整体架构合理，业务流程闭环完整。但有 **5 个跨维度共性问题** 需要从根源修复（statusLabel 重复 / 财务审核入口 / Listener 异常 / DECIMAL 类型 / 累计校验并发），否则会被反复"打地鼠式"修。建议从批次 A+B 开始系统化清理。
