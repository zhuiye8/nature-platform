-- ============================================================================
-- 公安登记 status 回填脚本
-- ============================================================================
--
-- 背景：
--   migration 0008 把 police_register.status 的 DEFAULT 从 'DRAFT' 改成 'PENDING'，
--   但没有 backfill 老数据。导致早期创建的 police_register 记录仍然是 'DRAFT'，
--   而前端 PoliceList 默认筛选 'PENDING' 时看不到这些记录（显示空列表）。
--
--   业务上 'DRAFT' 和 'PENDING' 语义等价（都表示"待登记"），应统一为 'PENDING'。
--
-- 幂等性：
--   UPDATE 带 WHERE status='DRAFT' 条件，重复执行安全（第二次已无匹配行）。
--
-- 执行方式（生产）：
--   psql $DATABASE_URL -f scripts/backfill-police-status.sql
-- 或（通过容器）：
--   docker exec -i nature-postgres psql -U nature -d nature < scripts/backfill-police-status.sql
--
-- 执行方式（本地开发）：
--   docker exec -i nature-postgres psql -U nature -d nature < scripts/backfill-police-status.sql
-- ============================================================================

BEGIN;

-- 1. 先看看有多少条会被影响（审计）
\echo '== 即将回填的 DRAFT 记录数 =='
SELECT COUNT(*) AS draft_count FROM police_register WHERE status = 'DRAFT';

-- 2. 回填
UPDATE police_register
SET status = 'PENDING', updated_at = NOW()
WHERE status = 'DRAFT';

-- 3. 确认回填后的状态分布
\echo '== 回填后 status 分布 =='
SELECT status, COUNT(*) AS count
FROM police_register
GROUP BY status
ORDER BY status;

COMMIT;

\echo '== 回填完成 =='
