-- ============================================================================
-- 财务模块第 1 批 seed (idempotent，可重复执行)
-- ============================================================================
--
-- 内容:
--   1. chairman 角色 + 权限 + 资源
--   2. 新增财务相关权限定义 (invoice:apply/list/review, payment:record)
--   3. 现有角色补 invoice:apply 权限 (B5: 所有人都能发起开票申请)
--   4. FIN_INVOICE 工作流定义 + 节点 + 转换 + 分配规则
--   5. page.invoice 资源 (开票申请菜单)
--
-- 执行方式:
--   docker exec -i nature-postgres psql -U nature -d nature < scripts/seed-finance-batch1.sql
--
-- 依赖:
--   - 必须先执行 drizzle migration 0014 (project_system_item.amount, 3 张新表)
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────
-- 1. chairman 角色
-- ────────────────────────────────────────────────────────────────
INSERT INTO iam_role (role_code, role_name, description, enabled, system_flag) VALUES
  ('chairman', '董事长', '业务全只读 + 系统管理全权', TRUE, TRUE)
ON CONFLICT (role_code) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- 2. 新增财务权限定义
-- ────────────────────────────────────────────────────────────────
INSERT INTO iam_permission (permission_code, permission_name, category, enabled, built_in) VALUES
  ('invoice:apply',  '发起开票申请',     'FINANCE', TRUE, TRUE),
  ('invoice:list',   '查看开票申请列表', 'FINANCE', TRUE, TRUE),
  ('invoice:review', '审核开票申请',     'FINANCE', TRUE, TRUE),
  ('payment:record', '录入回款记录',     'FINANCE', TRUE, TRUE)
ON CONFLICT (permission_code) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- 3. chairman 权限分配
--   - 业务只读: customer/partner/contract/project/police/assessment/report/archive/platform
--   - 财务只读: invoice:list (settlement:view 第 2 批引入)
--   - 系统管理全权: user/role/recycle/resource/department/workflow/audit
--   - 待办看不操作: wf_task:view
--   - 不给任何 *:create/*:update/*:delete/*:review/*:approve
-- ────────────────────────────────────────────────────────────────
INSERT INTO iam_role_permission (role_code, permission_code) VALUES
  -- 业务只读
  ('chairman','customer:list'),
  ('chairman','partner:list'),
  ('chairman','contract:list'),('chairman','contract:view_all'),
  ('chairman','project:list'),
  ('chairman','police:list'),
  ('chairman','assessment:view'),
  ('chairman','report:list'),('chairman','report:view'),
  ('chairman','archive:list'),
  ('chairman','platform:list'),
  -- 财务只读
  ('chairman','invoice:list'),
  -- 系统管理全权 (含编辑)
  ('chairman','user:list'),('chairman','user:create'),('chairman','user:update'),('chairman','user:delete'),('chairman','user:manage'),
  ('chairman','role:list'),('chairman','role:create'),('chairman','role:update'),('chairman','role:delete'),('chairman','role:manage'),
  ('chairman','recycle:list'),('chairman','recycle:restore'),('chairman','recycle:delete'),('chairman','recycle:manage'),
  ('chairman','resource:manage'),('chairman','department:manage'),
  ('chairman','workflow:manage'),('chairman','audit:view'),
  -- 待办看不操作
  ('chairman','wf_task:view')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- 4. 所有非超管角色补 invoice:apply (B5: 所有人都能发起)
-- ────────────────────────────────────────────────────────────────
INSERT INTO iam_role_permission (role_code, permission_code)
  SELECT role_code, 'invoice:apply'
  FROM iam_role
  WHERE enabled = TRUE
ON CONFLICT DO NOTHING;

-- finance 角色: 看列表 + 审核 + 录入回款
INSERT INTO iam_role_permission (role_code, permission_code) VALUES
  ('finance','invoice:list'),
  ('finance','invoice:review'),
  ('finance','payment:record')
ON CONFLICT DO NOTHING;

-- super_admin: 全部财务权限
INSERT INTO iam_role_permission (role_code, permission_code) VALUES
  ('super_admin','invoice:apply'),
  ('super_admin','invoice:list'),
  ('super_admin','invoice:review'),
  ('super_admin','payment:record')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- 5. page.invoice 资源 (开票申请菜单)
-- ────────────────────────────────────────────────────────────────
INSERT INTO iam_resource (resource_key, resource_name, resource_type, parent_key, route_path, icon, sort_order, enabled, built_in, description) VALUES
  ('page.invoice', '开票申请', 'PAGE', 'group.finance', '/finance/invoice', 'Tickets', 360, TRUE, TRUE, '开票申请发起与审核')
ON CONFLICT (resource_key) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- 6. chairman 资源映射 (菜单可见性)
-- ────────────────────────────────────────────────────────────────
INSERT INTO iam_role_resource (role_code, resource_key) VALUES
  ('chairman','group.overview'),('chairman','page.dashboard'),('chairman','page.workflow'),
  ('chairman','group.business'),('chairman','page.customers'),('chairman','page.contracts'),
  ('chairman','page.project-registers'),('chairman','page.police-registers'),
  ('chairman','page.on-site-assessments'),('chairman','page.platforms'),
  ('chairman','group.report'),('chairman','page.report-assignments'),('chairman','page.report-compile'),
  ('chairman','page.report-reviews'),('chairman','page.material-archives'),
  ('chairman','group.finance'),('chairman','page.contract-finance'),('chairman','page.invoice'),
  ('chairman','group.system'),('chairman','page.admin-users'),('chairman','page.admin-roles'),
  ('chairman','page.admin-resources'),('chairman','page.admin-departments'),
  ('chairman','page.admin-workflow'),('chairman','page.admin-audit-logs'),('chairman','page.recycle-bin')
ON CONFLICT DO NOTHING;

-- 所有非超管角色都能看到 page.invoice (因为大家都能发起开票申请)
INSERT INTO iam_role_resource (role_code, resource_key)
  SELECT role_code, 'page.invoice'
  FROM iam_role
  WHERE role_code != 'super_admin' AND enabled = TRUE
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- 7. FIN_INVOICE 工作流定义
-- ────────────────────────────────────────────────────────────────
INSERT INTO wf_definition (def_key, version, def_name, description, status) VALUES
  ('FIN_INVOICE', 1, '开票申请流程', '申请人提交 → 财务审核 → 已开票/需修改', 'ACTIVE')
ON CONFLICT DO NOTHING;

-- 节点
INSERT INTO wf_node (definition_id, node_key, node_name, node_type, node_order, config)
SELECT id, 'FIN_INVOICE_REVIEW', '财务审核', 'REVIEW', 10, NULL::JSONB
FROM wf_definition
WHERE def_key = 'FIN_INVOICE' AND version = 1
ON CONFLICT DO NOTHING;

-- 转换
-- '' (start) → FIN_INVOICE_REVIEW (AUTO)
-- FIN_INVOICE_REVIEW → '' (end) on APPROVE (前端文案"已开票")
-- FIN_INVOICE_REVIEW → '' (end) on REJECT  (前端文案"需修改"；业务表 status=REJECTED 后允许编辑+重启 wf_instance)
INSERT INTO wf_transition (definition_id, from_node_key, to_node_key, event, priority)
SELECT d.id, v.f, v.t, v.e, v.p FROM wf_definition d,
  (VALUES ('','FIN_INVOICE_REVIEW','AUTO',0),
          ('FIN_INVOICE_REVIEW','','APPROVE',0),
          ('FIN_INVOICE_REVIEW','','REJECT',0)
  ) AS v(f,t,e,p)
WHERE d.def_key = 'FIN_INVOICE' AND d.version = 1
ON CONFLICT DO NOTHING;

-- 分配规则: 财务审核
INSERT INTO wf_assignment_rule (node_key, slot_key, slot_label, role_code, avoidance_rule, priority) VALUES
  ('FIN_INVOICE_REVIEW','REVIEWER','财务审核人','finance','NONE',10),
  ('FIN_INVOICE_REVIEW','REVIEWER','财务审核人','super_admin','NONE',99)
ON CONFLICT DO NOTHING;

COMMIT;

\echo '== chairman 角色权限数 =='
SELECT COUNT(*) AS perms FROM iam_role_permission WHERE role_code = 'chairman';
\echo '== chairman 资源数 =='
SELECT COUNT(*) AS resources FROM iam_role_resource WHERE role_code = 'chairman';
\echo '== FIN_INVOICE 工作流节点 =='
SELECT n.node_key, n.node_name, n.node_type FROM wf_node n
  JOIN wf_definition d ON d.id = n.definition_id
  WHERE d.def_key = 'FIN_INVOICE' AND d.version = 1;
\echo '== seed 完成 =='
