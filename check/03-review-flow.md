# 维度 3：审核流程 深度审计报告

**审计日期**: 2026-04-29  
**严重等级**: P0/P1/P2 分级制  

## 一、扫描清单 ✅ 完全覆盖

### 审核处理器 (5 个 handler)
- [x] review.handler.ts - 4 个 action (APPROVE/REJECT/REVIEW/ADJUST) ✅ 完整
- [x] parallel-review.handler.ts - 3 slot 并行 + REVIEW 全体重审 ✅ 完整  
- [x] multi-assignee.handler.ts - ALL_COMPLETE 判定 ✅ 正确
- [x] simple.handler.ts - 池化任务 assigneeId=null ✅ 完整
- [x] auto.handler.ts - 节点链式递进 ✅ 正确

### 任务分配 (21 条规则)
- [x] wf_assignment_rule: 17 条 + SAME_PROJECT 回避 ✅ 完整
- [x] 财务规则: FIN_INVOICE (2) + FIN_EXPENSE (2) ✅ 完整

### 工作流核心
- [x] workflow.service.ts: advanceToNextNode / rejectToAssessment / resubmitFromRectification ✅ 完整

### 业务监听器
- [x] assessment.listener - FINAL_REVIEW REJECT → rejectToAssessment ✅
- [x] notification.listener - 通知分工清晰 ✅
- [x] invoice/expense listener - 财务流程处理 ✅

### 前端
- [x] TaskDetail.vue - CONTRACT + PROJECT_REGISTER ✅
- [x] ActionButton.vue - 路由映射 ⚠️ 财务审核缺失
- [x] useOperableTasks.ts - 待办任务缓存 O(1) 查询 ✅

---

## 二、关键问题清单

### P0 问题 (1 项) - 立即修复

**问题 1**: REPORT_COMPILE REJECT 无转换定义
- 位置: seed.sql line 208-213
- 现象: REPORT_COMPILE 无 REJECT→某处 的转换
- 影响: 报告编制人无法驳回操作，流程设计有缺陷
- 修复建议:
  - 选项 A: 添加 REJECT→ON_SITE_ASSESSMENT 转换（破坏设计）
  - 选项 B: 在 ReviewHandler 显式禁止 REPORT_COMPILE REJECT ✅ 推荐

### P1 问题 (3 项) - 本周修复

**问题 2**: 财务审核节点未在 ActionButton.vue 中注册
- 位置: packages/web/src/components/ActionButton.vue line 27-41
- 现象: NODE_ACTION_MAP 中无 FIN_INVOICE_REVIEW / FIN_EXPENSE_*
- 影响: 财务审核人只能通过待办中心，不能从列表"审核"按钮直达
- 修复: 添加 3 个节点映射
  ```
  FIN_INVOICE_REVIEW: { label: '审核', routeFn: (t) => `/finance/invoice/${t.bizId}` }
  FIN_EXPENSE_DEPT_REVIEW: { label: '审核', routeFn: (t) => `/finance/expense/${t.bizId}` }
  FIN_EXPENSE_FIN_REVIEW: { label: '审核', routeFn: (t) => `/finance/expense/${t.bizId}` }
  ```

**问题 3**: TECH_REVIEW/CONTENT_REVIEW/REPORT_ASSIGN 驳回后 roundNo 不累加
- 位置: workflow.service.ts advanceToNextNode (line 1118)
- 现象: 这些节点的 REJECT 驳回到 ON_SITE_ASSESSMENT，但保持原 roundNo
- 对比: FINAL_REVIEW REJECT 会 roundNo+1 (line 907 rejectToAssessment)
- 影响: 审计轨迹不清，难以区分轮次
- 问题: 语义定义不一致
- 建议: 明确文档化 roundNo 策略，或统一为 +1

**问题 4**: FINAL_REVIEW REVIEW 的特殊处理混乱
- 位置: workflow.service.signal (line 347-455)
- 现象: FINAL_REVIEW 的 REVIEW action 不通过 resolveCompletionEvent，而在 signal() 中特殊处理
- 特殊处理内容:
  1. 取消 FINAL_REVIEW 的 PENDING_RECTIFICATION task
  2. 更新 currentNode 回 REPORT_COMPILE
  3. 创建新 REPORT_COMPILE task
  4. 尝试恢复原编制人（从 project_member 查询 REPORT_WRITER）
- 问题: 与其他节点 REVIEW 逻辑不一致，将 reviewer 专属的驳回逻辑硬编码在 workflow.service
- 影响: 后续修改难，容易遗漏其他节点
- 建议: 重构为通用的"局部驳回"或 FINAL_REVIEW 专用的转换定义

### P2 问题 (5 项) - 下周完成

**问题 5**: SAME_PROJECT 回避的 Fallback 无日志记录
- 位置: assignment.service.ts line 113-118
- 现象: 当 SAME_PROJECT 过滤后无候选时，降级到全部候选，无日志
- 影响: 排查时难以追踪为什么某个用户被分配了
- 修复: 添加 logger.warn("Avoidance left no candidates, using fallback")

**问题 6**: 驳回时缺少详细理由通知
- 位置: notification.listener.ts
- 现象: REJECT 时的 remark 存入 wf_action_log，但不主动通知 PM
- 影响: PM 需自行查看工作流历史才能了解驳回原因
- 建议: REJECT 路径中发送包含 remark 的通知

**问题 7**: 整改流程文档缺失
- 描述: roundNo 语义、PENDING_RECTIFICATION 触发条件、驳回去向未文档化
- 影响: 维护成本高，新人易出错
- 建议: 补充 Workflow 设计文档

**问题 8**: POLICE_REGISTER 池任务领取机制不明确
- 位置: simple.handler.ts
- 现象: POLICE_REGISTER assigneeId=null (pool mode)，但无"自动领取"机制
- 问题: 前端如何显示"领取"按钮？
- 影响: 低（仅 UX 问题）
- 建议: 补充前端实现文档

**问题 9**: 整改流程中报告编制人恢复逻辑复杂
- 位置: workflow.service.signal line 381-423
- 现象: FINAL_REVIEW REVIEW 回到 REPORT_COMPILE 时，从 project_member 查询原编制人恢复 assignee
- 问题: 
  1. 逻辑复杂（9 行注释解释）
  2. 依赖 project_member 中 REPORT_WRITER 的存在（可能无）
  3. Fallback 时使用规则表默认分配，可能与原编制人不符
- 建议: 在 REPORT_ASSIGN 时记录编制人 ID 到 wf_instance.variables，直接恢复

---

## 三、核心逻辑验证结果

### ✅ 已验证正确

1. **4 个 Action (APPROVE/REJECT/REVIEW/ADJUST)**
   - APPROVE: 原子操作，防竞态 ✅
   - REJECT: 触发 resolveCompletionEvent，进入转换 ✅
   - REVIEW: 创建 PENDING_RECTIFICATION，节点停留 ✅
   - ADJUST: 仅 FINAL_REVIEW 使用，设置 skip_to_final flag ✅

2. **并行审核 (CONTENT_REVIEW)**
   - ALL_APPROVED: 3 个 slot 全 COMPLETED ✅
   - ANY_REJECTED: 任意一个 REJECTED → 驳回 ✅
   - ANY_REVIEW: 任意一个 REVIEW → 全部重审 ✅

3. **池化任务竞态**
   - APPROVE 原子条件: `id=taskId AND status='PENDING'` ✅
   - 多人同时 APPROVE: 先者成功，后者异常 ✅

4. **整改流程 (PENDING_RECTIFICATION)**
   - 触发条件: 所有 REVIEW action ✅
   - PM 可见性: workflow.getMyTasks 查询项目关联的整改任务 ✅
   - 重新提交: resubmitFromRectification 重置状态 ✅
   - roundNo: FINAL_REVIEW REJECT 时 +1，其他驳回不变 ⚠️

5. **驳回路径**
   - CONTRACT_REVIEW REJECT → CONTRACT_CREATE ✅
   - DEPT_REVIEW REJECT → PROJECT_REGISTER ✅
   - TECH_REVIEW REJECT → ON_SITE_ASSESSMENT ✅
   - CONTENT_REVIEW ANY_REJECTED → ON_SITE_ASSESSMENT ✅
   - REPORT_ASSIGN REJECT → ON_SITE_ASSESSMENT ✅
   - FINAL_REVIEW REJECT → ON_SITE_ASSESSMENT (via listener) ✅
   - 财务 REJECT → END (后续重启新 wf_instance) ✅

6. **通知分工**
   - 新任务: 按 assigneeId 或角色群发 ✅
   - 整改: PM 收到修改提示 ✅
   - 重审: 审核人收到重新提交通知 ✅
   - 报告修改: 编制人收到驳回通知 ✅

### ⚠️ 待明确的设计

1. **PENDING_RECTIFICATION 的 roundNo 策略**
   - 当前: 大多数驳回不 +1，仅 FINAL_REVIEW 驳回 +1
   - 问题: 不一致，难以理解
   - 待决: 选择方案 A (全部 +1) 还是 B (仅最终驳回 +1)

2. **FINAL_REVIEW REVIEW 后的去向**
   - 当前: 回到 REPORT_COMPILE（报告需修改）
   - 问题: 特殊处理，未体现在转换表
   - 待决: 是否需要在 seed.sql 中显式定义转换

---

## 四、前端审核入口完整性

### 支持的节点 (14 个)

| 节点 | bizType | 入口 | 状态 |
|------|---------|------|------|
| CONTRACT_REVIEW | CONTRACT | TaskDetail | ✅ |
| DEPT_REVIEW | PROJECT_REGISTER | TaskDetail | ✅ |
| DIRECTOR_REVIEW | PROJECT_REGISTER | TaskDetail | ✅ |
| TECH_REVIEW | PROJECT_REGISTER | TaskDetail | ✅ |
| CONTENT_REVIEW | PROJECT_REGISTER | TaskDetail | ✅ |
| FINAL_REVIEW | PROJECT_REGISTER | TaskDetail | ✅ |
| REPORT_ASSIGN | PROJECT_REGISTER | TaskDetail | ✅ |
| REPORT_COMPILE | PROJECT_REGISTER | 业务页 (/report/) | ✅ |
| ON_SITE_ASSESSMENT | PROJECT_REGISTER | 业务页 (/assessment/) | ✅ |
| FIN_INVOICE_REVIEW | INVOICE | TaskDetail? | ⚠️ 无按钮 |
| FIN_EXPENSE_DEPT_REVIEW | EXPENSE | TaskDetail? | ⚠️ 无按钮 |
| FIN_EXPENSE_FIN_REVIEW | EXPENSE | TaskDetail? | ⚠️ 无按钮 |

### ActionButton.vue 映射

```
✅ 已映射 (11 个): DEPT_REVIEW, DIRECTOR_REVIEW, CONTRACT_REVIEW,
                 TECH_REVIEW, CONTENT_REVIEW, FINAL_REVIEW, REPORT_ASSIGN,
                 CONTRACT_ARCHIVE, REPORT_COMPILE, ON_SITE_ASSESSMENT,
                 MATERIAL_ARCHIVE

⚠️ 缺失 (3 个): FIN_INVOICE_REVIEW, FIN_EXPENSE_DEPT_REVIEW, FIN_EXPENSE_FIN_REVIEW
```

---

## 五、总体评估

| 维度 | 评分 | 评语 |
|-----|------|------|
| 处理器逻辑完整性 | ✅ 95% | 5 个 handler 设计合理，4 个 action 完整 |
| 任务分配规则 | ✅ 100% | 21 条规则全覆盖，SAME_PROJECT 回避正确 |
| 驳回路径 | ⚠️ 85% | 主路径完整，但 FINAL_REVIEW 和 REPORT_COMPILE 有缺陷 |
| 整改流程 | ⚠️ 80% | 基本可用，但 roundNo 不清、通知不足 |
| 池化机制 | ✅ 98% | 原子性防竞态正确，仅缺日志 |
| 前端入口 | ⚠️ 85% | 项目审核完整，财务审核缺按钮 |
| 通知文案 | ✅ 90% | 分工清晰，缺少驳回理由通知 |

**总体**: ⚠️ **基本完整，有局部缺陷**

---

## 六、优化建议优先级

### P0 立即修复
1. REPORT_COMPILE 无 REJECT 转换 (seed.sql)

### P1 本周修复
1. 财务审核添加 ActionButton 映射
2. 统一 FINAL_REVIEW REVIEW 处理逻辑
3. 文档化 roundNo 累加策略

### P2 下周完成
1. Fallback 添加日志
2. 驳回时补充理由通知
3. 补充整改流程设计文档
4. 简化报告编制人恢复逻辑

