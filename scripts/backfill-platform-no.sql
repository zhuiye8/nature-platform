-- ============================================================================
-- 一次性脚本：给历史 registration_platform 赋业务编号 platform_no
--
-- 背景：
--   2026-05-07 引入 platform_no 业务编号字段（P-0001 格式）。
--   现有数据 platform_no 为 NULL，需要按 id ASC 顺序回填，并把
--   platform_serial.next_seq 校准到当前最大序号，让下一次新建从 P-{max+1} 开始。
--
-- 执行方式：
--   docker exec -i nature-postgres psql -U nature -d nature \
--     < scripts/backfill-platform-no.sql
--
-- 幂等性：
--   - 仅给 platform_no IS NULL 的行赋号
--   - platform_serial UPSERT，已存在则按当前最大值 max(seq) 校准（不会倒退）
-- ============================================================================

BEGIN;

-- ── 1. 按 id ASC 顺序赋号 P-0001, P-0002, ... ─────────────────────────────
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id ASC) AS rn
  FROM registration_platform
  WHERE platform_no IS NULL
)
UPDATE registration_platform p
SET platform_no = 'P-' || LPAD(r.rn::TEXT, 4, '0')
FROM ranked r
WHERE p.id = r.id;

-- ── 2. 校准 platform_serial 计数器到当前最大序号 ─────────────────────────
-- 解析所有 platform_no 取最大数值（含可能的非默认前缀变种 — 当前只用 P-{4位} 一种）
WITH max_seq AS (
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(platform_no FROM 'P-(\d+)') AS INTEGER)),
    0
  ) AS v
  FROM registration_platform
  WHERE platform_no ~ '^P-\d+$'
)
INSERT INTO platform_serial (id, next_seq)
SELECT 1, v FROM max_seq
ON CONFLICT (id) DO UPDATE
  SET next_seq = GREATEST(platform_serial.next_seq, EXCLUDED.next_seq),
      updated_at = NOW();

-- ── 3. 验证 ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_total INT;
  v_filled INT;
  v_null INT;
  v_min TEXT;
  v_max TEXT;
  v_seq INT;
BEGIN
  SELECT COUNT(*),
         COUNT(platform_no),
         COUNT(*) FILTER (WHERE platform_no IS NULL),
         MIN(platform_no), MAX(platform_no)
    INTO v_total, v_filled, v_null, v_min, v_max
    FROM registration_platform;
  SELECT next_seq INTO v_seq FROM platform_serial WHERE id = 1;

  RAISE NOTICE '═══ platform_no backfill 完成 ═══';
  RAISE NOTICE '总行数: %', v_total;
  RAISE NOTICE '已赋号: %', v_filled;
  RAISE NOTICE '未赋号: %（应为 0，除非该字段被显式清空）', v_null;
  RAISE NOTICE '编号范围: % - %', v_min, v_max;
  RAISE NOTICE 'platform_serial.next_seq 当前值: %（下一次新建为 P-{next_seq+1}）', v_seq;
END $$;

COMMIT;
