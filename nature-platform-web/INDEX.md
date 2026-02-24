<!-- FORMAT-DOC: Update when files in this folder change -->

# nature-platform-web

前端工程根目录，负责构建配置、开发代理与 UI 冒烟测试入口。

## Files

| File | Role | Responsibilities |
|---|---|---|
| vite.config.ts | Config | 配置 Vite、Vue 插件、Element Plus 自动导入/自动注册、`/api` 到 `localhost:18080` 代理与分包策略 |
| playwright.config.ts | Config | Playwright 冒烟测试运行配置、报告输出与本地 webServer 启动参数 |
| smoke-auth-and-entry.spec.ts | Test | 覆盖登录成功与回收站权限提示的关键冒烟断言 |
| smoke-onsite-assignment.spec.ts | Test | 覆盖现场测评页面可达性、四角色分配候选池绑定与未选齐拦截断言 |
