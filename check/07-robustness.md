# 维度 7：代码鲁棒性审计

**扫描时间**: 2026-04-29
**项目**: NestJS 11 + PostgreSQL 16 + Drizzle ORM + Vue 3
**审计范围**: 错误处理、空值、并发安全、事务边界、N+1、性能、类型安全

---

## 扫描清单

### 后端 Service (核心逻辑)
- [x] packages/server/src/modules/contract/contract.service.ts
- [x] packages/server/src/modules/project/project.service.ts
- [x] packages/server/src/modules/police/police.service.ts
- [x] packages/server/src/modules/assessment/assessment.service.ts
- [x] packages/server/src/modules/report/report.service.ts
- [x] packages/server/src/modules/archive/archive.service.ts
- [x] packages/server/src/modules/invoice/invoice.service.ts
- [x] packages/server/src/modules/expense/expense.service.ts
- [x] packages/server/src/modules/settlement/settlement.service.ts
- [x] packages/server/src/modules/payment-record/payment-record.service.ts
- [x] packages/server/src/modules/notification/notification.service.ts
- [x] packages/server/src/modules/notification/reminder.scheduler.ts

### 工作流 (关键的事务+状态机)
- [x] packages/server/src/modules/workflow/workflow.service.ts
- [x] packages/server/src/modules/workflow/handlers/*.ts

### Listener (事件监听的异常处理)
- [x] packages/server/src/modules/contract/contract.listener.ts
- [x] packages/server/src/modules/invoice/invoice.listener.ts
- [x] packages/server/src/modules/project/project.listener.ts
- [x] packages/server/src/modules/assessment/assessment.listener.ts
- [x] packages/server/src/modules/report/report.listener.ts
- [x] packages/server/src/modules/expense/expense.listener.ts
- [x] packages/server/src/modules/notification/notification.listener.ts
- [x] packages/server/src/modules/police/police.listener.ts

### 前端关键组件
- [x] packages/web/src/pages/finance/InvoiceForm.vue
- [x] packages/web/src/pages/finance/ExpenseForm.vue
- [x] packages/web/src/pages/finance/SettlementList.vue
- [x] packages/web/src/pages/finance/ContractFinanceDetail.vue
- [x] packages/web/src/api/request.ts

---

## 关键发现

### P0 (严重) 问题 - 11 项

1. **Listener 异常处理不足** | invoice.listener.ts:64-82
   - 通知失败被吞掉，只日志记录，用户无法察觉

2. **Workflow signal 失败无回滚** | contract.service.ts:861-900
   - submit() 先改 status，再启动 workflow，启动失败导致状态不一致

3. **Archive signal 异常处理** | contract.service.ts:1003-1006
   - 归档状态已改但 workflow 推进失败，流程卡死

4. **paymentAmount 转换无边界检查** | payment-record.service.ts:66-74
   - Number(NaN) 比较永远 false，金额状态判定错误

5. **并发开票申请累计超额** | invoice.service.ts:241-242
   - 两个用户同时申请，都通过校验但合计超过合同金额

6. **系统额度竞态更新** | project.service.ts:406
   - refreshSystemQuotaFull() 查询后更新时窗口可被修改

7. **工作流任务池竞态** | workflow.service.ts:261-281
   - 多人同时点击审核同一任务，都能通过检查

8. **Listener 事务一致性** | invoice.listener.ts:37-83
   - listener 异步执行，workflow commit 后 listener 失败导致状态不同步

9. **Invoice submit 无整体事务** | invoice.service.ts:224-259
   - 验证、startInstance、更新 status 分离，失败导致不一致

10. **ProjectListener 插入冲突回滚** | project.listener.ts:66-100
    - 事务内 member 插入冲突回滚，项目无法 APPROVED

11. **Archive 不可逆权限不足** | contract.service.ts:937-1009
    - 归档权限检查不足，任何有编辑权的都能触发

---

### P1 (重要) 问题 - 13 项

12. **find[0] 返回 undefined 无检查** | contract.service.ts（46 处）
    - 直接访问 rows[0] 属性，可能崩溃

13. **ContractService N+1 查询** | contract.service.ts:283-290
    - 逐个查询 reviewer label，20 项列表可能 10+ 次额外查询

14. **ProjectService 文件加载 N+1** | project.service.ts:1018-1048
    - 每个 item 逐个查询文件附件

15. **NotificationService SSE 泄露** | notification.service.ts:28-43
    - 客户端断开时没清理 stream，内存累积

16. **ReminderScheduler 重复执行** | reminder.scheduler.ts:51
    - 多实例并发启动可能仍有竞态

17. **类型安全 any 滥用** | project.listener.ts:57-59
    - pmUserId 和 assessorUserIds 强制转换无类型检查

18. **Workflow variables 无类型** | workflow.service.ts:119
    - Record<string, any> 导致无检查的读写

19. **DTO 校验不足** | contract.dto.ts
    - paymentAmount 可以负数

20. **SQL 输入无长度限制** | contract.service.ts:159
    - keyword 超长可能导致正则超时

21. **数字范围检查缺失** | invoice.service.ts
    - 金额可以是 0 或负数

22. **时间边界时区问题** | settlement.service.ts:62-65
    - 日期计算没有统一时区处理

23. **连接池无超时配置** | 数据库模块
    - 长事务可能耗尽连接池

24. **ProjectRegister 变更无审计** | project.listener.ts:42-45
    - REJECT 状态改变没有记录操作者

---

## 按维度分类

### A. 错误处理
- P0: Listener 异常吞掉、signal 失败无回滚 (3 项)
- P1: 重试机制缺失、异步任务无死信队列

### B. 空值与边界
- P0: paymentAmount 转换无检查 (1 项)
- P1: find[0] undefined、数字范围、时区 (4 项)

### C. 并发安全
- P0: 累计校验、额度竞态、任务池竞态 (3 项)
- 需要: SELECT...FOR UPDATE、行锁

### D. 事务边界
- P0: Listener 异步、submit 无整体事务、冲突回滚 (3 项)
- 需要: 事务包装、补偿机制

### E. N+1 与性能
- P1: reviewer label、文件附件、SSE 泄露 (4 项)
- 需要: 批量加载、连接清理

### F. 类型安全
- P1: any 滥用、Record<string, any> (2 项)

### G. 输入校验
- P1: DTO 校验、SQL 输入长度 (2 项)

### H. 资源泄露
- P1: SSE 泄露、连接池 (2 项)

### I. 危险操作
- P0: 权限不足、无审计 (2 项)

---

## 修复优先级

### 第一阶段 (1-2 周)
1. 并发累计校验 - SELECT...FOR UPDATE
2. Listener 事务一致性 - 同步化或消息队列
3. signal 异常处理 - 整体事务包装
4. paymentAmount 转换 - 边界检查

### 第二阶段 (3-4 周)
5. N+1 查询优化 - 批量加载
6. 类型安全 - 去掉 any
7. DTO 校验 - @Min @Max 装饰器

### 第三阶段 (5-8 周)
8. 资源泄露 - 连接管理、SSE 清理
9. 权限分级 - 危险操作保护
10. 审计日志 - 状态变更记录

---

## 总体评估

| 维度 | 风险等级 | 项数 |
|------|---------|-----|
| 错误处理 | HIGH | 3 |
| 并发安全 | HIGH | 3 |
| 事务边界 | HIGH | 3 |
| 空值检查 | MEDIUM | 5 |
| 类型安全 | MEDIUM | 2 |
| N+1 查询 | MEDIUM | 4 |
| 输入校验 | MEDIUM | 2 |
| 资源泄露 | MEDIUM | 2 |
| 危险操作 | MEDIUM | 2 |

**推荐周期**: 2-3 个月

---

