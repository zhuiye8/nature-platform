-- ============================================================================
-- 清理 2026-04 工作流升级遗留的孤儿业务数据
-- ============================================================================
--
-- 背景：
--   scripts/migrate-assessor-roles.sql (2026-04 一次性迁移脚本) 在清旧角色
--   时一并 DELETE 了 wf_instance / wf_task / wf_action_log / project_member，
--   但没有清理依附于老工作流的业务表数据，形成三类孤儿：
--
--     1. police_register 表里 status='PENDING' 但对应 wf_task 已被删除
--        → 公安登记列表显示"待登记"但待办中心看不到对应任务
--
--     2. project_system_item.system_no 已生成，但对应 project_register
--        被 migrate 脚本 UPDATE 回 'DRAFT'
--        → 销售重新提交时系统编号会跳号覆盖，用户困惑
--
--     3. material_archive 记录存在，但对应 project 的 wf_instance 已被删
--        → 材料归档列表出现无法推进的孤儿记录
--
-- 幂等性：
--   所有 DELETE/UPDATE 带 WHERE 守卫，重复执行不会误删正常数据。
--
-- 回滚：
--   整体 BEGIN/COMMIT 事务，任一步失败自动回滚全部。
--
-- 执行方式（开发/测试/生产通用）：
--   docker exec -i nature-postgres psql -U nature -d nature \
--     < scripts/cleanup-historical-orphans.sql
--
-- 建议：生产执行前先备份受影响的 3 张表：
--   docker exec nature-postgres pg_dump -U nature -d nature \
--     -t police_register -t project_system_item -t material_archive \
--     > backup-before-cleanup-$(date +%Y%m%d-%H%M%S).sql
-- ============================================================================

BEGIN;

\echo ''
\echo '== 清理前诊断 =========================================='
SELECT
  (SELECT COUNT(*) FROM police_register pr
    WHERE pr.status='PENDING' AND NOT EXISTS (
      SELECT 1 FROM wf_instance wi
      JOIN wf_task wt ON wt.instance_id=wi.id
      WHERE wi.biz_type='PROJECT_REGISTER'
        AND wi.biz_id=pr.project_register_id
        AND wi.status='RUNNING'
        AND wt.node_key='POLICE_REGISTER'
        AND wt.status='PENDING'
    )) AS police_register_孤儿,
  (SELECT COUNT(*) FROM project_system_item psi
    JOIN project_register pr ON pr.id=psi.project_register_id
    WHERE pr.status='DRAFT' AND psi.system_no IS NOT NULL)
    AS system_no_残留,
  (SELECT COUNT(*) FROM material_archive ma
    WHERE NOT EXISTS (
      SELECT 1 FROM wf_instance wi
      WHERE wi.biz_type='PROJECT_REGISTER'
        AND wi.biz_id=ma.project_register_id
    )) AS material_archive_孤儿;

-- ============================================================================
-- Section A: 删除 police_register 孤儿
-- ============================================================================
\echo ''
\echo '== Section A: 删除 police_register PENDING 孤儿 =========='
DELETE FROM police_register
WHERE status='PENDING' AND NOT EXISTS (
  SELECT 1 FROM wf_instance wi
  JOIN wf_task wt ON wt.instance_id=wi.id
  WHERE wi.biz_type='PROJECT_REGISTER'
    AND wi.biz_id=police_register.project_register_id
    AND wi.status='RUNNING'
    AND wt.node_key='POLICE_REGISTER'
    AND wt.status='PENDING'
);

-- ============================================================================
-- Section B: 清空 DRAFT 项目的 project_system_item.system_no 残留
--   重置为 NULL，让 project 重新提交时 DIRECTOR_REVIEW 重新生成连续编号
-- ============================================================================
\echo ''
\echo '== Section B: 清空 DRAFT 项目的 system_no 残留 =========='
UPDATE project_system_item
SET system_no = NULL, updated_at = NOW()
WHERE system_no IS NOT NULL
  AND project_register_id IN (
    SELECT id FROM project_register WHERE status='DRAFT'
  );

-- ============================================================================
-- Section C: 删除 material_archive 孤儿
--   (material_archive 表无 deleted 字段，只能硬删)
-- ============================================================================
\echo ''
\echo '== Section C: 删除 material_archive 孤儿 ================'
DELETE FROM material_archive
WHERE NOT EXISTS (
  SELECT 1 FROM wf_instance wi
  WHERE wi.biz_type='PROJECT_REGISTER'
    AND wi.biz_id=material_archive.project_register_id
);

-- ============================================================================
-- 清理后验证
-- ============================================================================
\echo ''
\echo '== 清理后诊断 (应全部为 0) ================================'
SELECT
  (SELECT COUNT(*) FROM police_register pr
    WHERE pr.status='PENDING' AND NOT EXISTS (
      SELECT 1 FROM wf_instance wi
      JOIN wf_task wt ON wt.instance_id=wi.id
      WHERE wi.biz_type='PROJECT_REGISTER'
        AND wi.biz_id=pr.project_register_id
        AND wi.status='RUNNING'
        AND wt.node_key='POLICE_REGISTER'
        AND wt.status='PENDING'
    )) AS police_register_孤儿,
  (SELECT COUNT(*) FROM project_system_item psi
    JOIN project_register pr ON pr.id=psi.project_register_id
    WHERE pr.status='DRAFT' AND psi.system_no IS NOT NULL)
    AS system_no_残留,
  (SELECT COUNT(*) FROM material_archive ma
    WHERE NOT EXISTS (
      SELECT 1 FROM wf_instance wi
      WHERE wi.biz_type='PROJECT_REGISTER'
        AND wi.biz_id=ma.project_register_id
    )) AS material_archive_孤儿;

COMMIT;

\echo ''
\echo '== 清理完成 ============================================='
