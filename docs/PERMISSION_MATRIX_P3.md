# PERMISSION_MATRIX_P3

## 目标
第一批核心 5 页权限对齐矩阵，确保“按钮显隐 -> 接口鉴权 -> 权限码配置”一一对应。

## 矩阵

| 页面 | 按钮/动作 | 前端入口 | 后端接口 | 权限码 |
|---|---|---|---|---|
| 客户管理 | 查看列表 | `/customers` 页面进入与刷新 | `GET /api/v1/customers` | `customer:view` |
| 客户管理 | 查看详情 | 编辑弹窗加载前明细 | `GET /api/v1/customers/{id}` | `customer:view` |
| 客户管理 | 新建客户 | `新建客户`、`保存` | `POST /api/v1/customers` | `customer:create` |
| 客户管理 | 编辑客户 | `编辑`、`保存` | `PUT /api/v1/customers/{id}` | `customer:update` |
| 客户管理 | 删除客户 | `删除` | `DELETE /api/v1/customers/{id}` | `customer:delete` |
| 合同管理 | 查看列表 | `/contracts` 页面进入与刷新 | `GET /api/v1/contracts` | `contract:view` |
| 合同管理 | 查看详情 | 编辑弹窗加载前明细 | `GET /api/v1/contracts/{id}` | `contract:view` |
| 合同管理 | 新建合同 | `新建合同`、`保存` | `POST /api/v1/contracts` | `contract:create` |
| 合同管理 | 编辑合同 | `编辑`、`保存` | `PUT /api/v1/contracts/{id}` | `contract:update` |
| 合同管理 | 提交审核 | `提交审核` | `POST /api/v1/contracts/{id}/submit-review` | `contract:submit` |
| 合同管理 | 合同归档 | `合同归档`、`确认归档` | `POST /api/v1/contracts/{id}/archive` | `contract:archive` |
| 合同管理 | 删除合同 | `删除` | `DELETE /api/v1/contracts/{id}` | `contract:delete` |
| 项目登记 | 查看列表 | `/project-registers` 页面进入与刷新 | `GET /api/v1/project-registers` | `project-register:view` |
| 项目登记 | 查看详情 | 编辑弹窗加载前明细 | `GET /api/v1/project-registers/{id}` | `project-register:view` |
| 项目登记 | 新建登记 | `新建项目登记`、`保存` | `POST /api/v1/project-registers` | `project-register:create` |
| 项目登记 | 编辑登记 | `编辑`、`保存` | `PUT /api/v1/project-registers/{id}` | `project-register:update` |
| 项目登记 | 提交审核 | `提交审核` | `POST /api/v1/project-registers/{id}/submit-review` | `project-register:submit` |
| 项目登记 | 删除登记 | `删除` | `DELETE /api/v1/project-registers/{id}` | `project-register:delete` |
| 项目登记 | 查看轨迹 | `流程轨迹` | `GET /api/v1/project-registers/{id}/workflow-trace` | `project-register:trace:view` |
| 公安登记 | 查看列表 | `/police-registers` 页面进入与刷新 | `GET /api/v1/police-registers` | `police-register:view` |
| 公安登记 | 查看详情 | 编辑弹窗加载前明细 | `GET /api/v1/police-registers/{projectId}` | `police-register:view` |
| 公安登记 | 保存草稿 | `编辑`、`保存草稿` | `PUT /api/v1/police-registers/{projectId}` | `police-register:save` |
| 公安登记 | 提交流转 | `提交并流转` | `POST /api/v1/police-registers/{projectId}/submit` | `police-register:submit` |
| 现场测评 | 查看列表 | `/on-site-assessments` 页面进入与刷新 | `GET /api/v1/on-site-assessments` | `on-site-assessment:view` |
| 现场测评 | 查看详情 | 编辑测评前加载明细 | `GET /api/v1/on-site-assessments/{projectId}` | `on-site-assessment:view` |
| 现场测评 | 保存测评 | `编辑测评`、`上传 ZIP`、`保存` | `PUT /api/v1/on-site-assessments/{projectId}` | `on-site-assessment:save` |
| 现场测评 | 查看候选池 | 页面加载候选池 | `GET /api/v1/on-site-assessments/reviewer-candidates` | `on-site-assessment:candidate:view` |
| 现场测评 | 保存分配 | `分配审核人`、`保存分配` | `PUT /api/v1/on-site-assessments/{projectId}/review-assignment` | `on-site-assessment:assign` |
| 现场测评 | 提交流转 | `提交` | `POST /api/v1/on-site-assessments/{projectId}/submit` | `on-site-assessment:submit` |

## P3-Phase2 矩阵（报告链路 + 待办审批）

| 页面 | 按钮/动作 | 前端入口 | 后端接口 | 权限码 |
|---|---|---|---|---|
| 待办审批 | 查看待办列表 | `/workflow` 页面进入、筛选、刷新 | `GET /api/v1/workflow/tasks/todo` | `workflow-task:view` |
| 待办审批 | 通过任务 | `通过` | `POST /api/v1/workflow/tasks/{taskId}/approve` | `workflow-task:approve` |
| 待办审批 | 驳回任务 | `驳回`、`确认驳回` | `POST /api/v1/workflow/tasks/{taskId}/reject` | `workflow-task:reject` |
| 质量审核 | 查看列表 | `/quality-reviews` 页面进入与刷新 | `GET /api/v1/quality-reviews` | `quality-review:view` |
| 质量审核 | 查看详情 | `任务明细` 抽屉加载 | `GET /api/v1/quality-reviews/{projectId}` | `quality-review:view` |
| 质量审核 | 查看候选池 | 候选池加载 | `GET /api/v1/quality-reviews/candidates` | `quality-review:candidate:view` |
| 质量审核 | 保存分配 | （接口能力，页面入口在现场测评） | `PUT /api/v1/quality-reviews/{projectId}/assignment` | `quality-review:assign` |
| 质量审核 | 提交流转 | （接口能力，页面入口在现场测评） | `POST /api/v1/quality-reviews/{projectId}/submit` | `quality-review:submit` |
| 报告技术审核 | 查看列表 | `/report-tech-reviews` 页面进入与刷新 | `GET /api/v1/report-tech-reviews` | `report-tech-review:view` |
| 报告技术审核 | 查看详情 | 明细加载 | `GET /api/v1/report-tech-reviews/{projectId}` | `report-tech-review:view` |
| 报告技术审核 | 查看候选池 | 候选池加载 | `GET /api/v1/report-tech-reviews/candidates` | `report-tech-review:candidate:view` |
| 报告技术审核 | 保存配置 | （接口能力） | `PUT /api/v1/report-tech-reviews/{projectId}` | `report-tech-review:save` |
| 报告技术审核 | 自动入待办 | `现场测评提交后自动创建` | `无手工 submit 接口` | `无 submit 权限码` |
| 报告内容审核 | 查看列表 | `/report-content-reviews` 页面进入与刷新 | `GET /api/v1/report-content-reviews` | `report-content-review:view` |
| 报告内容审核 | 查看详情 | `任务明细` 抽屉加载 | `GET /api/v1/report-content-reviews/{projectId}` | `report-content-review:view` |
| 报告内容审核 | 自动入待办 | `技术审核通过后自动创建并行任务` | `无手工 submit 接口` | `无 submit 权限码` |
| 编制分配 | 查看列表 | `/report-compile-assignments` 页面进入与刷新 | `GET /api/v1/report-compile-assignments` | `report-compile-assignment:view` |
| 编制分配 | 查看详情 | 编辑弹窗加载前明细 | `GET /api/v1/report-compile-assignments/{projectId}` | `report-compile-assignment:view` |
| 编制分配 | 查看候选池 | 页面候选池加载 | `GET /api/v1/report-compile-assignments/candidates` | `report-compile-assignment:candidate:view` |
| 编制分配 | 保存分配 | `编辑分配`、`保存` | `PUT /api/v1/report-compile-assignments/{projectId}` | `report-compile-assignment:save` |
| 编制分配 | 提交分配 | `提交分配` | `POST /api/v1/report-compile-assignments/{projectId}/submit` | `report-compile-assignment:submit` |
| 报告编制 | 查看列表 | `/report-compile-submissions` 页面进入与刷新 | `GET /api/v1/report-compile-submissions` | `report-compile-submission:view` |
| 报告编制 | 查看详情 | 编辑弹窗加载前明细 | `GET /api/v1/report-compile-submissions/{projectId}` | `report-compile-submission:view` |
| 报告编制 | 保存草稿 | `编辑`、`上传报告文件`、`保存草稿` | `PUT /api/v1/report-compile-submissions/{projectId}` | `report-compile-submission:save` |
| 报告编制 | 提交报告 | `提交报告` | `POST /api/v1/report-compile-submissions/{projectId}/submit` | `report-compile-submission:submit` |
| 最终审核 | 查看列表 | `/report-final-reviews` 页面进入与刷新 | `GET /api/v1/report-final-reviews` | `report-final-review:view` |
| 最终审核 | 查看详情 | 编辑弹窗加载前明细 | `GET /api/v1/report-final-reviews/{projectId}` | `report-final-review:view` |
| 最终审核 | 查看候选池 | 页面候选池加载 | `GET /api/v1/report-final-reviews/candidates` | `report-final-review:candidate:view` |
| 最终审核 | 保存配置 | `编辑`、`保存` | `PUT /api/v1/report-final-reviews/{projectId}` | `report-final-review:save` |
| 最终审核 | 自动入待办 | `保存审核人后自动创建` | `无手工 submit 接口` | `无 submit 权限码` |
| 材料归档 | 查看列表 | `/material-archives` 页面进入与刷新 | `GET /api/v1/material-archives` | `material-archive:view` |
| 材料归档 | 查看详情 | 编辑弹窗加载前明细 | `GET /api/v1/material-archives/{projectId}` | `material-archive:view` |
| 材料归档 | 保存草稿 | `编辑`、`上传报告文件`、`上传表单文件`、`保存草稿` | `PUT /api/v1/material-archives/{projectId}` | `material-archive:save` |
| 材料归档 | 提交归档 | `提交归档` | `POST /api/v1/material-archives/{projectId}/submit` | `material-archive:submit` |

## 约定
1. 页面进入权限统一用 `*:view`。
2. 前端默认“无权限隐藏按钮”，后端始终保留接口强校验。
3. 同一弹窗内包含新建和编辑时，保存按钮使用 `create/update` 任一权限可见。
