<!-- FORMAT-DOC: Update when files in this folder change -->

# src

前端运行时代码目录，负责应用壳层、业务页面、API 封装与全局主题样式。
本轮继续完成核心业务页面中文文案规范化（修复截断词、错词）与审核确认弹窗统一中文交互，保持页面职责不变。

## Files

| File | Role | Responsibilities |
|---|---|---|
| api.ts | API | 统一 Axios 客户端、鉴权头注入与 `401/403` 响应拦截与提示 |
| App.vue | View | 根壳层组件，按登录态切换登录页与“侧栏+顶栏+内容区”工作台布局 |
| auth-service.ts | Service | 登录、当前用户、钉钉登录链接等认证接口封装 |
| auth-store.ts | Store | 会话令牌、用户名与角色状态管理 |
| contract-service.ts | Service | 合同相关查询、保存、提交与归档接口封装 |
| ContractsView.vue | View | 合同管理与审核提交流程页面（客户字段空值初始、提交前收窄校验） |
| customer-service.ts | Service | 客户信息接口封装 |
| CustomersView.vue | View | 客户管理页面 |
| DashboardView.vue | View | 仪表盘、快捷入口与通知中心页面 |
| LoginView.vue | View | 账号密码/钉钉登录入口与登录后会话初始化 |
| main.ts | Module | Vue 启动入口，注册 Pinia 与路由并加载全局样式层 |
| material-archive-service.ts | Service | 材料归档节点接口封装 |
| MaterialArchivesView.vue | View | 材料归档页面（含现场 ZIP 可视） |
| navigation.ts | Module | 导航信息架构源，提供菜单分组、图标与路由标题映射 |
| notification-service.ts | Service | 通知列表、已读与删除接口封装 |
| on-site-assessment-service.ts | Service | 现场测评节点接口封装（ZIP 上传、4 角色分配、提交） |
| OnSiteAssessmentsView.vue | View | 现场测评页面，含 ZIP 上传与 TECH/A/B/C 分配 |
| police-register-service.ts | Service | 公安登记节点接口封装 |
| PoliceRegistersView.vue | View | 公安登记页面 |
| project-register-service.ts | Service | 项目登记接口封装（增删改查、审核、轨迹） |
| ProjectRegistersView.vue | View | 项目登记页面（状态文案统一为“待审核”，系统明细校验提示修正错词） |
| quality-review-service.ts | Service | 质量审核申请/任务接口封装 |
| QualityReviewsView.vue | View | 质量审核看板与任务详情页面 |
| recycle-bin-service.ts | Service | 回收站合同/项目查询与恢复接口封装 |
| RecycleBinView.vue | View | 回收站页面与超管恢复操作 |
| report-compile-service.ts | Service | 报告编制分配与编制提交接口封装 |
| report-content-review-service.ts | Service | 报告内容审核接口封装 |
| report-final-review-service.ts | Service | 报告最终审核接口封装 |
| report-tech-review-service.ts | Service | 报告技术审核接口封装 |
| ReportCompileAssignmentsView.vue | View | 报告编制分配页面 |
| ReportCompileSubmissionsView.vue | View | 报告编制上传与提交页面（节点说明文案统一为“报告最终审核”） |
| ReportContentReviewsView.vue | View | 报告内容审核页面 |
| ReportFinalReviewsView.vue | View | 报告最终审核页面 |
| ReportTechReviewsView.vue | View | 报告技术审核页面 |
| router.ts | Module | 路由定义、鉴权守卫与页面懒加载配置 |
| time.ts | Utility | 时间格式化工具（亚洲/上海时区） |
| workflow-service.ts | Service | 工作流待办、审批、驳回与详情接口封装 |
| WorkflowView.vue | View | 工作流待办中心页面 |
| components/common/PageHeaderBar.vue | UI | 通用页头容器组件（标题与操作区布局） |
| components/layout/AppSidebar.vue | UI | 左侧分组导航组件（支持折叠/移动端抽屉复用） |
| components/layout/AppTopbar.vue | UI | 顶部工具栏组件（面包屑、用户信息、退出） |
| components/layout/PageContainer.vue | UI | 工作区内容容器组件 |
| styles/base.css | Style | 全局布局与基础排版样式 |
| styles/element-overrides.css | Style | Element Plus 统一风格覆写 |
| styles/motion.css | Style | 页面切换动效与减弱动画兼容 |
| styles/tokens.css | Style | 设计令牌（色彩、间距、圆角、阴影、布局） |
