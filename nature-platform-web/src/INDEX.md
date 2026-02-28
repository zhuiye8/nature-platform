<!-- FORMAT-DOC: Update when files in this folder change -->

# src

前端业务源码目录，包含应用壳层、路由鉴权、业务流程页面与系统管理页面实现。

## Files

| File | Role | Responsibilities |
|---|---|---|
| App.vue | View | 应用根组件，装配侧栏、顶栏与路由页面，并提供全局中文组件 locale |
| api.ts | API | 统一 Axios 客户端、鉴权头注入与 401/403 全局拦截提示 |
| main.ts | Entry | 注册 Pinia、路由、Element Plus 中文 locale、Message/MessageBox/Notification 样式与全局权限指令并挂载应用 |
| auth-service.ts | Service | 封装登录、当前用户资料与钉钉登录链接接口 |
| auth-store.ts | Store | 管理 token、用户名、显示名称、角色、资源与菜单树会话状态 |
| navigation.ts | Config | 维护导航分组/路由元数据，并支持后端菜单树渲染 |
| router.ts | Router | 前端路由与页面资源访问守卫（含统一审核详情页路由） |
| resource-mapping.ts | Utility | 将 legacy permission code 映射为页面资源键 |
| permission.ts | Utility | 提供 hasPermission/hasResource 与全局权限指令能力 |
| LoginView.vue | View | 登录页，支持账号密码与钉钉授权登录 |
| DashboardView.vue | View | 仪表盘与快捷入口页面 |
| CustomersView.vue | View | 客户管理页面，支持省/市/区三级联动与必填校验 |
| ContractSubmissionsView.vue | View | 合同提审页面，支持合同新建/编辑/删除/提交审核 |
| ContractArchivesView.vue | View | 合同归档页面，支持按日签订归档、节点内合同详情查看与归档信息上传 |
| ProjectRegistersView.vue | View | 项目登记页面，支持建单、提审、流程轨迹查看、可选归档合同显式反馈与必填校验提示 |
| PoliceRegistersView.vue | View | 公安登记页面，支持草稿保存与提交流程 |
| OnSiteAssessmentsView.vue | View | 现场测评页面，支持 ZIP 上传、整改信息展示、审核人分配与统一提交审核入口 |
| QualityReviewsView.vue | View | 质量审核页面，展示质量阶段状态并支持跳转统一详情页 |
| ReportTechReviewsView.vue | View | 报告技术审核页面，基于统一 displayStatus 展示状态并支持节点内“通过/需要整改”与统一详情页 |
| ReportContentReviewsView.vue | View | 报告内容审核页面（技术/管理/网络），基于 displayStatus 展示并行任务聚合状态并跳转统一详情页 |
| ReportCompileAssignmentsView.vue | View | 编制分配页面 |
| ReportCompileSubmissionsView.vue | View | 报告编制提交页面 |
| ReportFinalReviewsView.vue | View | 最终审核页面，审核人保存后自动同步待办任务并支持统一详情页跳转 |
| MaterialArchivesView.vue | View | 材料归档页面 |
| WorkflowView.vue | View | 待办审批中心页面，基于统一 displayStatus 渲染状态并支持“通过/需要整改”确认与统一详情页入口 |
| TaskDetailView.vue | View | 统一审核详情页，合同详情改走 workflow 审核接口，附件下载携带 taskType/bizId 进行归属校验 |
| ProcessOverviewView.vue | View | 流程详情聚合查看页面 |
| AdminUsersView.vue | View | 用户管理页面 |
| AdminRolesView.vue | View | 角色管理页面，支持角色资源与用户分配 |
| AdminResourcesView.vue | View | 资源管理页面 |
| AdminWorkflowView.vue | View | 流程管理页面（定义与节点规则），节点规则弹窗加宽并按角色名称下拉选择 |
| AdminAuditLogsView.vue | View | 审计日志页面 |
| RecycleBinView.vue | View | 回收站页面 |
| admin-service.ts | Service | 管理后台用户/角色/资源/流程/审计日志接口封装 |
| contract-service.ts | Service | 合同提审/归档相关接口封装 |
| customer-service.ts | Service | 客户 CRUD 接口封装 |
| on-site-assessment-service.ts | Service | 现场测评接口封装，含候选人查询、分配提交与整改上下文字段 |
| project-register-service.ts | Service | 项目登记 CRUD、流程轨迹与归档合同选项接口封装 |
| process-overview-service.ts | Service | 流程详情聚合接口封装 |
| file-service.ts | Service | 文件下载链接接口封装（objectKey + taskType + bizId -> 直链 URL） |
| quality-review-service.ts | Service | 质量审核接口封装 |
| task-detail-service.ts | Service | 审核详情路由与任务类型规范化工具 |
| workflow-service.ts | Service | 流程任务中心接口封装，包含待办读取/审核动作与合同审核详情接口 |
| report-tech-review-service.ts | Service | 技术审核列表/详情/候选人/保存接口封装（含 displayStatus） |
| report-content-review-service.ts | Service | 内容审核列表/详情接口封装（并行任务由流程自动创建，含 displayStatus） |
| report-final-review-service.ts | Service | 最终审核列表/详情/候选人/保存接口封装（保存后自动同步待办，含 displayStatus） |
| components/layout/AppSidebar.vue | Component | 侧边导航组件 |
| components/layout/AppTopbar.vue | Component | 顶栏组件，展示当前页面与显示名称 |
| components/layout/PageContainer.vue | Component | 页面容器组件 |
