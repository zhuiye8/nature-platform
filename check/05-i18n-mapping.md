# 审计报告：维度 5 - 中文映射/汉化匹配

## 扫描清单 (✅ 完成9项)
✅ A. 中心化映射文件 (status-map.ts/enums.ts/format.ts/region-data.ts)
✅ B. 财务模块新增状态/节点映射
✅ C. 各页面本地重复映射
✅ D. 通知文案统一性
✅ E. 错误文案质量
✅ F. 角色/节点名一致性
✅ G. DashboardPage businessRouteMap
✅ H. DefaultLayout typeRouteMap
✅ I. SQL 中文

## A. status-map.ts 完整性
- 现有映射: statusLabel(70+项) statusTagType(颜色) categoryLabel(12项)
- 评价: ✅ 清晰完整

## B. 财务模块映射完整性

🔴 P1-1: 财务状态映射缺失
- INVOICE APPROVED("已开票")/REJECTED("需修改") 未注册
- EXPENSE SUBMITTED("部门审核中")/DEPT_APPROVED("财务审核中")/REJECTED 未注册
- 影响: 5个前端文件各自定义本地statusLabel副本
  * InvoiceList.vue L32-34
  * InvoiceDetail.vue L22-27
  * ExpenseList.vue L34-40
  * ExpenseDetail.vue L24-30
  * ContractList.vue L52-57
- 代码重复20+行，维护困难

## D. 通知文案统一性
✅ Invoice 清晰 (invoice.listener.ts L45/60)
✅ Expense 清晰 (expense.listener.ts L55/64/65/72)
⚠️ P2-2 风格不一致: INVOICE"需修改" vs EXPENSE"被驳回(xxx)"

## F. 角色/节点名一致性

🔴 P1-3: 角色名缺失/差异
- tech_reviewer: SQL"整体技术审核员" vs status-map"技术审核人"
- report_writer: SQL"报告编制员" vs status-map"报告编制人"  
- chairman: SQL有 vs status-map缺失
- finance: SQL有 vs status-map缺失

🔴 P1-2: 节点名不一致
- FIN_INVOICE_REVIEW: SQL"财务审核" vs 前端"开票审核"
- FIN_EXPENSE_DEPT_REVIEW: SQL"部门负责人审核" vs 前端"请款部门审核"
- FIN_EXPENSE_FIN_REVIEW: SQL"财务审核" vs 前端"请款财务审核"
- 问题: 维护时无法关联

## G. DashboardPage businessRouteMap

🟡 P2-1: 缺失4项nodeKey
- PROJECT_REGISTER_NODE 缺失
- DEPT_REVIEW 缺失
- DIRECTOR_REVIEW 缺失
- REPORT_ASSIGN 缺失
- 财务3项已加 ✅

## H. DefaultLayout typeRouteMap
✅ 完整覆盖 (INVOICE/EXPENSE已加)

## 问题优先级

P1 - 立即修复
- P1-1: 财务状态映射缺失 (影响6文件)
- P1-2: 工作流节点名不一致 (维护困难)
- P1-3: 财务角色名缺失/差异 (2文件)

P2 - 本周优化
- P2-1: businessRouteMap缺4项
- P2-2: 通知文案风格差异

修复方案:
1. status-map.ts: 新增invoiceStatusLabel/expenseStatusLabel + chairman/finance
2. 前端5文件: 删本地statusLabel副本
3. SQL: 统一角色名/节点名表述
4. DashboardPage: 补4个nodeKey路由

预计时间: 2-4小时
