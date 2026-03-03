<!-- FORMAT-DOC: Update when files in this folder change -->

# nature-platform-web

前端工程根目录，负责构建配置、开发代理与 UI 冒烟测试入口。

## Files

| File | Role | Responsibilities |
|---|---|---|
| smoke-permission-report-workflow.spec.ts | Test | 冒烟校验普通用户在报告链路与待办审批页面的菜单可见性和路由拦截行为 |
| vite.config.ts | Config | 配置开发服务器 allowedHosts/代理与生产构建分包策略，支持 FRP 域名访问调试 |
