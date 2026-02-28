<!-- FORMAT-DOC: Update when files in this folder change -->

# nature-platform-web

前端工程根目录，负责构建配置、开发代理与 UI 冒烟测试入口。

## Files

| File | Role | Responsibilities |
|---|---|---|
| smoke-auth-and-entry.spec.ts | Test | 覆盖登录成功与普通用户访问回收站被路由守卫重定向断言，并在用例内通过管理员接口自动预置普通用户 |
| smoke-customer-contract-regression.spec.ts | Test | 覆盖客户创建 403 错误反馈可见性与合同提审页客户选择默认空值回归断言 |
| smoke-onsite-assignment.spec.ts | Test | 覆盖现场测评页面可达性、四角色分配候选池绑定与未选齐拦截断言 |
| smoke-permission-core-pages.spec.ts | Test | 覆盖核心业务页（含合同提审/合同归档）菜单显隐与无权限路由重定向断言 |
| smoke-permission-report-workflow.spec.ts | Test | 覆盖报告链路与待办审批菜单显隐及无权限路由重定向断言，并在用例内通过管理员接口自动预置普通用户 |
| smoke-task-detail-review.spec.ts | Test | 覆盖合同审核详情页请求 workflow 审核详情接口并展示页内审核操作区断言 |
