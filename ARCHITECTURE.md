<!-- FORMAT-DOC: Update when project structure or architecture changes -->

# Architecture

该仓库采用 `pnpm` monorepo 组织，核心由服务端、Web 前端和共享契约三部分组成。
`packages/server/src` 提供 NestJS API、认证、工作流与业务模块，并通过 Drizzle 连接 PostgreSQL。
`packages/web/src` 提供 Vue 3 + Vite 管理端，消费服务端 `/api` 接口并复用共享类型。
`packages/shared/src` 统一维护类型、常量与校验器，作为前后端公共依赖。
本地基础设施通过 `docker/docker-compose.yml` 提供数据库、Redis 与对象存储。
`packages/terminal` 当前仍是占位包，暂未形成独立源码层。

## Modules

- [packages/server/src](packages/server/src/INDEX.md) - NestJS 服务入口与根模块装配层
- [packages/web/src](packages/web/src/INDEX.md) - Vue 前端入口与应用装配层
- [packages/shared/src](packages/shared/src/INDEX.md) - 前后端共享契约出口
