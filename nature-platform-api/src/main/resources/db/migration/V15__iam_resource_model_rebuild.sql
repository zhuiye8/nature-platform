CREATE TABLE IF NOT EXISTS iam_resource (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  resource_key VARCHAR(128) NOT NULL,
  resource_name VARCHAR(128) NOT NULL,
  resource_type VARCHAR(16) NOT NULL,
  parent_key VARCHAR(128) NULL,
  route_path VARCHAR(255) NULL,
  icon VARCHAR(64) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  built_in TINYINT(1) NOT NULL DEFAULT 1,
  description VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_iam_resource_key (resource_key),
  KEY idx_iam_resource_parent (parent_key),
  KEY idx_iam_resource_enabled (enabled)
);

CREATE TABLE IF NOT EXISTS iam_role_resource (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  role_code VARCHAR(64) NOT NULL,
  resource_key VARCHAR(128) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_role_resource (role_code, resource_key),
  KEY idx_role_resource_key (resource_key)
);

INSERT INTO iam_resource
  (resource_key, resource_name, resource_type, parent_key, route_path, icon, sort_order, enabled, built_in, description)
VALUES
  ('group.overview', '总览', 'GROUP', NULL, NULL, 'DataBoard', 10, 1, 1, '总览分组'),
  ('group.business', '业务流程', 'GROUP', NULL, NULL, 'OfficeBuilding', 20, 1, 1, '业务流程分组'),
  ('group.report', '报告与归档', 'GROUP', NULL, NULL, 'Tickets', 30, 1, 1, '报告与归档分组'),
  ('group.system', '系统管理', 'GROUP', NULL, NULL, 'Setting', 40, 1, 1, '系统管理分组')
ON DUPLICATE KEY UPDATE
  resource_name = VALUES(resource_name),
  resource_type = VALUES(resource_type),
  parent_key = VALUES(parent_key),
  route_path = VALUES(route_path),
  icon = VALUES(icon),
  sort_order = VALUES(sort_order),
  enabled = VALUES(enabled),
  built_in = VALUES(built_in),
  description = VALUES(description);

INSERT INTO iam_resource
  (resource_key, resource_name, resource_type, parent_key, route_path, icon, sort_order, enabled, built_in, description)
VALUES
  ('page.dashboard', '仪表盘', 'PAGE', 'group.overview', '/dashboard', 'DataBoard', 100, 1, 1, '系统首页'),
  ('page.workflow', '待办审批', 'PAGE', 'group.overview', '/workflow', 'List', 110, 1, 1, '流程审批任务中心'),
  ('page.customers', '客户管理', 'PAGE', 'group.business', '/customers', 'User', 200, 1, 1, '客户信息维护页面'),
  ('page.contracts', '合同管理', 'PAGE', 'group.business', '/contracts', 'Document', 210, 1, 1, '合同登记与归档页面'),
  ('page.project-registers', '项目登记', 'PAGE', 'group.business', '/project-registers', 'Management', 220, 1, 1, '项目登记页面'),
  ('page.police-registers', '公安登记', 'PAGE', 'group.business', '/police-registers', 'OfficeBuilding', 230, 1, 1, '公安登记页面'),
  ('page.on-site-assessments', '现场测评', 'PAGE', 'group.business', '/on-site-assessments', 'Connection', 240, 1, 1, '现场测评页面'),
  ('page.quality-reviews', '质量审核', 'PAGE', 'group.business', '/quality-reviews', 'CircleCheck', 250, 1, 1, '质量审核页面'),
  ('page.report-tech-reviews', '技术审核', 'PAGE', 'group.report', '/report-tech-reviews', 'Checked', 300, 1, 1, '报告技术审核页面'),
  ('page.report-content-reviews', '内容审核', 'PAGE', 'group.report', '/report-content-reviews', 'Checked', 310, 1, 1, '报告内容审核页面'),
  ('page.report-compile-assignments', '编制分配', 'PAGE', 'group.report', '/report-compile-assignments', 'Tickets', 320, 1, 1, '报告编制分配页面'),
  ('page.report-compile-submissions', '报告编制', 'PAGE', 'group.report', '/report-compile-submissions', 'EditPen', 330, 1, 1, '报告编制与提交流程页面'),
  ('page.report-final-reviews', '最终审核', 'PAGE', 'group.report', '/report-final-reviews', 'CircleCheck', 340, 1, 1, '报告终审页面'),
  ('page.material-archives', '材料归档', 'PAGE', 'group.report', '/material-archives', 'FolderChecked', 350, 1, 1, '材料归档页面'),
  ('page.admin-users', '用户管理', 'PAGE', 'group.system', '/admin-users', 'User', 400, 1, 1, '后台用户管理页面'),
  ('page.admin-roles', '角色管理', 'PAGE', 'group.system', '/admin-roles', 'Management', 410, 1, 1, '后台角色管理页面'),
  ('page.admin-resources', '资源管理', 'PAGE', 'group.system', '/admin-resources', 'Checked', 420, 1, 1, '后台资源管理页面'),
  ('page.admin-workflow', '流程管理', 'PAGE', 'group.system', '/admin-workflow', 'Connection', 430, 1, 1, '流程定义与节点规则管理页面'),
  ('page.admin-audit-logs', '审计日志', 'PAGE', 'group.system', '/admin-audit-logs', 'List', 440, 1, 1, '审计日志查询页面'),
  ('page.recycle-bin', '回收站', 'PAGE', 'group.system', '/recycle-bin', 'Delete', 450, 1, 1, '回收站页面')
ON DUPLICATE KEY UPDATE
  resource_name = VALUES(resource_name),
  resource_type = VALUES(resource_type),
  parent_key = VALUES(parent_key),
  route_path = VALUES(route_path),
  icon = VALUES(icon),
  sort_order = VALUES(sort_order),
  enabled = VALUES(enabled),
  built_in = VALUES(built_in),
  description = VALUES(description);

UPDATE iam_role
SET role_name = '平台用户', description = '基础登录用户'
WHERE role_code = 'ROLE_USER';

UPDATE iam_role
SET role_name = '超级管理员', description = '系统全局管理角色'
WHERE role_code = 'ROLE_SUPER_ADMIN';

UPDATE iam_role
SET role_name = '流程审核员', description = '具备流程审核权限的用户'
WHERE role_code = 'ROLE_REVIEWER';

UPDATE iam_role
SET role_name = '技术审核员', description = '负责技术审核的角色'
WHERE role_code = 'ROLE_REVIEW_TECH';

UPDATE iam_role
SET role_name = '内容审核员（技术）', description = '负责技术向内容审核'
WHERE role_code = 'ROLE_REVIEW_CONTENT_TECH';

UPDATE iam_role
SET role_name = '内容审核员（管理）', description = '负责管理向内容审核'
WHERE role_code = 'ROLE_REVIEW_CONTENT_MANAGEMENT';

UPDATE iam_role
SET role_name = '内容审核员（网络）', description = '负责网络向内容审核'
WHERE role_code = 'ROLE_REVIEW_CONTENT_NETWORK';

INSERT IGNORE INTO iam_role_resource (role_code, resource_key)
SELECT role_code, 'page.dashboard'
FROM iam_role
WHERE enabled = 1;

INSERT IGNORE INTO iam_role_resource (role_code, resource_key)
SELECT rp.role_code,
       CASE
         WHEN LOWER(rp.permission_code) IN ('workflow-task:view', 'workflow-task:approve', 'workflow-task:reject')
           THEN 'page.workflow'
         WHEN LOWER(rp.permission_code) LIKE 'customer:%'
           THEN 'page.customers'
         WHEN LOWER(rp.permission_code) LIKE 'contract:%'
           THEN 'page.contracts'
         WHEN LOWER(rp.permission_code) LIKE 'project-register:%'
           THEN 'page.project-registers'
         WHEN LOWER(rp.permission_code) LIKE 'police-register:%'
           THEN 'page.police-registers'
         WHEN LOWER(rp.permission_code) LIKE 'on-site-assessment:%'
           THEN 'page.on-site-assessments'
         WHEN LOWER(rp.permission_code) LIKE 'quality-review:%'
           THEN 'page.quality-reviews'
         WHEN LOWER(rp.permission_code) LIKE 'report-tech-review:%'
           THEN 'page.report-tech-reviews'
         WHEN LOWER(rp.permission_code) LIKE 'report-content-review:%'
           THEN 'page.report-content-reviews'
         WHEN LOWER(rp.permission_code) LIKE 'report-compile-assignment:%'
           THEN 'page.report-compile-assignments'
         WHEN LOWER(rp.permission_code) LIKE 'report-compile-submission:%'
           THEN 'page.report-compile-submissions'
         WHEN LOWER(rp.permission_code) LIKE 'report-final-review:%'
           THEN 'page.report-final-reviews'
         WHEN LOWER(rp.permission_code) LIKE 'material-archive:%'
           THEN 'page.material-archives'
         WHEN LOWER(rp.permission_code) IN ('user:manage', 'user_manage')
           THEN 'page.admin-users'
         WHEN LOWER(rp.permission_code) IN ('role:manage', 'role_manage')
           THEN 'page.admin-roles'
         WHEN LOWER(rp.permission_code) IN ('permission:view', 'permission_view')
           THEN 'page.admin-resources'
         WHEN LOWER(rp.permission_code) IN ('workflow:manage', 'workflow_manage', 'workflow-node-rule:manage', 'node_rule_manage')
           THEN 'page.admin-workflow'
         WHEN LOWER(rp.permission_code) IN ('audit:view', 'audit_view')
           THEN 'page.admin-audit-logs'
         ELSE NULL
       END AS resource_key
FROM iam_role_permission rp
WHERE CASE
        WHEN LOWER(rp.permission_code) IN ('workflow-task:view', 'workflow-task:approve', 'workflow-task:reject')
          THEN 'page.workflow'
        WHEN LOWER(rp.permission_code) LIKE 'customer:%'
          THEN 'page.customers'
        WHEN LOWER(rp.permission_code) LIKE 'contract:%'
          THEN 'page.contracts'
        WHEN LOWER(rp.permission_code) LIKE 'project-register:%'
          THEN 'page.project-registers'
        WHEN LOWER(rp.permission_code) LIKE 'police-register:%'
          THEN 'page.police-registers'
        WHEN LOWER(rp.permission_code) LIKE 'on-site-assessment:%'
          THEN 'page.on-site-assessments'
        WHEN LOWER(rp.permission_code) LIKE 'quality-review:%'
          THEN 'page.quality-reviews'
        WHEN LOWER(rp.permission_code) LIKE 'report-tech-review:%'
          THEN 'page.report-tech-reviews'
        WHEN LOWER(rp.permission_code) LIKE 'report-content-review:%'
          THEN 'page.report-content-reviews'
        WHEN LOWER(rp.permission_code) LIKE 'report-compile-assignment:%'
          THEN 'page.report-compile-assignments'
        WHEN LOWER(rp.permission_code) LIKE 'report-compile-submission:%'
          THEN 'page.report-compile-submissions'
        WHEN LOWER(rp.permission_code) LIKE 'report-final-review:%'
          THEN 'page.report-final-reviews'
        WHEN LOWER(rp.permission_code) LIKE 'material-archive:%'
          THEN 'page.material-archives'
        WHEN LOWER(rp.permission_code) IN ('user:manage', 'user_manage')
          THEN 'page.admin-users'
        WHEN LOWER(rp.permission_code) IN ('role:manage', 'role_manage')
          THEN 'page.admin-roles'
        WHEN LOWER(rp.permission_code) IN ('permission:view', 'permission_view')
          THEN 'page.admin-resources'
        WHEN LOWER(rp.permission_code) IN ('workflow:manage', 'workflow_manage', 'workflow-node-rule:manage', 'node_rule_manage')
          THEN 'page.admin-workflow'
        WHEN LOWER(rp.permission_code) IN ('audit:view', 'audit_view')
          THEN 'page.admin-audit-logs'
        ELSE NULL
      END IS NOT NULL;

INSERT IGNORE INTO iam_role_resource (role_code, resource_key)
SELECT 'ROLE_SUPER_ADMIN', resource_key
FROM iam_resource
WHERE enabled = 1;
