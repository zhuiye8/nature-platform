# 生产环境上线部署清单（2026-04 正式启用）

## 目标

- 升级 14 个 commit 到最新（含财务模块、PM 资格独立化等）
- 清空所有测试业务数据
- 注入 51 位正式员工账号（默认密码 `nature@2026`，首次登录必须改密）

## 前置准备

```bash
ssh root@192.168.9.170
cd /root/nature-platform
```

## 步骤 1：备份（必须！）

```bash
docker exec nature-postgres pg_dump -U nature -d nature \
  > backup-prod-before-reset-$(date +%Y%m%d-%H%M%S).sql

# 确认备份文件存在且大小合理（通常 > 100KB）
ls -lh backup-prod-before-reset-*.sql
```

## 步骤 2：拉代码 + 构建

```bash
git fetch origin master
git log HEAD..origin/master --oneline   # 查看会更新哪些 commit
git pull origin master

# 安装依赖（含本次新增的 sharp / pdf-lib 等水印库）
pnpm install

# 构建
pnpm build
```

## 步骤 3：执行数据库迁移（应用 schema 变更）

```bash
pnpm --filter @nature/server db:migrate
```

> ⚠ 不要用 `pnpm --filter @nature/server drizzle-kit migrate`，要用 package.json 里的 `db:migrate` 脚本。

## 步骤 4：注入新角色（chairman + project_manager）

```bash
# 重新跑 seed.sql 即可（幂等，不影响已有数据）
docker exec -i nature-postgres psql -U nature -d nature < scripts/seed.sql
```

预期结果：iam_role 表新增 `chairman` 和 `project_manager` 两条记录（其他角色已存在因 ON CONFLICT 跳过）。

## 步骤 5：清空业务数据

```bash
docker exec -i nature-postgres psql -U nature -d nature \
  < scripts/cleanup-prod-data.sql
```

预期 NOTICE 输出：

```
=== 清理后状态 ===
用户数: 1（期望 1，仅 admin）
用户角色绑定: 1（期望 1，仅 admin → super_admin）
合同数: 0（期望 0）
项目数: 0（期望 0）
角色定义: 19（应保留）
资源/菜单定义: 25（应保留）
工作流定义: 4（应保留）
```

## 步骤 6：注入 51 位员工

```bash
docker exec -i nature-postgres psql -U nature -d nature \
  < scripts/seed-prod-staff.sql
```

预期 NOTICE 输出：

```
=== 生产人员入库完成 ===
总用户数（排除 admin）: 51
角色绑定总数: 82
项目经理资格人数: 13
测评师人数: 36
董事长人数: 2
财务人数: 2
已填证书编号: 36
强制改密用户数: 51
```

末尾还会列出"用户 → 角色"清单，肉眼核对一遍。

## 步骤 7：重启服务

```bash
# 如果是 systemd
systemctl restart nature-api

# 或者 pm2
pm2 restart nature-api

# 看日志确认无报错
journalctl -u nature-api -n 50 --no-pager
```

## 步骤 8：验证

| 检查项 | 怎么验 |
|---|---|
| 登录 | admin / admin123 进入系统，能看到所有菜单 |
| 普通员工首次登录 | 用 `xiebaojian` / `nature@2026` 登录，应弹出"修改密码"提示 |
| 角色生效 | 用 `chenxindong` 登录，能看到"项目登记"菜单（项目主管） |
| PM 候选池 | admin 触发任意项目的 DIRECTOR_REVIEW，看候选名单是否仅包含 13 个 PM |
| 财务模块 | admin 进入"合同财务"页，能看到空列表（已清数据）但页面不报错 |
| 工作流 | 用 `xiebaojian` 创建客户/合同跑通审核，确认无 schema 报错 |

## 默认账号清单

| 用户名 | 默认密码 | 角色 |
|---|---|---|
| `admin` | `admin123` | 超级管理员（不强制改密）|
| 其他 51 人 | `nature@2026` | 见 docx，首次登录强制改密 |

> 51 个用户名见 `scripts/seed-prod-staff.sql` 第 35-91 行。

## 回滚

任何步骤失败可执行回滚：

```bash
# 1. 停服务
systemctl stop nature-api

# 2. 恢复数据库
docker exec -i nature-postgres psql -U nature -d nature \
  < backup-prod-before-reset-YYYYMMDD-HHMMSS.sql

# 3. 切回旧 commit
git checkout afa8119   # 升级前的 HEAD
pnpm install && pnpm build

# 4. 启动服务
systemctl start nature-api
```
