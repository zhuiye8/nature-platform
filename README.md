# Nature Platform (codex 基线)

本目录是基于 `REQUIREMENTS.md` 的重建基线，实现目标为：

- 新架构独立起盘（不依赖旧实现）
- 模块化单体（后端）+ SPA（前端）
- MVP 到 V1 的可持续迭代骨架

## 当前已落地

- 后端基础工程：Spring Boot 3.5 + Java 21 + JWT + Flowable 7.2.0 依赖基线
- 前端基础工程：Vue3 + Vite + Element Plus + Pinia
- 基础接口：登录、当前用户、通知中心、流程待办、文件上传
- 部署骨架：MySQL + Redis + MinIO + API + Web + Gateway（Docker Compose）
- 架构文档：ADR 与目录级文档

## 快速启动（本地开发）

1. 启动基础组件

```powershell
cd C:\work\nature\codex\deploy\compose
Copy-Item .env.example .env -Force
docker compose up -d mysql redis minio
```

2. 启动后端

```powershell
cd C:\work\nature\codex\nature-platform-api
mvn spring-boot:run
```

3. 启动前端

```powershell
cd C:\work\nature\codex\nature-platform-web
pnpm install
pnpm dev
```

## 下一步

- 按 `docs/spec` 补齐领域模型与 16 节点流程定义
- 将通知、留痕、任务从内存实现迁移到数据库持久化
- 完成 V1 验收清单自动化测试

