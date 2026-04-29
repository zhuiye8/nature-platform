-- ============================================================================
-- 生产环境数据清理（危险操作！）
--
-- 用途：
--   生产正式启用前清空所有"业务数据 + 用户数据"，仅保留：
--     1. admin 账号 + super_admin 角色绑定
--     2. iam_role / iam_permission / iam_role_permission
--     3. iam_resource / iam_role_resource
--     4. iam_department（部门定义）
--     5. wf_definition / wf_node / wf_transition / wf_assignment_rule（流程定义）
--     6. review_opinion_template（审核意见模板）
--
-- 注意：
--   - 本脚本会清空所有业务数据。执行前必须先做 pg_dump 备份。
--   - 整体 BEGIN/COMMIT 事务，任一步失败自动回滚。
--   - 使用 TRUNCATE ... RESTART IDENTITY CASCADE 重置自增 ID 并级联清空。
--
-- 用法：
--   1. 备份：
--      docker exec nature-postgres pg_dump -U nature -d nature \
--        > backup-before-cleanup-$(date +%Y%m%d-%H%M%S).sql
--   2. 执行：
--      docker exec -i nature-postgres psql -U nature -d nature \
--        < scripts/cleanup-prod-data.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. 工作流运行时数据（必须先清，否则 wf_task -> wf_instance FK 阻塞）
-- ============================================================================
TRUNCATE TABLE
  wf_action_log,
  wf_task,
  wf_instance
RESTART IDENTITY CASCADE;

-- ============================================================================
-- 2. 业务数据（财务模块）
-- ============================================================================
TRUNCATE TABLE
  finance_expense_request_system,
  finance_expense_request,
  finance_invoice_application_system,
  finance_invoice_application,
  contract_payment_record
RESTART IDENTITY CASCADE;

-- ============================================================================
-- 3. 业务数据（项目执行链路）
-- ============================================================================
TRUNCATE TABLE
  material_archive,
  on_site_assessment,
  police_register,
  project_member,
  project_reminder_log,
  project_system_serial,
  project_system_item,
  project_register
RESTART IDENTITY CASCADE;

-- ============================================================================
-- 4. 业务数据（合同/客户/平台）
-- ============================================================================
TRUNCATE TABLE
  contract_serial,
  contract_system_item,
  contract,
  contract_group,
  customer_contact,
  customer,
  partner,
  registration_platform
RESTART IDENTITY CASCADE;

-- ============================================================================
-- 5. 评审/审计/通知/附件
-- ============================================================================
TRUNCATE TABLE
  review_opinion,
  system_notification,
  field_change_log,
  admin_audit_log,
  file_attachment,
  recycle_bin
RESTART IDENTITY CASCADE;

-- ============================================================================
-- 6. 测评/报告文件
-- ============================================================================
TRUNCATE TABLE
  assessment_file,
  compile_report_file
RESTART IDENTITY CASCADE;

-- ============================================================================
-- 7. 用户与角色绑定（保留 admin）
-- ============================================================================

-- 7.1 删除非 admin 的角色绑定
DELETE FROM user_role
WHERE user_id IN (
  SELECT id FROM user_account WHERE username != 'admin'
);

-- 7.2 删除非 admin 的用户
DELETE FROM user_account WHERE username != 'admin';

-- ============================================================================
-- 8. 验证：清理后状态
-- ============================================================================
DO $$
DECLARE
  v_user_count INT;
  v_role_assign_count INT;
  v_contract_count INT;
  v_project_count INT;
  v_role_def_count INT;
  v_resource_count INT;
  v_wf_def_count INT;
BEGIN
  SELECT COUNT(*) INTO v_user_count FROM user_account;
  SELECT COUNT(*) INTO v_role_assign_count FROM user_role;
  SELECT COUNT(*) INTO v_contract_count FROM contract;
  SELECT COUNT(*) INTO v_project_count FROM project_register;
  SELECT COUNT(*) INTO v_role_def_count FROM iam_role;
  SELECT COUNT(*) INTO v_resource_count FROM iam_resource;
  SELECT COUNT(*) INTO v_wf_def_count FROM wf_definition;

  RAISE NOTICE '=== 清理后状态 ===';
  RAISE NOTICE '用户数: %（期望 1，仅 admin）', v_user_count;
  RAISE NOTICE '用户角色绑定: %（期望 1，仅 admin → super_admin）', v_role_assign_count;
  RAISE NOTICE '合同数: %（期望 0）', v_contract_count;
  RAISE NOTICE '项目数: %（期望 0）', v_project_count;
  RAISE NOTICE '角色定义: %（应保留）', v_role_def_count;
  RAISE NOTICE '资源/菜单定义: %（应保留）', v_resource_count;
  RAISE NOTICE '工作流定义: %（应保留）', v_wf_def_count;
END $$;

COMMIT;
