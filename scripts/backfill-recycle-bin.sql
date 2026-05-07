-- ============================================================================
-- 一次性脚本：把现有"孤立软删数据"补写进 recycle_bin
--
-- 背景：
--   2026-05-07 RecycleService 接入 4 种 bizType（CONTRACT / CONTRACT_GROUP /
--   PROJECT_REGISTER / PLATFORM）。但生产中已有 deleted=TRUE 的历史记录全部
--   未在 recycle_bin 中（因为旧版 service.remove 只 set deleted=true 没写 recycle_bin）。
--   不补写就会导致这些数据"卡在死区"：主列表看不到 + 回收站也看不到。
--
-- 处理：
--   按 deleted_at 顺序回填到 recycle_bin。deletedBy 优先用 updatedBy，
--   否则回退 createdBy（两个都 NULL 的极端情况用 admin id=1 兜底）。
--   displayName 按 bizType 取最具识别度的字段（合同名 / 合同组名 / 申请单名 / "P-编号 平台名"）。
--
-- 幂等：
--   用 NOT EXISTS 子查询防重复，重复执行不会再插。
--
-- 用法：
--   docker exec -i nature-postgres psql -U nature -d nature \
--     < scripts/backfill-recycle-bin.sql
-- ============================================================================

BEGIN;

-- ── CONTRACT ──────────────────────────────────────────────────────────────
INSERT INTO recycle_bin (biz_type, biz_id, display_name, snapshot_json, deleted_by, deleted_at)
SELECT
  'CONTRACT',
  c.id,
  COALESCE(c.contract_name, c.contract_no, '合同#' || c.id::TEXT),
  to_jsonb(c),
  COALESCE(c.updated_by, c.created_by, 1),
  COALESCE(c.deleted_at, NOW())
FROM contract c
WHERE c.deleted = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM recycle_bin r
    WHERE r.biz_type = 'CONTRACT' AND r.biz_id = c.id
  );

-- ── CONTRACT_GROUP ───────────────────────────────────────────────────────
INSERT INTO recycle_bin (biz_type, biz_id, display_name, snapshot_json, deleted_by, deleted_at)
SELECT
  'CONTRACT_GROUP',
  g.id,
  COALESCE(g.group_name, '合同组#' || g.id::TEXT),
  to_jsonb(g),
  COALESCE(g.updated_by, g.created_by, 1),
  COALESCE(g.deleted_at, NOW())
FROM contract_group g
WHERE g.deleted = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM recycle_bin r
    WHERE r.biz_type = 'CONTRACT_GROUP' AND r.biz_id = g.id
  );

-- ── PROJECT_REGISTER ──────────────────────────────────────────────────────
INSERT INTO recycle_bin (biz_type, biz_id, display_name, snapshot_json, deleted_by, deleted_at)
SELECT
  'PROJECT_REGISTER',
  p.id,
  COALESCE(p.application_name, '项目#' || p.id::TEXT),
  to_jsonb(p),
  COALESCE(p.updated_by, p.created_by, 1),
  COALESCE(p.deleted_at, NOW())
FROM project_register p
WHERE p.deleted = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM recycle_bin r
    WHERE r.biz_type = 'PROJECT_REGISTER' AND r.biz_id = p.id
  );

-- ── PLATFORM ──────────────────────────────────────────────────────────────
INSERT INTO recycle_bin (biz_type, biz_id, display_name, snapshot_json, deleted_by, deleted_at)
SELECT
  'PLATFORM',
  p.id,
  COALESCE(
    CASE
      WHEN p.platform_no IS NOT NULL AND p.platform_name IS NOT NULL
        THEN p.platform_no || ' ' || p.platform_name
      WHEN p.platform_no IS NOT NULL THEN p.platform_no
      WHEN p.platform_name IS NOT NULL THEN p.platform_name
      ELSE NULL
    END,
    '平台#' || p.id::TEXT
  ),
  to_jsonb(p),
  COALESCE(p.updated_by, p.created_by, 1),
  COALESCE(p.deleted_at, NOW())
FROM registration_platform p
WHERE p.deleted = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM recycle_bin r
    WHERE r.biz_type = 'PLATFORM' AND r.biz_id = p.id
  );

-- ── 验证 ──────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_total INT;
  v_contract INT;
  v_group INT;
  v_project INT;
  v_platform INT;
BEGIN
  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE biz_type = 'CONTRACT'),
         COUNT(*) FILTER (WHERE biz_type = 'CONTRACT_GROUP'),
         COUNT(*) FILTER (WHERE biz_type = 'PROJECT_REGISTER'),
         COUNT(*) FILTER (WHERE biz_type = 'PLATFORM')
    INTO v_total, v_contract, v_group, v_project, v_platform
    FROM recycle_bin;

  RAISE NOTICE '═══ recycle_bin backfill 完成 ═══';
  RAISE NOTICE '总行数: %', v_total;
  RAISE NOTICE 'CONTRACT: %', v_contract;
  RAISE NOTICE 'CONTRACT_GROUP: %', v_group;
  RAISE NOTICE 'PROJECT_REGISTER: %', v_project;
  RAISE NOTICE 'PLATFORM: %', v_platform;
END $$;

COMMIT;
