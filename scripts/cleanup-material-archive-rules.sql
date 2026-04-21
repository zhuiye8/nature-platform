-- ============================================================================
-- 清理 MATERIAL_ARCHIVE 任务分配规则中不应参与池化的角色
-- ============================================================================
--
-- 背景:
--   wf_assignment_rule 里 MATERIAL_ARCHIVE 节点历史上被分配给 5 个角色:
--     archiver / super_admin / sales / dept_manager / project_manager
--   其中 sales/dept_manager 是早期设计遗留，project_manager 是已废弃角色
--   (migrate-assessor-roles.sql 清了 user_role 但漏了 wf_assignment_rule)。
--
--   这些规则导致 workflow.service.getMyTasks 根据"用户角色与 nodeKey 的
--   assignment_rule 匹配"推断 pool 任务归属时，销售/部门经理的待办中心
--   业务提醒里会出现所有 MATERIAL_ARCHIVE 池任务 (包括不是自己项目的)，
--   但材料归档列表本身用 archive.service 的独立 visibility 过滤是正常的。
--
--   业务本意: 归档员是主导者 (池化领取)，销售/PM/部门经理通过通知
--   铃铛消息得知 + 从材料归档列表进详情页协助上传。
--
-- 修复:
--   1. 删除 sales / dept_manager / project_manager 3 条规则
--   2. 保留 archiver (priority 10) + super_admin (priority 0)
--   3. notification.listener 已硬编码通知销售/PM/部门经理等 (本脚本不影响)
--
-- 幂等性:
--   DELETE 带精确 WHERE，重复执行不会误删 (第二次已无匹配行)。
--
-- 执行方式:
--   docker cp scripts/cleanup-material-archive-rules.sql nature-postgres:/tmp/
--   docker exec nature-postgres psql -U nature -d nature \
--     -f /tmp/cleanup-material-archive-rules.sql
-- ============================================================================

BEGIN;

\echo ''
\echo '== 清理前：MATERIAL_ARCHIVE 分配规则 =========================='
SELECT role_code, priority FROM wf_assignment_rule
WHERE node_key='MATERIAL_ARCHIVE'
ORDER BY priority;

-- 删除不应作为池化候选的角色
DELETE FROM wf_assignment_rule
WHERE node_key='MATERIAL_ARCHIVE'
  AND role_code IN ('sales', 'dept_manager', 'project_manager');

\echo ''
\echo '== 清理后：应只剩 archiver + super_admin ======================'
SELECT role_code, priority FROM wf_assignment_rule
WHERE node_key='MATERIAL_ARCHIVE'
ORDER BY priority;

COMMIT;

\echo ''
\echo '== 完成 ======================================================'
