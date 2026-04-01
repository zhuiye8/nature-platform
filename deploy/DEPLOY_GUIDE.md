# Nature 等保测评平台 — Ubuntu 服务器部署指南

## 端口规划

| 服务 | 默认端口 | 生产端口 | 说明 |
|------|---------|---------|------|
| PostgreSQL | 5432 | 15432 | 内部使用，不对外 |
| Redis | 6379 | 16379 | 内部使用，不对外 |
| MinIO API | 9000 | 19000 | 内部使用 |
| MinIO Console | 9001 | 19001 | 管理界面 |
| NestJS 后端 | 3010 | 13010 | API 服务 |
| Nginx | 80 | 8080 | **唯一对外端口** |

用户只需访问 `http://服务器IP:8080` 即可。

---

## 一、前置条件

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker && systemctl start docker

# 安装 Docker Compose (如果没有)
apt install docker-compose-plugin -y

# 安装 Node.js 18+ 和 pnpm
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
npm install -g pnpm

# 安装 Nginx
apt install -y nginx
```

---

## 二、克隆代码

```bash
cd /opt
git clone https://github.com/zhuiye8/nature-platform.git
cd nature-platform
git checkout master
```

---

## 三、配置 Docker（自定义端口）

创建生产用 docker-compose 文件：

```bash
cat > docker/docker-prod.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: nature-postgres
    restart: unless-stopped
    ports:
      - "15432:5432"
    environment:
      POSTGRES_DB: nature
      POSTGRES_USER: nature
      POSTGRES_PASSWORD: ${DB_PASSWORD:-nature_prod_2026}
    volumes:
      - nature_pgdata:/var/lib/postgresql/data
      - ../schema.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U nature -d nature"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:8-alpine
    container_name: nature-redis
    restart: unless-stopped
    ports:
      - "16379:6379"
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD:-nature_redis_2026}
    volumes:
      - nature_redis:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD:-nature_redis_2026}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio:latest
    container_name: nature-minio
    restart: unless-stopped
    ports:
      - "19000:9000"
      - "19001:9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_USER:-nature_minio}
      MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD:-nature_minio_2026}
    command: server /data --console-address ":9001"
    volumes:
      - nature_minio:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  nature_pgdata:
  nature_redis:
  nature_minio:
EOF
```

创建生产环境变量：

```bash
cat > docker/docker-prod.env << 'EOF'
DB_PASSWORD=nature_prod_2026
REDIS_PASSWORD=nature_redis_2026
MINIO_USER=nature_minio
MINIO_PASSWORD=nature_minio_2026
EOF
```

---

## 四、配置应用环境变量

```bash
cat > .env << 'EOF'
# Database
DATABASE_URL=postgresql://nature:nature_prod_2026@localhost:15432/nature

# Redis
REDIS_URL=redis://:nature_redis_2026@localhost:16379

# MinIO
MINIO_ENDPOINT=http://localhost:19000
MINIO_PORT=19000
MINIO_ACCESS_KEY=nature_minio
MINIO_SECRET_KEY=nature_minio_2026
MINIO_BUCKET=nature
MINIO_USE_SSL=false

# Auth — 务必修改为随机强密码！
JWT_SECRET=CHANGE_ME_TO_A_RANDOM_64_CHAR_STRING_nature_2026_prod

# Server
SERVER_PORT=13010
CORS_ORIGIN=http://localhost:8080,http://你的服务器IP:8080

# DingTalk (可选)
DINGTALK_APP_KEY=
DINGTALK_APP_SECRET=
DINGTALK_CORP_ID=
EOF
```

**⚠️ 重要**：修改 `JWT_SECRET` 为随机强密码，修改 `CORS_ORIGIN` 为实际访问地址。

---

## 五、启动基础设施

```bash
cd /opt/nature-platform

# 启动 Docker 服务
docker compose -f docker/docker-prod.yml --env-file docker/docker-prod.env up -d

# 等待初始化完成
sleep 15

# 验证数据库初始化
docker exec nature-postgres psql -U nature -d nature -c "SELECT count(*) FROM iam_role;"
# 应返回 14
```

---

## 六、导入用户数据

```bash
docker cp scripts/init-users.sql nature-postgres:/tmp/
docker exec nature-postgres psql -U nature -d nature -f /tmp/init-users.sql
```

---

## 七、构建应用

```bash
cd /opt/nature-platform

# 安装依赖
pnpm install

# 构建后端和前端
pnpm build
```

---

## 八、配置 Nginx

```bash
cat > /etc/nginx/sites-available/nature << 'EOF'
server {
    listen 8080;
    server_name _;

    # 前端静态文件
    root /opt/nature-platform/packages/web/dist;
    index index.html;

    # SPA 路由
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:13010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;

        # SSE 支持
        proxy_buffering off;
        proxy_read_timeout 86400s;
    }

    # 文件上传大小限制
    client_max_body_size 500M;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 1000;
}
EOF

# 启用站点
ln -sf /etc/nginx/sites-available/nature /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## 九、配置后端为系统服务

```bash
cat > /etc/systemd/system/nature-api.service << 'EOF'
[Unit]
Description=Nature API Server
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/nature-platform
ExecStart=/usr/bin/node packages/server/dist/main.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# 启动并设为开机自启
systemctl daemon-reload
systemctl enable nature-api
systemctl start nature-api

# 查看状态
systemctl status nature-api
```

---

## 十、验证部署

```bash
# 1. 检查后端
curl -s http://localhost:13010/api/auth/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
# 应返回 accessToken

# 2. 检查前端
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080
# 应返回 200

# 3. 浏览器访问
echo "访问地址: http://$(hostname -I | awk '{print $1}'):8080"
echo "管理员: admin / admin123"
```

---

## 常用运维命令

```bash
# 查看后端日志
journalctl -u nature-api -f

# 重启后端
systemctl restart nature-api

# 重启 Docker 服务
docker compose -f docker/docker-prod.yml --env-file docker/docker-prod.env restart

# 数据库备份
docker exec nature-postgres pg_dump -U nature nature > backup_$(date +%Y%m%d).sql

# 数据库恢复
cat backup.sql | docker exec -i nature-postgres psql -U nature nature

# 更新部署
cd /opt/nature-platform
git pull origin master
pnpm build
systemctl restart nature-api
```

---

## 端口防火墙（可选）

如果服务器有防火墙，只需开放 8080：

```bash
ufw allow 8080/tcp
# 不需要开放 15432/16379/19000/13010 等内部端口
```
