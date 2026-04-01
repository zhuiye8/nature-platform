#!/bin/bash
# Nature 等保测评平台 — 生产部署脚本
# 使用方法: bash deploy.sh
set -e

echo "=========================================="
echo " Nature 等保测评平台 — 生产部署"
echo "=========================================="

# 1. 检查环境
echo ""
echo ">> Step 1: 检查环境..."
command -v docker >/dev/null 2>&1 || { echo "需要安装 Docker"; exit 1; }
command -v docker compose >/dev/null 2>&1 || { echo "需要安装 Docker Compose"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "需要安装 Node.js (>=18)"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "需要安装 pnpm"; exit 1; }
echo "   环境检查通过 ✓"

# 2. 环境变量
echo ""
echo ">> Step 2: 检查环境变量..."
if [ ! -f .env ]; then
  echo "   .env 文件不存在，从 .env.example 复制..."
  cp .env.example .env
  echo "   ⚠️  请修改 .env 中的以下配置："
  echo "      - JWT_SECRET（改为随机强密码）"
  echo "      - CORS_ORIGIN（改为生产域名）"
  echo "      - 数据库密码"
  echo "      - MinIO 密码"
  echo "   修改完成后重新运行此脚本。"
  exit 1
fi
echo "   .env 文件存在 ✓"

# 3. 启动基础设施
echo ""
echo ">> Step 3: 启动 Docker 基础设施（PostgreSQL + Redis + MinIO）..."
cd docker
docker compose --env-file docker.env up -d
cd ..
echo "   等待服务就绪..."
sleep 10

# 检查 PostgreSQL 是否就绪
for i in {1..30}; do
  if docker exec nature-postgres pg_isready -U nature >/dev/null 2>&1; then
    echo "   PostgreSQL 就绪 ✓"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "   PostgreSQL 启动超时，请检查 Docker 日志"
    exit 1
  fi
  sleep 2
done

# 4. 安装依赖
echo ""
echo ">> Step 4: 安装依赖..."
pnpm install --frozen-lockfile
echo "   依赖安装完成 ✓"

# 5. 构建
echo ""
echo ">> Step 5: 构建后端和前端..."
pnpm build
echo "   构建完成 ✓"

# 6. 启动服务
echo ""
echo ">> Step 6: 启动服务..."
echo ""
echo "   后端启动命令:"
echo "   NODE_ENV=production node packages/server/dist/main.js"
echo ""
echo "   前端静态文件在: packages/web/dist/"
echo "   使用 nginx 或其他 Web 服务器托管"
echo ""
echo "=========================================="
echo " 部署完成!"
echo ""
echo " 默认管理员账号: admin / admin123"
echo " 后端 API: http://localhost:3010/api"
echo " 前端页面: 需要配置 Web 服务器"
echo "=========================================="
