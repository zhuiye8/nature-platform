# 前端主题重构与性能优化报告（2026-02-12）

## 1. 本轮目标
1. 统一浅色蓝灰主题（全局 + 核心页面）
2. 提升 UI/UX：布局层级、状态反馈、信息密度与移动端可用性
3. 做基础分包优化，降低首包压力

## 2. 主要改动

### 2.1 主题系统
- 新增 `nature-platform-web/src/styles/tokens.css`
- 新增 `nature-platform-web/src/styles/base.css`
- 新增 `nature-platform-web/src/styles/element-overrides.css`
- `main.ts` 接入主题样式层

### 2.2 核心页面重构
- `App.vue`：响应式壳层导航（桌面横向 + 移动抽屉）
- `LoginView.vue`：双栏登录页，主次操作与反馈更清晰
- `DashboardView.vue`：统计卡 + 快捷入口 + 通知时间线重排
- `WorkflowView.vue`：筛选区、待办表格、权限反馈样式统一
- `OnSiteAssessmentsView.vue`：节点规则提示强化、分配弹窗可读性提升

### 2.3 构建性能
- `router.ts` 改为路由懒加载
- `vite.config.ts` 增加 `manualChunks`
  - `vue-vendor`
  - `element-vendor`
  - `utils-vendor`

## 3. 验证结果
1. `pnpm test:e2e`：4/4 通过
2. `pnpm build`：通过
3. `mvn -q test`：通过
4. `check_format_doc.py --mode changed --allow-missing-architecture`：通过

## 4. 构建结果对比（关键结论）
- 改造前：主业务 JS 单包约 `1,153.07 kB`
- 改造后：入口 `index-*.js` 约 `9.62 kB`，核心依赖拆分到 `vue-vendor` / `utils-vendor` / `element-vendor`
- 仍有风险：`element-vendor` 约 `893.44 kB`，仍超 `500 kB` 告警阈值

## 5. 下一步最小任务
1. 按页面使用频率对 Element Plus 组件进一步按需拆分（减少 `element-vendor` 体积）
2. 引入路由级 skeleton/loading 过渡，提升懒加载体感