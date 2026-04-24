-- ============================================================================
-- 归档数据一致性回填脚本 (D1 + D2 + material_archive)
-- ============================================================================
--
-- 背景：
--   早期版本的代码存在以下数据一致性问题，当前代码已修复，但老数据需要回填：
--
--   D1. 合同 archive_status='ARCHIVED' 但 archived_at IS NULL
--       — 早期 contract.service.archive() 未写 archived_at 字段；
--         现在 contract.service.ts:884 已正确写入；老数据需要 backfill。
--
--   D2. project_register id=1：status='DRAFT' 但 wf_instance.status='COMPLETED'
--       — 早期工作流升级遗留的孤儿数据，项目流程已走完但业务状态停留在草稿。
--
--   MA. material_archive.status='SUBMITTED' 的历史记录
--       — 代码已改为推进到 'ARCHIVED'（B2 修复），老数据需要 backfill 对齐。
--
-- 幂等性：
--   所有 UPDATE 均带严格 WHERE 条件，重复执行安全（第二次已无匹配行）。
--
-- 执行方式：
--   docker exec -i nature-postgres psql -U nature -d nature < scripts/backfill-archive-consistency.sql
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────
-- D1. 合同 archived_at 回填
-- ────────────────────────────────────────────────────────────────

\echo '== [D1] 即将回填的合同数（archive_status=ARCHIVED 且 archived_at IS NULL）=='
SELECT COUNT(*) AS contracts_to_backfill
FROM contract
WHERE archive_status = 'ARCHIVED' AND archived_at IS NULL;

UPDATE contract
SET archived_at = updated_at
WHERE archive_status = 'ARCHIVED' AND archived_at IS NULL;

\echo '== [D1] 回填后：archive_status=ARCHIVED 且 archived_at IS NULL 的合同数（应为 0）=='
SELECT COUNT(*) AS remaining
FROM contract
WHERE archive_status = 'ARCHIVED' AND archived_at IS NULL;

-- ────────────────────────────────────────────────────────────────
-- D2. project_register id=1 状态修正
-- ────────────────────────────────────────────────────────────────

\echo '== [D2] project id=1 当前状态 =='
SELECT pr.id, pr.status, w.status AS wf_status, w.current_node
FROM project_register pr
LEFT JOIN wf_instance w ON w.biz_id = pr.id AND w.biz_type = 'PROJECT_REGISTER'
WHERE pr.id = 1;

-- 工作流已 COMPLETED 但 status=DRAFT 的孤儿 → 修正为 APPROVED（与 wf 状态一致）
UPDATE project_register
SET status = 'APPROVED', updated_at = NOW()
WHERE id = 1
  AND status = 'DRAFT'
  AND EXISTS (
    SELECT 1 FROM wf_instance w
    WHERE w.biz_id = 1 AND w.biz_type = 'PROJECT_REGISTER' AND w.status = 'COMPLETED'
  );

-- ────────────────────────────────────────────────────────────────
-- MA. material_archive 历史 status 回填（配合 B2 代码改动）
-- ────────────────────────────────────────────────────────────────

\echo '== [MA] 即将回填的 material_archive 数（status=SUBMITTED）=='
SELECT COUNT(*) AS material_archives_to_backfill
FROM material_archive
WHERE status = 'SUBMITTED';

UPDATE material_archive
SET status = 'ARCHIVED', updated_at = NOW()
WHERE status = 'SUBMITTED';

\echo '== [MA] 回填后 material_archive.status 分布 =='
SELECT status, COUNT(*) AS count
FROM material_archive
GROUP BY status
ORDER BY status;

COMMIT;

\echo '== 回填完成 =='
