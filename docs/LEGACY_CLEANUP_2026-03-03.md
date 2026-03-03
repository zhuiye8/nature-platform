# 旧逻辑/旧页面/旧接口清理清单（2026-03-03）

## 本轮目标
- 清理已被新流程替代的“质量审核（QUALITY_REVIEW）”整套逻辑。
- 保留当前统一详情页链路：`/api/v1/task-details/{taskType}/{bizId}`。

## 清单与状态

1. 旧页面下线
- [x] 删除 `nature-platform-web/src/QualityReviewsView.vue`
- [x] 删除路由映射 `/quality-reviews`（`nature-platform-web/src/router.ts`）

2. 旧前端接口下线
- [x] 删除 `nature-platform-web/src/quality-review-service.ts`
- [x] 删除权限码到 `page.quality-reviews` 的映射（`nature-platform-web/src/resource-mapping.ts`）
- [x] 删除详情聚合模型中的 `qualityReview` 字段类型依赖（`nature-platform-web/src/task-details-service.ts`）
- [x] 删除项目轨迹文案中质量审核旧动作映射（`nature-platform-web/src/ProjectRegistersView.vue`）

3. 旧后端接口下线
- [x] 删除 `nature-platform-api/src/main/java/com/nature/platform/QualityReviewController.java`
- [x] 删除 `nature-platform-api/src/main/java/com/nature/platform/QualityReviewService.java`
- [x] 删除 `nature-platform-api/src/main/java/com/nature/platform/QualityReviewAssignmentRequest.java`
- [x] 删除 `nature-platform-api/src/main/java/com/nature/platform/QualityReviewRecord.java`
- [x] 删除 `nature-platform-api/src/main/java/com/nature/platform/QualityReviewTaskRecord.java`

4. 旧后端模型/权限映射清理
- [x] 删除详情聚合模型 `ProcessOverviewRecord` 的 `qualityReview` 字段
- [x] 删除 `FileAssetController` 对 `QUALITY_REVIEW` 任务类型白名单
- [x] 删除 `BusinessPermissionCodes` 中 `quality-review:*` 常量
- [x] 删除 `BuiltInPermissionRegistry` 中质量审核内置权限注册
- [x] 删除 `PermissionResourceResolver` 的 `quality-review:* -> page.quality-reviews` 映射
- [x] 删除 `ResourceKeys.PAGE_QUALITY_REVIEWS`

5. 旧自动化脚本下线
- [x] Playwright 冒烟用例移除 `/quality-reviews` 断言（`smoke-permission-report-workflow.spec.ts`）
- [x] API happy-path 02/03/04 脚本移除 `reviewer-candidates`/`review-assignment`/`quality-reviews` 调用，改为 `project-registers/{id}/assessment-members` 新链路
- [x] API exception 套件执行清单移除旧脚本：`reviewer-candidates.ps1`、`assignment-conflict.ps1`
- [x] API exception 其余恢复脚本已改造到新链路并重新纳入 `exception/run-all.ps1`
- [x] API `happy-path/run-all.ps1` 已恢复执行 `04-final-review-and-material-archive.ps1`

## 回归要求
- 后端：`mvn -q test`
- 前端：`pnpm build`
- 文档检查：`check_format_doc.py --mode changed`

## 后续可选清理（下一轮）
- 评估并清理未使用的候选人接口（例如报告技术审核 `candidates` / `save`）是否还需要保留兼容。
- 清理数据库中的历史质量审核权限与资源记录（仅在确认线上无依赖后执行）。
