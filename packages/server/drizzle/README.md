# 数据库迁移指南

本项目使用 **Drizzle Kit** 管理数据库结构变更。

## 新环境搭建

```bash
# 1. 启动数据库容器
cd docker && docker compose --env-file docker.env up -d

# 2. 执行迁移（创建所有表）
cd packages/server && pnpm db:migrate

# 3. 导入种子数据（角色、权限、工作流、管理员账号等）
docker exec -i nature-postgres psql -U nature -d nature < scripts/seed.sql

# 4. 启动后端
pnpm dev
```

## 日常开发：修改表结构

```bash
# 1. 修改 Drizzle schema 文件
#    位置: packages/server/src/database/schema/*.ts

# 2. 生成迁移文件
cd packages/server && pnpm db:generate

# 3. 检查生成的 SQL 文件
#    位置: packages/server/drizzle/xxxx_*.sql
#    确认 ALTER TABLE 语句是否正确

# 4. 应用迁移
pnpm db:migrate

# 5. 提交代码（schema 文件 + 迁移文件必须一起提交）
git add src/database/schema/ drizzle/
git commit -m "db: 描述你的变更"
```

## 生产部署

```bash
cd ~/nature-platform
git pull
cd packages/server
pnpm db:migrate          # 只执行新的迁移，数据不丢失
systemctl restart nature-api
```

如果有新增种子数据（新角色、新权限等），需要额外执行：
```bash
docker exec -i nature-postgres psql -U nature -d nature < scripts/seed.sql
```
seed.sql 是幂等的，重复执行不会报错。

## 多人协作注意事项

1. **改 schema 后必须 generate**：改了 `*.ts` 不 generate 就提交 = 其他人无法迁移
2. **先 pull 再 generate**：合并最新代码后再生成迁移，避免序号冲突
3. **检查生成的 SQL**：drizzle-kit 可能生成意外的 DROP 语句，务必人工确认
4. **迁移文件不可手动修改**：已执行的迁移文件不能改，否则校验不通过

## 常见问题

**Q: 迁移报错 "migration already applied"**
A: 该迁移已经执行过，可以忽略。

**Q: 生成的 SQL 包含 DROP TABLE**
A: 检查是否有 schema 文件被误删。不要直接执行，先回退检查。

**Q: 新建环境时触发器不生效（updated_at 不自动更新）**
A: 触发器在 seed.sql 中维护，确保执行了 seed.sql。

**Q: Windows 下 psql 命令不可用**
A: 使用 `docker exec -i nature-postgres psql -U nature -d nature < scripts/seed.sql`

## 文件结构

```
packages/server/
├── drizzle/                    # 迁移文件（git 跟踪）
│   ├── 0000_small_warbird.sql  # 基线迁移
│   ├── meta/                   # drizzle-kit 元数据
│   └── README.md               # 本文件
├── drizzle.config.ts           # drizzle-kit 配置
└── src/database/schema/        # Drizzle schema 定义
scripts/
├── seed.sql                    # 种子数据（幂等）
```
