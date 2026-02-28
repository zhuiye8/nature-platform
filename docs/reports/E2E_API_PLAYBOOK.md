# API E2E 执行手册（P1）

## 1. 目标
- 提供可重复执行的 API 自动化回归入口。
- 覆盖 P1 关键风险：权限、并发冲突、通知未读计数、节点 1-16 主流程闭环、报告审核驳回恢复。

## 2. 前置条件
1. MySQL 容器已启动：`nature-platform-mysql`
2. 后端服务已启动并可访问：`http://127.0.0.1:18080`
3. 测试账号可登录：`admin/admin123`、`reviewer/review123`；`normal/normal123` 由 `deploy/e2e/api/run-all.ps1` 在执行前自动预置/校正

## 3. 执行命令

### 3.1 异常链路
```powershell
powershell -ExecutionPolicy Bypass -File C:\work\nature\codex\deploy\e2e\api\exception\run-all.ps1
```

### 3.2 正向链路（01~04）
```powershell
powershell -ExecutionPolicy Bypass -File C:\work\nature\codex\deploy\e2e\api\happy-path\run-all.ps1
```

### 3.3 全量 API E2E
```powershell
powershell -ExecutionPolicy Bypass -File C:\work\nature\codex\deploy\e2e\api\run-all.ps1
```

### 3.4 UI 冒烟（Playwright）
```powershell
cd C:\work\nature\codex\nature-platform-web
pnpm test:e2e
```
- 覆盖：
  - 登录与关键入口可达性
  - 回收站恢复权限提示
  - 现场测评分配弹窗四角色候选池绑定
  - 未选齐 4 人时阻断保存分配

## 4. 当前覆盖清单

### 4.1 异常链路
- `reviewer-candidates.ps1`
  - 断言：`GET /api/v1/on-site-assessments/reviewer-candidates` 返回四组候选人数组
- `recycle-bin-forbidden.ps1`
  - 断言：非超管调用回收站恢复接口返回 `403`
- `assignment-conflict.ps1`
  - 断言：分配并发冲突返回 `409` 且提示“任务已被分配，请刷新”
- `notification-unread-delete.ps1`
  - 断言：删除未读通知后，`/api/v1/notifications/unread-count` 实时减 1
- `report-review-reject-recovery.ps1`
  - 断言：内容审核驳回后 `status=REJECTED`；重提并通过后回到 `REPORT_COMPILE_ASSIGN`
- `report-tech-reject-recovery.ps1`
  - 断言：技术审核驳回后 `status=REJECTED`；重提并通过后回到 `REPORT_CONTENT_REVIEW`
- `report-final-reject-recovery.ps1`
  - 断言：最终审核驳回后 `status=REJECTED`；重提并通过后回到 `MATERIAL_ARCHIVE`
- `notification-trigger-audit.ps1`
  - 断言：合同审核通过/归档通知触发正确；`time.ts` 包含 `Asia/Shanghai` 与 `+08:00` 归一化

### 4.2 正向链路
- `01-contract-archive-project-register.ps1`
- `02-project-police-onsite-assignment.ps1`
- `03-report-reviews-and-compile-submit.ps1`
- `04-final-review-and-material-archive.ps1`

## 5. 关键接口断言（节点 11-16）
1. `POST /api/v1/on-site-assessments/{projectId}/submit`
   - 断言：返回 `200` 且自动创建技术审核待办（`REPORT_TECH_REVIEW_TASK`）
2. `POST /api/v1/workflow/tasks/{taskId}/approve`（技术/内容/最终审核任务）
   - 断言：返回 `200`，对应任务可完成
3. `POST /api/v1/workflow/tasks/{taskId}/reject`（内容审核任务）
   - 断言：返回 `200`，详情状态切换为 `REJECTED`
4. `GET /api/v1/report-content-reviews/{projectId}`
   - 断言：技术审核通过后自动进入 `SUBMITTED`，全部审批后 `status=APPROVED` 且 `workflowNode=REPORT_COMPILE_ASSIGN`
5. `POST /api/v1/report-compile-submissions/{projectId}/submit`
   - 断言：返回 `200`，已配置最终审核人时自动创建 `REPORT_FINAL_REVIEW` 待办
6. `GET /api/v1/material-archives/{projectId}`
   - 断言：`status=ARCHIVED`、`workflowStatus=APPROVED` 且 `reportFiles/formFiles` 均非空

## 6. 报告与日志归档
- 每个 API 脚本执行后会在 `deploy/e2e/reports/api` 下生成 JSON 报告文件，文件名包含 `suite + timestamp`。
- 失败时可结合控制台输出和该 JSON 报告进行排障。

## 7. 已知故障与修复口径
- 历史故障：`workflow_action_log.action` 列长度不足导致内容审核审批 `500`。
- 修复：`V8__workflow_action_log_expand_action_column.sql`，将 `action` 扩容至 `VARCHAR(128)`。

## 8. 清理策略
- 每个脚本在 `finally` 中执行清理 SQL，避免污染业务数据。
- 清理范围覆盖：合同、项目、公安登记、现场测评、审核任务、通知、workflow 实例与日志。
