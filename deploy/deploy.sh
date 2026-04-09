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
command -v node >/dev/null 2>&1 || { echo "需要安装 Node.js (>=20)"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "需要安装 pnpm"; exit 1; }
echo "   环境检查通过 ✓"

# 2. 环境变量
echo ""
echo ">> Step 2: 检查环境变量..."
if [ ! -f .env ]; then
  echo "   .env 文件不存在，从 .env.example 复制..."
  cp .env.example .env
  echo "   ⚠️  请修改 .env 中的以下配置："
  echo "      - DATABASE_URL（数据库连接）"
  echo "      - JWT_SECRET（改为随机强密码）"
  echo "      - MINIO_ACCESS_KEY / MINIO_SECRET_KEY"
  echo "      - DINGTALK_*（钉钉登录配置）"
  echo "   修改完成后重新运行此脚本。"
  exit 1
fi
echo "   .env 文件存在 ✓"

# 3. 安装依赖
echo ""
echo ">> Step 3: 安装依赖..."
pnpm install
echo "   依赖安装完成 ✓"

# 4. 数据库迁移
echo ""
echo ">> Step 4: 数据库迁移..."
cd packages/server
pnpm db:migrate
cd ../..
echo "   迁移完成 ✓"

# 5. 种子数据
echo ""
echo ">> Step 5: 导入种子数据..."
docker exec -i nature-postgres psql -U nature -d nature < scripts/seed.sql
echo "   种子数据导入完成 ✓"

# 6. 构建
echo ""
echo ">> Step 6: 构建后端和前端..."
cd packages/server && pnpm build && cd ../..
cd packages/web && pnpm build && cd ../..
echo "   构建完成 ✓"

# 7. 完成
echo ""
echo "=========================================="
echo " 部署完成!"
echo ""
echo " 管理员账号: admin / admin123"
echo ""
echo " 启动后端: systemctl start nature-api"
echo " 前端目录: packages/web/dist/"
echo "=========================================="
