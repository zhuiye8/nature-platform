<!-- FORMAT-DOC: Update when files in this folder change -->

# packages/web/src

前端源码根目录，负责创建 Vue 应用并挂载路由、状态管理、UI 组件库与全局样式。
具体页面、API 封装和业务组合逻辑分别位于 `pages/`、`api/` 和 `composables/`。

## Files

| File | Role | Responsibilities |
|---|---|---|
| App.vue | UI Root | 提供应用根组件并承载路由视图 |
| env.d.ts | Types | 声明 Vite 前端环境类型 |
| main.ts | Bootstrap | 创建应用实例并注册 Pinia、Router、Element Plus 与权限指令 |
