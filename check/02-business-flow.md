# 维度 2：业务流程 深度扫描报告

**扫描时间**: 2026-04-29
**扫描范围**: 4 条工作流完整性、闭环、跨模块依赖、事件链
**总体覆盖**: ~92%

---

## 扫描清单

### 工作流定义文件
- [x] scripts/seed.sql (line 191-235)
- [x] scripts/seed-finance-batch1.sql (FIN_INVOICE 工作流定义)
- [x] scripts/seed-finance-batch2.sql (FIN_EXPENSE 工作流定义)
- [x] packages/server/src/database/schema/workflow.ts

### 核心引擎 (10 个文件)
- [x] packages/server/src/modules/workflow/workflow.service.ts
- [x] packages/server/src/modules/workflow/workflow.controller.ts
- [x] packages/server/src/modules/workflow/transition.resolver.ts
- [x] packages/server/src/modules/workflow/assignment.service.ts
- [x] packages/server/src/modules/workflow/handlers/handler.interface.ts
- [x] packages/server/src/modules/workflow/handlers/simple.handler.ts
- [x] packages/server/src/modules/workflow/handlers/review.handler.ts
- [x] packages/server/src/modules/workflow/handlers/parallel-review.handler.ts
- [x] packages/server/src/modules/workflow/handlers/multi-assignee.handler.ts
- [x] packages/server/src/modules/workflow/handlers/auto.handler.ts

### 业务监听器 (8 个)
- [x] packages/server/src/modules/contract/contract.listener.ts
- [x] packages/server/src/modules/project/project.listener.ts
- [x] packages/server/src/modules/police/police.listener.ts
- [x] packages/server/src/modules/assessment/assessment.listener.ts
- [x] packages/server/src/modules/report/report.listener.ts
- [x] packages/server/src/modules/notification/notification.listener.ts
- [x] packages/server/src/modules/invoice/invoice.listener.ts
- [x] packages/server/src/modules/expense/expense.listener.ts

### 业务 Service
- [x] packages/server/src/modules/contract/contract.service.ts
- [x] packages/server/src/modules/project/project.service.ts
- [x] packages/server/src/modules/archive/archive.service.ts
- [x] packages/server/src/modules/invoice/invoice.service.ts
- [x] packages/server/src/modules/expense/expense.service.ts
- [x] packages/server/src/modules/settlement/settlement.service.ts（部分覆盖）

### 业务表 schema
- [x] packages/server/src/database/schema/business.ts

---

## 4 条工作流闭环检查矩阵

### 1. CONTRACT_FLOW（合同流程） ✅ 完整

| 节点 | 类型 | onEnter | Event | 出站 |
|------|------|--------|-------|------|
| CONTRACT_CREATE | SIMPLE | ✅ | SUBMIT | → REVIEW |
| CONTRACT_REVIEW | REVIEW | ✅ | APPROVE/REJECT | → AUTO / → CREATE |
| CONTRACT_AUTO_NUMBER | AUTO | ✅ | AUTO | → ARCHIVE |
| CONTRACT_ARCHIVE | SIMPLE | ✅ | SUBMIT | → END |

- 所有节点都有 onEnter handler
- Transition 覆盖完整
- 无死锁/孤儿节点

### 2. PROJECT_ASSESSMENT_FLOW（项目测评流程） ✅ 完整

| 节点 | 类型 | onEnter | 关键转移 |
|------|------|--------|---------|
| PROJECT_REGISTER | SIMPLE | ✅ | → DEPT_REVIEW / → DIRECTOR_REVIEW (skip_dept guard) |
| DEPT_REVIEW | REVIEW | ✅ | → DIRECTOR_REVIEW / → PROJECT_REGISTER |
| DIRECTOR_REVIEW | REVIEW | ✅ | → POLICE_REGISTER / → PROJECT_REGISTER |
| POLICE_REGISTER | SIMPLE | ✅ | → ON_SITE_ASSESSMENT |
| ON_SITE_ASSESSMENT | MULTI_ASSIGNEE | ✅ | → TECH_REVIEW / → REPORT_ASSIGN (skip_to_final) |
| TECH_REVIEW | REVIEW | ✅ | → CONTENT_REVIEW / → ON_SITE |
| CONTENT_REVIEW | PARALLEL_REVIEW | ✅ (3 slots) | → REPORT_ASSIGN / → ON_SITE |
| REPORT_ASSIGN | REVIEW | ✅ | → REPORT_COMPILE / → ON_SITE |
| REPORT_COMPILE | REVIEW | ✅ | → FINAL_REVIEW |
| FINAL_REVIEW | REVIEW | ✅ | → MATERIAL_ARCHIVE / → ON_SITE |
| MATERIAL_ARCHIVE | SIMPLE | ✅ (pool) | → END |

- 所有 11 个节点都有 onEnter handler
- 含 guard 条件（skip_dept_review / skip_to_final）
- 风险：MATERIAL_ARCHIVE 节点完成时 status 推进缺 listener（见 P1）

### 3. FIN_INVOICE（开票申请） ✅ 完整

| 节点 | onEnter | Event | 转移 |
|------|--------|-------|------|
| FIN_INVOICE_REVIEW | ✅ | APPROVE/REJECT | → END |

- 单节点审核 + invoice.listener 推进 status
- 重新提交启动新 wf_instance（roundNo 累加）

### 4. FIN_EXPENSE（费用请款） ✅ 完整

| 节点 | onEnter | Event | 转移 |
|------|--------|-------|------|
| FIN_EXPENSE_DEPT_REVIEW | ✅ | APPROVE/REJECT | → FIN_REVIEW / → END |
| FIN_EXPENSE_FIN_REVIEW | ✅ | APPROVE/REJECT | → END |

- 双层审核完整
- expense.listener 监听两节点更新 status (DEPT_APPROVED → APPROVED)

---

## 业务表 Status 状态机检查

| 表 | 状态机 | 闭环 |
|---|---|---|
| `contract.review_status` | DRAFT → SUBMITTED → APPROVED / REJECTED | ✅ |
| `contract.archive_status` | PENDING_ARCHIVE → ARCHIVED | ⚠️ 缺 PARTIAL_ARCHIVE 推进 listener |
| `project_register.status` | DRAFT → SUBMITTED → APPROVED / REJECTED | ✅ |
| `police_register.status` | PENDING → COMPLETED | ⚠️ 文件上传隐式推进 |
| `material_archive.status` | (空) → ARCHIVED | ❌ **listener 缺失** |
| `finance_invoice_application.status` | DRAFT → SUBMITTED → APPROVED / REJECTED | ✅ |
| `finance_expense_request.status` | DRAFT → SUBMITTED → DEPT_APPROVED → APPROVED / REJECTED | ✅ |

---

## 跨模块依赖完整性

| 依赖关系 | 校验位置 | 状态 |
|---|---|---|
| 合同 APPROVED 才能创建项目 | contract.service + project.service.create | ✅ |
| DIRECTOR_REVIEW APPROVE → 自动创建公安登记 | police.listener.handleNodeCompleted | ✅ |
| DIRECTOR_REVIEW APPROVE → 分配 PM/测评师 | project.listener + notification.listener | ⚠️ |
| REPORT_ASSIGN APPROVE → 分配报告编制人 | report.listener.handleNodeCompleted | ✅ |
| FINAL_REVIEW APPROVE → 进入材料归档 | transition + notification.listener | ✅ |
| 开票申请只能选 APPROVED 合同 | invoice.service.create 校验 | ✅ |
| 费用请款只能选 APPROVED 合同 | expense.service.create 校验 | ✅ |
| 结算管理聚合查询 | settlement.service.computeAggregates | ✅ 但精度风险（见维度 7） |

---

## 事件监听覆盖矩阵

### workflow.task.created
| 订阅者 | 处理 | 完整性 |
|---|---|---|
| notification.listener | 待办通知 + pool 通知 | ✅ |

### workflow.node.completed
| 节点 | 订阅者 | 处理 | 完整性 |
|---|---|---|---|
| CONTRACT_REVIEW | contract.listener | reviewStatus 推进 | ✅ |
| DEPT_REVIEW | project.listener | status 推进 | ✅ |
| DIRECTOR_REVIEW | project.listener + police.listener | status + 自动创建公安 | ✅ |
| POLICE_REGISTER | — | (无 listener) | ⚠️ 池任务结束 |
| ON_SITE_ASSESSMENT | — | (无 listener) | ⚠️ |
| TECH_REVIEW | — | (无 listener) | ⚠️ 业务表无对应字段 |
| CONTENT_REVIEW | — | (无 listener) | ⚠️ |
| REPORT_ASSIGN | report.listener | 分配编制人 | ✅ |
| REPORT_COMPILE | — | (无 listener) | ⚠️ |
| FINAL_REVIEW | assessment.listener | 驳回回流处理 | ✅ |
| FIN_INVOICE_REVIEW | invoice.listener | status 推进 | ✅ |
| FIN_EXPENSE_DEPT_REVIEW | expense.listener | status 推进 | ✅ |
| FIN_EXPENSE_FIN_REVIEW | expense.listener | status 推进 | ✅ |
| **MATERIAL_ARCHIVE** | ❌ **缺 listener** | status 应推进 | **P1** |

### project.member.assigned
| 发起 | 预期订阅者 | 实际状态 |
|---|---|---|
| project.listener:115 | notification.listener | ❌ **无订阅，通知遗漏** |

### file.uploaded
| 订阅者 | 处理 | 完整 |
|---|---|---|
| police.listener | 自动 COMPLETE + signal | ✅ |

---

## 🔴 P0 严重问题（0 条）

无 — 流程逻辑整体通畅。

---

## 🟡 P1 应改问题（5 条）

### F2.1 · materialArchive status 推进缺 listener
- **位置**：缺 `packages/server/src/modules/archive/archive.listener.ts`
- **现象**：MATERIAL_ARCHIVE 节点完成时无 listener 把 `material_archive.status` 设为 'ARCHIVED'
- **当前补救**：`archive.service.submit` 直接写 `status='ARCHIVED'`（同提交动作里），所以表状态正确
- **影响**：状态推进与节点完成耦合不彻底；如果有其他路径触发节点完成，status 可能漏推进
- **修复**：新建 archive.listener，订阅 workflow.node.completed + nodeKey=MATERIAL_ARCHIVE

### F2.2 · contract.listener 无事务保护
- **位置**：`packages/server/src/modules/contract/contract.listener.ts:31-50`
- **现象**：`reviewStatus` 更新无原子性，单条 UPDATE
- **影响**：低风险，但若 listener 内有多条 UPDATE 时，部分失败会导致状态不一致
- **修复**：包装在 `db.transaction()` 内

### F2.3 · project.listener projectMember INSERT 无冲突处理
- **位置**：`packages/server/src/modules/project/project.listener.ts:77-102`
- **现象**：DIRECTOR_REVIEW APPROVE 时插入 project_member，无 ON CONFLICT
- **风险**：重复事件触发 → 唯一约束冲突 → listener 异常
- **修复**：加 `.onConflictDoNothing()` 或 `INSERT ... ON CONFLICT (project_id, user_id, role_type) DO NOTHING`

### F2.4 · project.member.assigned 事件缺订阅者
- **位置**：`packages/server/src/modules/project/project.listener.ts:115` 发出，无订阅者
- **现象**：成员被指派后没有通知（"你被指派为 PM/测评师"）
- **影响**：被指派的人不知道有新项目
- **修复**：notification.listener 加 `@OnEvent('project.member.assigned')` 处理

### F2.5 · workflow.instance.completed 事件缺失
- **位置**：workflow.service.ts 无该事件
- **现象**：工作流整体完成（finishedAt）时无全局通知
- **影响**：项目归档完成时，销售/PM/dept_manager 无"项目已完结"通知
- **修复**：在 finishInstance 时 emit 事件 + notification.listener 处理

---

## 🟢 P2 待优化问题（3 条）

### F2.6 · police_register 状态依赖文件上传事件
- **位置**：police.listener
- **风险**：文件删除后无法回滚状态（PENDING → COMPLETED 后无法回到 PENDING）
- **影响**：低
- **修复**：考虑显式工作流确认 + 文件删除时回滚

### F2.7 · PROJECT_REGISTER roundNo 推进逻辑不明确
- **位置**：assessment.service / workflow.service
- **现象**：被驳回后重新提交时 roundNo 累加策略未在代码中明确
- **修复**：在 rejectToAssessment / resubmit 时显式更新 + 加注释

### F2.8 · 多个节点（POLICE_REGISTER / ON_SITE / TECH_REVIEW / CONTENT_REVIEW / REPORT_COMPILE）completed 事件无 listener
- **位置**：各 listener
- **影响**：低（业务表字段不需要在该节点推进），但缺乏审计/扩展点
- **建议**：保持现状或加 noop listener 占位

---

## 备注

### 已知预期行为（不算 bug）
- POLICE_REGISTER / ON_SITE_ASSESSMENT 等节点无 listener 是因为业务表无对应字段需要推进；状态由 wf_instance.currentNode 直接表达
- 池化任务（POLICE_REGISTER / MATERIAL_ARCHIVE / CONTRACT_ARCHIVE / FIN_INVOICE_REVIEW / FIN_EXPENSE_*）的状态由领取动作自动推进，无需额外 listener
- TECH_REVIEW REJECT 不直接到 ON_SITE_ASSESSMENT，而是通过 transition 表的事件流转

### 跨维度涉及
- F2.2/F2.3 也涉及【维度 7：鲁棒性】(事务边界 / 幂等性)
- F2.4 也涉及【维度 6：自洽性】(事件发出与订阅对应)

### 总体覆盖率
- 工作流定义: 100% (4 条 × 100)
- Handler 实现: 100% (5 种 handler)
- 业务监听器: 100% (8 个 listener)
- 业务 Service: ~70%（关键方法已审，部分细节未细看）
- 事件流转: 95%

### 总体评分
**8.5/10** — 4 条工作流闭环结构完整，状态机推进基本到位，主要问题是**事件监听存在 5 处覆盖缺口**（最严重的是 material_archive listener 缺失，已被 service 直接写 status 兜底）。
