-- ============================================================================
-- 财务模块第 2 批 seed (idempotent)
-- ============================================================================
--
-- 内容:
--   1. 新增财务相关权限定义 (expense:* + settlement:view)
--   2. 角色权限映射:
--      - 所有非超管角色补 expense:request
--      - finance: expense:list / expense:fin_approve / settlement:view
--      - dept_manager: expense:list / expense:dept_approve
--      - chairman: expense:list / settlement:view
--      - super_admin: 全部新权限
--   3. FIN_EXPENSE 工作流定义 + 节点 + 转换 + 分配规则
--   4. page.expense + page.settlement 资源 (菜单)
--
-- 执行方式:
--   docker exec -i nature-postgres psql -U nature -d nature < scripts/seed-finance-batch2.sql
--
-- 依赖:
--   - 必须先执行 drizzle migration 0015 (finance_expense_request 等 2 张表)
--   - 必须先执行 scripts/seed-finance-batch1.sql (chairman 角色已存在)
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────
-- 1. 新增财务权限定义
-- ────────────────────────────────────────────────────────────────
INSERT INTO iam_permission (permission_code, permission_name, category, enabled, built_in) VALUES
  ('expense:request',     '发起费用请款',       'FINANCE', TRUE, TRUE),
  ('expense:list',        '查看费用请款列表',   'FINANCE', TRUE, TRUE),
  ('expense:dept_approve','部门负责人审核请款', 'FINANCE', TRUE, TRUE),
  ('expense:fin_approve', '财务审核请款',       'FINANCE', TRUE, TRUE),
  ('settlement:view',     '结算管理查看',       'FINANCE', TRUE, TRUE)
ON CONFLICT (permission_code) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- 2. 角色权限映射
-- ────────────────────────────────────────────────────────────────

-- 所有非超管角色补 expense:request (B5: 所有人都能发起)
INSERT INTO iam_role_permission (role_code, permission_code)
  SELECT role_code, 'expense:request'
  FROM iam_role
  WHERE enabled = TRUE
ON CONFLICT DO NOTHING;

-- finance: 列表 + 财务审核 + 结算管理查看
INSERT INTO iam_role_permission (role_code, permission_code) VALUES
  ('finance','expense:list'),
  ('finance','expense:fin_approve'),
  ('finance','settlement:view')
ON CONFLICT DO NOTHING;

-- dept_manager: 列表 + 部门审核
INSERT INTO iam_role_permission (role_code, permission_code) VALUES
  ('dept_manager','expense:list'),
  ('dept_manager','expense:dept_approve')
ON CONFLICT DO NOTHING;

-- chairman: 列表 + 结算管理查看 (只读)
INSERT INTO iam_role_permission (role_code, permission_code) VALUES
  ('chairman','expense:list'),
  ('chairman','settlement:view')
ON CONFLICT DO NOTHING;

-- super_admin: 全部新权限
INSERT INTO iam_role_permission (role_code, permission_code) VALUES
  ('super_admin','expense:request'),
  ('super_admin','expense:list'),
  ('super_admin','expense:dept_approve'),
  ('super_admin','expense:fin_approve'),
  ('super_admin','settlement:view')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- 3. 菜单资源
-- ────────────────────────────────────────────────────────────────
INSERT INTO iam_resource (resource_key, resource_name, resource_type, parent_key, route_path, icon, sort_order, enabled, built_in, description) VALUES
  ('page.expense',    '费用请款', 'PAGE', 'group.finance', '/finance/expense',    'Money',       370, TRUE, TRUE, '费用请款发起与审核'),
  ('page.settlement', '结算管理', 'PAGE', 'group.finance', '/finance/settlement', 'TrendCharts', 380, TRUE, TRUE, '合同结算汇总查询')
ON CONFLICT (resource_key) DO NOTHING;

-- 所有非超管角色都能看到 page.expense (因为大家都能发起费用请款)
INSERT INTO iam_role_resource (role_code, resource_key)
  SELECT role_code, 'page.expense'
  FROM iam_role
  WHERE role_code != 'super_admin' AND enabled = TRUE
ON CONFLICT DO NOTHING;

-- finance / chairman 看到 page.settlement
INSERT INTO iam_role_resource (role_code, resource_key) VALUES
  ('finance','page.settlement'),
  ('chairman','page.settlement')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- 4. FIN_EXPENSE 工作流 (双层审核)
-- ────────────────────────────────────────────────────────────────
INSERT INTO wf_definition (def_key, version, def_name, description, status) VALUES
  ('FIN_EXPENSE', 1, '费用请款流程', '请款人 → 部门负责人 → 财务 → 抄送董事长', 'ACTIVE')
ON CONFLICT DO NOTHING;

-- 节点 (双层审核)
INSERT INTO wf_node (definition_id, node_key, node_name, node_type, node_order, config)
SELECT d.id, v.node_key, v.node_name, 'REVIEW', v.node_order, NULL::JSONB
FROM wf_definition d,
  (VALUES
    ('FIN_EXPENSE_DEPT_REVIEW', '部门负责人审核', 10),
    ('FIN_EXPENSE_FIN_REVIEW',  '财务审核',       20)
  ) AS v(node_key, node_name, node_order)
WHERE d.def_key = 'FIN_EXPENSE' AND d.version = 1
ON CONFLICT DO NOTHING;

-- 转换:
--   '' → FIN_EXPENSE_DEPT_REVIEW (AUTO)
--   FIN_EXPENSE_DEPT_REVIEW → FIN_EXPENSE_FIN_REVIEW (APPROVE)  部门通过 → 财务
--   FIN_EXPENSE_DEPT_REVIEW → '' (REJECT)                       部门驳回 → 结束 (业务表 status=REJECTED)
--   FIN_EXPENSE_FIN_REVIEW → '' (APPROVE)                       财务通过 → 结束 (业务表 status=APPROVED)
--   FIN_EXPENSE_FIN_REVIEW → '' (REJECT)                        财务驳回 → 结束 (业务表 status=REJECTED)
INSERT INTO wf_transition (definition_id, from_node_key, to_node_key, event, priority)
SELECT d.id, v.f, v.t, v.e, v.p FROM wf_definition d,
  (VALUES
    ('','FIN_EXPENSE_DEPT_REVIEW','AUTO',0),
    ('FIN_EXPENSE_DEPT_REVIEW','FIN_EXPENSE_FIN_REVIEW','APPROVE',0),
    ('FIN_EXPENSE_DEPT_REVIEW','','REJECT',0),
    ('FIN_EXPENSE_FIN_REVIEW','','APPROVE',0),
    ('FIN_EXPENSE_FIN_REVIEW','','REJECT',0)
  ) AS v(f,t,e,p)
WHERE d.def_key = 'FIN_EXPENSE' AND d.version = 1
ON CONFLICT DO NOTHING;

-- 分配规则
INSERT INTO wf_assignment_rule (node_key, slot_key, slot_label, role_code, avoidance_rule, priority) VALUES
  ('FIN_EXPENSE_DEPT_REVIEW','REVIEWER','部门负责人审核','dept_manager','NONE',10),
  ('FIN_EXPENSE_DEPT_REVIEW','REVIEWER','部门负责人审核','super_admin','NONE',99),
  ('FIN_EXPENSE_FIN_REVIEW','REVIEWER','财务审核','finance','NONE',10),
  ('FIN_EXPENSE_FIN_REVIEW','REVIEWER','财务审核','super_admin','NONE',99)
ON CONFLICT DO NOTHING;

COMMIT;

\echo '== expense 相关权限数 =='
SELECT COUNT(*) FROM iam_permission WHERE permission_code LIKE 'expense:%' OR permission_code = 'settlement:view';
\echo '== chairman / finance / dept_manager 新增权限 =='
SELECT role_code, permission_code FROM iam_role_permission
  WHERE permission_code IN ('expense:list','expense:dept_approve','expense:fin_approve','settlement:view')
  ORDER BY role_code, permission_code;
\echo '== FIN_EXPENSE 工作流节点 =='
SELECT n.node_key, n.node_name FROM wf_node n
  JOIN wf_definition d ON d.id = n.definition_id
  WHERE d.def_key = 'FIN_EXPENSE' AND d.version = 1
  ORDER BY n.node_order;
\echo '== seed 完成 =='
