<!-- FORMAT-DOC: Update when project structure or architecture changes -->

# Architecture

Nature Platform 在 `codex` 目录采用前后端分离架构：

- 后端：`nature-platform-api`（Spring Boot + Flowable + MySQL + Redis + MinIO）
- 前端：`nature-platform-web`（Vue 3 + Element Plus）

## 等保 V1 主流程（节点 1-16）

1. 客户管理  
2. 合同管理  
3. 合同审核  
4. 合同归档  
5. 项目登记申请  
6. 项目登记审核与分配  
7. 公安登记  
8. 现场测评实施（上传 ZIP + 分配技术/内容A/B/C 审核人）  
9. 质量审核申请（兼容网关，现场测评提交时自动满足）  
10. 质量审核任务（兼容看板，任务收敛到后续报告审核链路）  
11. 报告整体技术审核  
12. 报告内容审核（A/B/C 三路）  
13. 报告编制任务分配  
14. 报告编制并上传  
15. 报告最终审核  
16. 材料归档（流程闭环）

## 本轮关键架构约束

- 审核人前置：技术审核人、内容 A/B/C 审核人统一在节点 8（现场测评）选择并保存，提交前必须选齐 4 人。
- ZIP 门禁：节点 8 必须上传现场测评 ZIP 后，才能保存审核人分配并提交。
- 跨节点可见：节点 11-16 均可查看节点 8 提交的现场测评压缩包对象键。
- 最终审核人保持在节点 15 配置与提交，不前置到节点 8。
- 并发控制：审核人分配使用 `workflow_assignment.version_no` 做乐观锁，冲突返回刷新提示。

## Workflow 与留痕

- 业务主键：`PROJECT_REGISTER` + `project_register.id`
- 流程实例镜像：`workflow_instance`
- 流转动作日志：`workflow_action_log`
- 节点状态回写：统一由 `ProjectWorkflowTraceService` 处理，确保页面状态、待办任务与流程轨迹一致。

## 数据模型扩展

### 已落地表

- `police_register`
- `on_site_assessment`
- `workflow_assignment`
- `quality_review_apply`
- `quality_review_task`
- `report_tech_review_apply`
- `report_tech_review_task`
- `report_content_review_apply`
- `report_content_review_task`
- `report_compile_assignment`
- `report_compile_submission`
- `report_final_review_apply`
- `report_final_review_task`
- `material_archive`

## 模块索引

- [nature-platform-api](nature-platform-api/src/main/java/com/nature/platform/INDEX.md) - 后端领域服务、控制器与流程节点实现
- [nature-platform-api-tests](nature-platform-api/src/test/java/com/nature/platform/INDEX.md) - 后端单元测试与回归保护
- [nature-platform-web-src](nature-platform-web/src/INDEX.md) - 前端路由、页面与 API 服务封装

## 前端主题层（2026-02-12）

- 新增 `nature-platform-web/src/styles/tokens.css`：统一颜色、字号、间距、圆角、阴影与布局 token。
- 新增 `nature-platform-web/src/styles/base.css`：统一页面容器、标题区与全局排版基线。
- 新增 `nature-platform-web/src/styles/element-overrides.css`：统一 Element Plus 组件视觉（卡片/表格/表单/按钮/弹窗/提示）。
- 路由层改为懒加载（`nature-platform-web/src/router.ts`），配合 `nature-platform-web/vite.config.ts` manualChunks 分包降低首包压力。
