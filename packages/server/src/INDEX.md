<!-- FORMAT-DOC: Update when files in this folder change -->

# packages/server/src

服务端源码根目录，负责启动 NestJS 应用并装配数据库、认证、工作流及各业务模块。
更细的业务实现位于 `modules/`、`database/` 与 `common/` 子目录。

## Files

| File | Role | Responsibilities |
|---|---|---|
| app.module.ts | Module | 汇总全局配置、数据库模块和所有业务模块 |
| main.ts | Bootstrap | 启动 HTTP 服务并配置前缀、CORS、校验、过滤器与响应拦截器 |
