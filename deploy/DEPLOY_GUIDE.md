# Nature 等保测评平台 — 生产部署指南

> 最后更新：2026-04-09

## 端口规划

| 服务 | 容器内端口 | 宿主机端口 | 说明 |
|------|-----------|-----------|------|
| PostgreSQL | 5432 | 15432 | 内部使用，不对外 |
| Redis | 6379 | 16379 | 内部使用，不对外 |
| MinIO API | 9000 | 19000 | 内部使用 |
| MinIO Console | 9001 | 19001 | 管理界面 |
| NestJS 后端 | 3010 | 3010 | API 服务 |
| Nginx | 80/443 | 80/443 | **唯一对外端口** |

---

## 一、前置条件

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker && systemctl start docker

# 安装 Node.js 20+ 和 pnpm
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
npm install -g pnpm

# 安装 Nginx
apt install -y nginx
```

---

## 二、克隆代码

```bash
cd ~
git clone <仓库地址> nature-platform
cd nature-platform
```

---

## 三、Docker 配置

生产用 `docker-prod.yml`（自行在服务器上维护）：
- PostgreSQL 端口映射 15432
- Redis 端口映射 16379，带密码
- MinIO 端口映射 19000/19001（低版本镜像兼容旧 CPU）
- **不挂载 schema.sql**（数据库由 Drizzle 迁移管理）

```bash
cd docker
docker compose -f docker-prod.yml --env-file docker.env up -d
```

---

## 四、配置环境变量

```bash
cp .env.example .env
vi .env
```

关键配置项：
```env
# 数据库（端口与 docker-prod.yml 对应）
DATABASE_URL=postgresql://nature:<密码>@localhost:15432/nature

# Redis
REDIS_URL=redis://:<密码>@localhost:16379

# MinIO（密钥与 docker-prod.yml 中 MINIO_ROOT_USER/PASSWORD 一致）
MINIO_ENDPOINT=http://localhost:19000
MINIO_ACCESS_KEY=<与容器一致>
MINIO_SECRET_KEY=<与容器一致>

# JWT（务必修改为随机强密码）
JWT_SECRET=<64位随机字符串>

# 钉钉登录
DINGTALK_APP_KEY=<AppKey>
DINGTALK_APP_SECRET=<AppSecret>
DINGTALK_REDIRECT_URI=https://<你的域名>/dingtalk/callback
```

---

## 五、安装依赖

```bash
cd ~/nature-platform
pnpm install
```

---

## 六、数据库初始化

```bash
cd packages/server

# 1. 执行迁移（创建所有表）
pnpm db:migrate

# 2. 导入种子数据（角色、权限、工作流、管理员账号）
docker exec -i nature-postgres psql -U nature -d nature < ../../scripts/seed.sql

# 3. 导入员工账号（首次部署，可选）
docker exec -i nature-postgres psql -U nature -d nature < ../../scripts/init-employees.sql
```

> seed.sql 是幂等的，重复执行不会报错
> init-employees.sql 创建 42 名员工，默认密码 123456，首次登录强制改密码+填手机号

---

## 七、构建

```bash
cd ~/nature-platform

# 构建后端
cd packages/server && pnpm build

# 构建前端
cd ../web && pnpm build
```

---

## 八、配置 Nginx

参考 `deploy/nginx.conf`，拷贝并修改域名：

```bash
cp ~/nature-platform/deploy/nginx.conf /etc/nginx/conf.d/nature.conf
vi /etc/nginx/conf.d/nature.conf  # 修改 server_name 和 root 路径
nginx -t && systemctl reload nginx
```

---

## 九、配置后端服务

```bash
cat > /etc/systemd/system/nature-api.service << 'EOF'
[Unit]
Description=Nature API Server
After=network.target docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/root/nature-platform/packages/server
ExecStart=/usr/bin/node dist/main.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable nature-api
systemctl start nature-api
```

---

## 十、钉钉开放平台配置

1. 登录 https://open.dingtalk.com/
2. 应用回调地址：`https://<你的域名>/dingtalk/callback`
3. 开通权限：`Contact.User.Read`

---

## 日常更新

```bash
cd ~/nature-platform
git pull

# 如果有数据库变更
cd packages/server && pnpm db:migrate

# 如果有新依赖
cd ~/nature-platform && pnpm install

# 重新构建
cd packages/server && pnpm build
cd ../web && pnpm build

# 重启后端
systemctl restart nature-api
```

---

## 紧急数据库重建

> ⚠️ 启用 Drizzle 迁移后，正常情况下不应该再删库重建

```bash
cd ~/nature-platform/docker
docker compose -f docker-prod.yml down
docker volume rm <postgres_volume_name>
docker compose -f docker-prod.yml --env-file docker.env up -d
sleep 10

cd ../packages/server
pnpm db:migrate
docker exec -i nature-postgres psql -U nature -d nature < ../../scripts/seed.sql
docker exec -i nature-postgres psql -U nature -d nature < ../../scripts/init-employees.sql
systemctl restart nature-api
```

---

## 常用命令

| 操作 | 命令 |
|------|------|
| 查看后端状态 | `systemctl status nature-api` |
| 查看后端日志 | `journalctl -u nature-api -f` |
| 重启后端 | `systemctl restart nature-api` |
| 查看容器状态 | `docker ps` |
| 进入数据库 | `docker exec -it nature-postgres psql -U nature -d nature` |
| 数据库迁移 | `cd packages/server && pnpm db:migrate` |
| 执行种子数据 | `docker exec -i nature-postgres psql -U nature -d nature < scripts/seed.sql` |
| 数据库备份 | `docker exec nature-postgres pg_dump -U nature nature > backup_$(date +%Y%m%d).sql` |
| 数据库恢复 | `cat backup.sql \| docker exec -i nature-postgres psql -U nature nature` |
