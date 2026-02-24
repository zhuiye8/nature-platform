# MVP 范围（已实现基线）

## 已实现接口

- `POST /api/v1/auth/login`
- `GET /api/v1/auth/dingtalk/url`
- `GET /api/v1/auth/me`
- `GET /api/v1/notifications/unread-count`
- `GET /api/v1/notifications`
- `POST /api/v1/notifications/{id}/read`
- `POST /api/v1/notifications/read-all`
- `DELETE /api/v1/notifications/{id}`
- `GET /api/v1/workflow/tasks/todo`
- `POST /api/v1/files/upload`

## 说明

- 当前通知与流程待办为内存实现，用于打通端到端链路。
- 下一阶段将迁移到数据库与流程引擎任务持久化。

