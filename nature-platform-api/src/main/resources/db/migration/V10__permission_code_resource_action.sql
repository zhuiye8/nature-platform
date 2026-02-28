CREATE TABLE IF NOT EXISTS iam_permission_code_legacy_map (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  legacy_code VARCHAR(64) NOT NULL,
  new_code VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_iam_permission_code_legacy_map (legacy_code, new_code)
);

INSERT IGNORE INTO iam_permission_code_legacy_map (legacy_code, new_code)
VALUES
  ('USER_MANAGE', 'user:manage'),
  ('ROLE_MANAGE', 'role:manage'),
  ('PERMISSION_VIEW', 'permission:view'),
  ('WORKFLOW_MANAGE', 'workflow:manage'),
  ('NODE_RULE_MANAGE', 'workflow-node-rule:manage'),
  ('AUDIT_VIEW', 'audit:view');

INSERT INTO iam_permission (permission_code, permission_name, category, description)
SELECT 'user:manage', '用户管理', '系统管理', '管理后台用户的创建、编辑与启停'
WHERE NOT EXISTS (SELECT 1 FROM iam_permission WHERE permission_code = 'user:manage');
INSERT IGNORE INTO iam_role_permission (role_code, permission_code, created_at)
SELECT role_code, 'user:manage', created_at
FROM iam_role_permission
WHERE permission_code = 'USER_MANAGE';
DELETE FROM iam_role_permission WHERE permission_code = 'USER_MANAGE';
DELETE FROM iam_permission WHERE permission_code = 'USER_MANAGE';

INSERT INTO iam_permission (permission_code, permission_name, category, description)
SELECT 'role:manage', '角色管理', '系统管理', '管理角色信息及角色权限配置'
WHERE NOT EXISTS (SELECT 1 FROM iam_permission WHERE permission_code = 'role:manage');
INSERT IGNORE INTO iam_role_permission (role_code, permission_code, created_at)
SELECT role_code, 'role:manage', created_at
FROM iam_role_permission
WHERE permission_code = 'ROLE_MANAGE';
DELETE FROM iam_role_permission WHERE permission_code = 'ROLE_MANAGE';
DELETE FROM iam_permission WHERE permission_code = 'ROLE_MANAGE';

INSERT INTO iam_permission (permission_code, permission_name, category, description)
SELECT 'permission:view', '权限管理', '系统管理', '查看并维护权限字典'
WHERE NOT EXISTS (SELECT 1 FROM iam_permission WHERE permission_code = 'permission:view');
INSERT IGNORE INTO iam_role_permission (role_code, permission_code, created_at)
SELECT role_code, 'permission:view', created_at
FROM iam_role_permission
WHERE permission_code = 'PERMISSION_VIEW';
DELETE FROM iam_role_permission WHERE permission_code = 'PERMISSION_VIEW';
DELETE FROM iam_permission WHERE permission_code = 'PERMISSION_VIEW';

INSERT INTO iam_permission (permission_code, permission_name, category, description)
SELECT 'workflow:manage', '流程定义管理', '系统管理', '维护流程节点定义元数据'
WHERE NOT EXISTS (SELECT 1 FROM iam_permission WHERE permission_code = 'workflow:manage');
INSERT IGNORE INTO iam_role_permission (role_code, permission_code, created_at)
SELECT role_code, 'workflow:manage', created_at
FROM iam_role_permission
WHERE permission_code = 'WORKFLOW_MANAGE';
DELETE FROM iam_role_permission WHERE permission_code = 'WORKFLOW_MANAGE';
DELETE FROM iam_permission WHERE permission_code = 'WORKFLOW_MANAGE';

INSERT INTO iam_permission (permission_code, permission_name, category, description)
SELECT 'workflow-node-rule:manage', '节点规则管理', '系统管理', '维护节点安插人规则配置'
WHERE NOT EXISTS (SELECT 1 FROM iam_permission WHERE permission_code = 'workflow-node-rule:manage');
INSERT IGNORE INTO iam_role_permission (role_code, permission_code, created_at)
SELECT role_code, 'workflow-node-rule:manage', created_at
FROM iam_role_permission
WHERE permission_code = 'NODE_RULE_MANAGE';
DELETE FROM iam_role_permission WHERE permission_code = 'NODE_RULE_MANAGE';
DELETE FROM iam_permission WHERE permission_code = 'NODE_RULE_MANAGE';

INSERT INTO iam_permission (permission_code, permission_name, category, description)
SELECT 'audit:view', '审计日志查看', '系统管理', '查看管理后台操作审计日志'
WHERE NOT EXISTS (SELECT 1 FROM iam_permission WHERE permission_code = 'audit:view');
INSERT IGNORE INTO iam_role_permission (role_code, permission_code, created_at)
SELECT role_code, 'audit:view', created_at
FROM iam_role_permission
WHERE permission_code = 'AUDIT_VIEW';
DELETE FROM iam_role_permission WHERE permission_code = 'AUDIT_VIEW';
DELETE FROM iam_permission WHERE permission_code = 'AUDIT_VIEW';

INSERT IGNORE INTO iam_role_permission (role_code, permission_code)
SELECT 'ROLE_SUPER_ADMIN', permission_code
FROM iam_permission;
