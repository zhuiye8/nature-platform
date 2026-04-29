# 维度 1：数据权限 深度扫描报告

审计日期：2026-04-29
扫描范围：NestJS 11 + Vue 3 等保测评平台

## 扫描清单（22 个 Controller）

✅ 22/22 Controllers 已扫描

### 优秀（19/22）- 所有 endpoint 都有 @RequirePermission

- contract/contract.controller.ts: 10/10 endpoints
- project/project.controller.ts: 9/9 endpoints
- police/police.controller.ts: 3/3 endpoints
- assessment/assessment.controller.ts: 6/6 endpoints
- report/report.controller.ts: 3/3 endpoints
- archive/archive.controller.ts: 3/3 endpoints
- customer/customer.controller.ts: 6/6 endpoints
- partner/partner.controller.ts: 5/5 endpoints
- platform/platform.controller.ts: 7/7 endpoints
- invoice/invoice.controller.ts: 7/7 endpoints
- expense/expense.controller.ts: 8/8 endpoints
- settlement/settlement.controller.ts: 2/2 endpoints
- payment-record/payment-record.controller.ts: 3/3 endpoints
- user/user.controller.ts: 9/9 endpoints
- role/role.controller.ts: 8/8 endpoints
- recycle/recycle.controller.ts: 3/3 endpoints
- workflow/workflow.controller.ts: 8/8 endpoints
- notification/notification.controller.ts（仅 JwtAuthGuard，按设计）
- user/user.controller.ts: profile / getProfile 无权限要求

### 需注意（3/22）- 缺少 PermissionGuard

P1 问题：
- file/file.controller.ts: 仅 JwtAuthGuard，无 @RequirePermission
- assessment-file/assessment-file.controller.ts: 仅 JwtAuthGuard，无 @RequirePermission
- compile-file/compile-file.controller.ts: 仅 JwtAuthGuard，无 @RequirePermission

P2 问题：
- review-opinion/review-opinion.controller.ts: 仅 JwtAuthGuard，无 @RequirePermission

---

## P1 问题（立即修复）

### 1. file.controller.ts 缺少 PermissionGuard

文件：packages/server/src/modules/file/file.controller.ts:22

当前状态：
@Controller('file')
@UseGuards(JwtAuthGuard)  // 缺少 PermissionGuard
export class FileController { ... }

影响：
- upload / download / removeByBiz / remove 无权限拦截
- remove 方法手动检查 super_admin（违反规范）
- 文件操作无统一权限控制入口

修复方案：
1. 添加 @UseGuards(JwtAuthGuard, PermissionGuard)
2. 为所有 endpoint 添加 @RequirePermission
3. 定义权限码：file:upload / file:download / file:delete

---

### 2. assessment-file.controller.ts 无权限检查

文件：packages/server/src/modules/assessment-file/assessment-file.controller.ts:21

当前状态：
@Controller('assessment-file')
@UseGuards(JwtAuthGuard)  // 缺少 PermissionGuard

影响：
- 测评文件可被任何登录用户访问
- 缺少文件所有权验证
- 安全性问题

修复方案：
1. 添加 @UseGuards(JwtAuthGuard, PermissionGuard)
2. 所有 endpoint 使用 @RequirePermission('assessment:submit')

---

### 3. compile-file.controller.ts 无权限检查

文件：packages/server/src/modules/compile-file/compile-file.controller.ts:21

当前状态：
@Controller('compile-file')
@UseGuards(JwtAuthGuard)  // 缺少 PermissionGuard

影响：
- 报告编制文件可被任何登录用户上传
- 编制人员身份未验证

修复方案：
1. 添加 @UseGuards(JwtAuthGuard, PermissionGuard)
2. 所有 endpoint 使用 @RequirePermission('report:compile')

---

## P2 问题（中期修复）

### 4. settlement.service.ts 无角色可见性过滤

文件：packages/server/src/modules/settlement/settlement.service.ts:41

当前状态：
async findGroupPage(query: QuerySettlementDto) {
  const contractConds: SQL[] = [
    eq(contract.deleted, false),
    eq(contract.reviewStatus, 'APPROVED'),
    // 无角色检查
  ];
}

问题：
- 所有登录用户都能查看结算数据
- settlement:view 权限定义了但 service 无检查

修复方案：
在 service 中添加角色可见性检查或在 controller 用 @RequirePermission

---

### 5. invoice 权限码使用不一致

文件：invoice.controller.ts

问题：
- controller 使用 invoice:apply（所有 endpoint）
- seed 定义了 invoice:list / invoice:review
- findPage 应该用 invoice:list，不是 invoice:apply

修复方案：
- findPage / findById：@RequirePermission('invoice:list')
- create / update / submit / remove：@RequirePermission('invoice:apply')
- review：@RequirePermission('invoice:review')

---

### 6. review-opinion 无权限检查

文件：packages/server/src/modules/review-opinion/review-opinion.controller.ts:5

修复方案：
添加 @UseGuards(JwtAuthGuard, PermissionGuard)
所有 endpoint 使用 @RequirePermission('assessment:view')

---

## 角色可见性矩阵

17 角色 × 主要模块：

| 角色 | 合同 | 开票 | 费用 | 结算 |
|------|------|------|------|------|
| super_admin | 全部 | 全部 | 全部 | 全部 |
| chairman | 全部 | 全部 | 全部 | 全部 |
| sales | 自己 | 自己 | 自己 | 无 |
| commercial | APPROVED | 无 | 无 | 无 |
| dept_manager | 非DRAFT | 无 | 全部 | 无 |
| finance | APPROVED | 全部 | 全部 | 全部 |

---

## Service 层可见性检查

✅ contract.service: 按 sales/commercial/finance 角色正确过滤
✅ invoice.service: 按 super_admin/chairman/finance 正确过滤
✅ expense.service: 按 dept_manager/finance 正确过滤
⚠️ settlement.service: 无角色过滤（P2）

---

## 总体评分：8.2/10

- Controller 保护：8.5/10（3 个缺少 PermissionGuard）
- 权限定义：9/10（覆盖完整）
- Service 逻辑：8/10（settlement 缺检查）
- 权限一致性：7.5/10（invoice 不对齐）

---

## 修复优先级

P1（立即）：file / assessment-file / compile-file 添加 PermissionGuard
P2（中期）：settlement / review-opinion / invoice 权限调整
P3（优化）：权限测试用例 / 审计日志激活

---

审计日期：2026-04-29
