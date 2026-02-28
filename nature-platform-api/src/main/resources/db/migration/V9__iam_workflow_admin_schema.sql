CREATE TABLE IF NOT EXISTS iam_role (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  role_code VARCHAR(64) NOT NULL,
  role_name VARCHAR(128) NOT NULL,
  description VARCHAR(500) NULL,
  system_flag TINYINT(1) NOT NULL DEFAULT 0,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_iam_role_code (role_code)
);

CREATE TABLE IF NOT EXISTS iam_permission (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  permission_code VARCHAR(64) NOT NULL,
  permission_name VARCHAR(128) NOT NULL,
  category VARCHAR(64) NOT NULL,
  description VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_iam_permission_code (permission_code)
);

CREATE TABLE IF NOT EXISTS iam_role_permission (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  role_code VARCHAR(64) NOT NULL,
  permission_code VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_role_permission (role_code, permission_code),
  KEY idx_role_permission_perm (permission_code)
);

CREATE TABLE IF NOT EXISTS workflow_definition_registry (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  node_key VARCHAR(64) NOT NULL,
  node_name VARCHAR(128) NOT NULL,
  node_order INT NOT NULL DEFAULT 0,
  stage VARCHAR(64) NOT NULL DEFAULT 'BUSINESS',
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  description VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_workflow_definition_node (node_key)
);

CREATE TABLE IF NOT EXISTS workflow_node_rule (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  node_key VARCHAR(64) NOT NULL,
  rule_name VARCHAR(128) NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  updated_by VARCHAR(64) NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_workflow_node_rule_node (node_key)
);

CREATE TABLE IF NOT EXISTS workflow_node_rule_item (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  rule_id BIGINT NOT NULL,
  slot_key VARCHAR(64) NOT NULL,
  slot_label VARCHAR(128) NOT NULL,
  role_code VARCHAR(64) NOT NULL,
  required_flag TINYINT(1) NOT NULL DEFAULT 1,
  min_count INT NOT NULL DEFAULT 1,
  max_count INT NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_workflow_rule_slot_role (rule_id, slot_key, role_code),
  KEY idx_workflow_rule_item_slot (slot_key)
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  operator VARCHAR(64) NOT NULL,
  action_type VARCHAR(64) NOT NULL,
  target_type VARCHAR(64) NOT NULL,
  target_id VARCHAR(128) NOT NULL,
  detail_json TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_admin_audit_operator (operator, created_at),
  KEY idx_admin_audit_action (action_type, created_at)
);

INSERT INTO iam_role (role_code, role_name, description, system_flag, enabled)
SELECT 'ROLE_USER', 'Platform User', 'Baseline authenticated role', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM iam_role WHERE role_code = 'ROLE_USER');

INSERT INTO iam_role (role_code, role_name, description, system_flag, enabled)
SELECT 'ROLE_SUPER_ADMIN', 'Super Admin', 'Platform super administrator', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM iam_role WHERE role_code = 'ROLE_SUPER_ADMIN');

INSERT INTO iam_role (role_code, role_name, description, system_flag, enabled)
SELECT 'ROLE_REVIEWER', 'Reviewer', 'Cross-node reviewer role', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM iam_role WHERE role_code = 'ROLE_REVIEWER');

INSERT INTO iam_role (role_code, role_name, description, system_flag, enabled)
SELECT 'ROLE_REVIEW_TECH', 'Technical Reviewer', 'Technical review role', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM iam_role WHERE role_code = 'ROLE_REVIEW_TECH');

INSERT INTO iam_role (role_code, role_name, description, system_flag, enabled)
SELECT 'ROLE_REVIEW_CONTENT_A', 'Content Reviewer A', 'Content review role A', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM iam_role WHERE role_code = 'ROLE_REVIEW_CONTENT_A');

INSERT INTO iam_role (role_code, role_name, description, system_flag, enabled)
SELECT 'ROLE_REVIEW_CONTENT_B', 'Content Reviewer B', 'Content review role B', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM iam_role WHERE role_code = 'ROLE_REVIEW_CONTENT_B');

INSERT INTO iam_role (role_code, role_name, description, system_flag, enabled)
SELECT 'ROLE_REVIEW_CONTENT_C', 'Content Reviewer C', 'Content review role C', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM iam_role WHERE role_code = 'ROLE_REVIEW_CONTENT_C');

INSERT INTO iam_permission (permission_code, permission_name, category, description)
SELECT 'USER_MANAGE', 'Manage Users', 'IAM', 'Create and update user accounts'
WHERE NOT EXISTS (SELECT 1 FROM iam_permission WHERE permission_code = 'USER_MANAGE');

INSERT INTO iam_permission (permission_code, permission_name, category, description)
SELECT 'ROLE_MANAGE', 'Manage Roles', 'IAM', 'Create and update role permissions'
WHERE NOT EXISTS (SELECT 1 FROM iam_permission WHERE permission_code = 'ROLE_MANAGE');

INSERT INTO iam_permission (permission_code, permission_name, category, description)
SELECT 'PERMISSION_VIEW', 'View Permissions', 'IAM', 'Read permission catalog and mappings'
WHERE NOT EXISTS (SELECT 1 FROM iam_permission WHERE permission_code = 'PERMISSION_VIEW');

INSERT INTO iam_permission (permission_code, permission_name, category, description)
SELECT 'WORKFLOW_MANAGE', 'Manage Workflow', 'WORKFLOW', 'Maintain workflow definition metadata'
WHERE NOT EXISTS (SELECT 1 FROM iam_permission WHERE permission_code = 'WORKFLOW_MANAGE');

INSERT INTO iam_permission (permission_code, permission_name, category, description)
SELECT 'NODE_RULE_MANAGE', 'Manage Node Rules', 'WORKFLOW', 'Maintain node assignment rules'
WHERE NOT EXISTS (SELECT 1 FROM iam_permission WHERE permission_code = 'NODE_RULE_MANAGE');

INSERT INTO iam_permission (permission_code, permission_name, category, description)
SELECT 'AUDIT_VIEW', 'View Audit Logs', 'AUDIT', 'Read admin operation audit logs'
WHERE NOT EXISTS (SELECT 1 FROM iam_permission WHERE permission_code = 'AUDIT_VIEW');

INSERT INTO iam_role_permission (role_code, permission_code)
SELECT 'ROLE_SUPER_ADMIN', p.permission_code
FROM iam_permission p
WHERE NOT EXISTS (
  SELECT 1
  FROM iam_role_permission rp
  WHERE rp.role_code = 'ROLE_SUPER_ADMIN' AND rp.permission_code = p.permission_code
);

INSERT INTO workflow_definition_registry (node_key, node_name, node_order, stage, enabled, description)
SELECT 'ON_SITE_ASSESSMENT', 'On-site Assessment', 80, 'BUSINESS', 1, 'Upload ZIP and assign four reviewers'
WHERE NOT EXISTS (SELECT 1 FROM workflow_definition_registry WHERE node_key = 'ON_SITE_ASSESSMENT');

INSERT INTO workflow_definition_registry (node_key, node_name, node_order, stage, enabled, description)
SELECT 'QUALITY_REVIEW_APPLY', 'Quality Review Apply', 90, 'BUSINESS', 1, 'Quality review apply stage'
WHERE NOT EXISTS (SELECT 1 FROM workflow_definition_registry WHERE node_key = 'QUALITY_REVIEW_APPLY');

INSERT INTO workflow_definition_registry (node_key, node_name, node_order, stage, enabled, description)
SELECT 'QUALITY_REVIEW_TASK', 'Quality Review Task', 100, 'BUSINESS', 1, 'Quality review task processing stage'
WHERE NOT EXISTS (SELECT 1 FROM workflow_definition_registry WHERE node_key = 'QUALITY_REVIEW_TASK');

INSERT INTO workflow_definition_registry (node_key, node_name, node_order, stage, enabled, description)
SELECT 'REPORT_TECH_REVIEW_APPLY', 'Report Tech Review Apply', 110, 'BUSINESS', 1, 'Technical review apply stage'
WHERE NOT EXISTS (SELECT 1 FROM workflow_definition_registry WHERE node_key = 'REPORT_TECH_REVIEW_APPLY');

INSERT INTO workflow_definition_registry (node_key, node_name, node_order, stage, enabled, description)
SELECT 'REPORT_TECH_REVIEW_TASK', 'Report Tech Review Task', 111, 'BUSINESS', 1, 'Technical review execution stage'
WHERE NOT EXISTS (SELECT 1 FROM workflow_definition_registry WHERE node_key = 'REPORT_TECH_REVIEW_TASK');

INSERT INTO workflow_definition_registry (node_key, node_name, node_order, stage, enabled, description)
SELECT 'REPORT_CONTENT_REVIEW', 'Report Content Review', 120, 'BUSINESS', 1, 'Content review stage with A/B/C lanes'
WHERE NOT EXISTS (SELECT 1 FROM workflow_definition_registry WHERE node_key = 'REPORT_CONTENT_REVIEW');

INSERT INTO workflow_definition_registry (node_key, node_name, node_order, stage, enabled, description)
SELECT 'REPORT_COMPILE_ASSIGN', 'Report Compile Assignment', 130, 'BUSINESS', 1, 'Compile assignee assignment stage'
WHERE NOT EXISTS (SELECT 1 FROM workflow_definition_registry WHERE node_key = 'REPORT_COMPILE_ASSIGN');

INSERT INTO workflow_definition_registry (node_key, node_name, node_order, stage, enabled, description)
SELECT 'REPORT_COMPILE_UPLOAD', 'Report Compile Upload', 140, 'BUSINESS', 1, 'Report upload and submission stage'
WHERE NOT EXISTS (SELECT 1 FROM workflow_definition_registry WHERE node_key = 'REPORT_COMPILE_UPLOAD');

INSERT INTO workflow_definition_registry (node_key, node_name, node_order, stage, enabled, description)
SELECT 'REPORT_FINAL_REVIEW_APPLY', 'Report Final Review Apply', 150, 'BUSINESS', 1, 'Final review apply stage'
WHERE NOT EXISTS (SELECT 1 FROM workflow_definition_registry WHERE node_key = 'REPORT_FINAL_REVIEW_APPLY');

INSERT INTO workflow_definition_registry (node_key, node_name, node_order, stage, enabled, description)
SELECT 'REPORT_FINAL_REVIEW_TASK', 'Report Final Review Task', 151, 'BUSINESS', 1, 'Final review execution stage'
WHERE NOT EXISTS (SELECT 1 FROM workflow_definition_registry WHERE node_key = 'REPORT_FINAL_REVIEW_TASK');

INSERT INTO workflow_definition_registry (node_key, node_name, node_order, stage, enabled, description)
SELECT 'MATERIAL_ARCHIVE', 'Material Archive', 160, 'BUSINESS', 1, 'Material archive stage'
WHERE NOT EXISTS (SELECT 1 FROM workflow_definition_registry WHERE node_key = 'MATERIAL_ARCHIVE');

INSERT INTO workflow_node_rule (node_key, rule_name, enabled, updated_by)
SELECT 'ON_SITE_ASSESSMENT', 'On-site assignment rule', 1, 'system'
WHERE NOT EXISTS (SELECT 1 FROM workflow_node_rule WHERE node_key = 'ON_SITE_ASSESSMENT');

INSERT INTO workflow_node_rule_item (rule_id, slot_key, slot_label, role_code, required_flag, min_count, max_count, sort_order)
SELECT r.id, 'TECH_REVIEWER', 'Technical Reviewer', 'ROLE_SUPER_ADMIN', 1, 1, 1, 10
FROM workflow_node_rule r
WHERE r.node_key = 'ON_SITE_ASSESSMENT'
  AND NOT EXISTS (
    SELECT 1
    FROM workflow_node_rule_item i
    WHERE i.rule_id = r.id AND i.slot_key = 'TECH_REVIEWER' AND i.role_code = 'ROLE_SUPER_ADMIN'
  );

INSERT INTO workflow_node_rule_item (rule_id, slot_key, slot_label, role_code, required_flag, min_count, max_count, sort_order)
SELECT r.id, 'TECH_REVIEWER', 'Technical Reviewer', 'ROLE_REVIEWER', 1, 1, 1, 20
FROM workflow_node_rule r
WHERE r.node_key = 'ON_SITE_ASSESSMENT'
  AND NOT EXISTS (
    SELECT 1
    FROM workflow_node_rule_item i
    WHERE i.rule_id = r.id AND i.slot_key = 'TECH_REVIEWER' AND i.role_code = 'ROLE_REVIEWER'
  );

INSERT INTO workflow_node_rule_item (rule_id, slot_key, slot_label, role_code, required_flag, min_count, max_count, sort_order)
SELECT r.id, 'TECH_REVIEWER', 'Technical Reviewer', 'ROLE_REVIEW_TECH', 1, 1, 1, 30
FROM workflow_node_rule r
WHERE r.node_key = 'ON_SITE_ASSESSMENT'
  AND NOT EXISTS (
    SELECT 1
    FROM workflow_node_rule_item i
    WHERE i.rule_id = r.id AND i.slot_key = 'TECH_REVIEWER' AND i.role_code = 'ROLE_REVIEW_TECH'
  );

INSERT INTO workflow_node_rule_item (rule_id, slot_key, slot_label, role_code, required_flag, min_count, max_count, sort_order)
SELECT r.id, 'CONTENT_REVIEWER_A', 'Content Reviewer A', 'ROLE_SUPER_ADMIN', 1, 1, 1, 10
FROM workflow_node_rule r
WHERE r.node_key = 'ON_SITE_ASSESSMENT'
  AND NOT EXISTS (
    SELECT 1
    FROM workflow_node_rule_item i
    WHERE i.rule_id = r.id AND i.slot_key = 'CONTENT_REVIEWER_A' AND i.role_code = 'ROLE_SUPER_ADMIN'
  );

INSERT INTO workflow_node_rule_item (rule_id, slot_key, slot_label, role_code, required_flag, min_count, max_count, sort_order)
SELECT r.id, 'CONTENT_REVIEWER_A', 'Content Reviewer A', 'ROLE_REVIEWER', 1, 1, 1, 20
FROM workflow_node_rule r
WHERE r.node_key = 'ON_SITE_ASSESSMENT'
  AND NOT EXISTS (
    SELECT 1
    FROM workflow_node_rule_item i
    WHERE i.rule_id = r.id AND i.slot_key = 'CONTENT_REVIEWER_A' AND i.role_code = 'ROLE_REVIEWER'
  );

INSERT INTO workflow_node_rule_item (rule_id, slot_key, slot_label, role_code, required_flag, min_count, max_count, sort_order)
SELECT r.id, 'CONTENT_REVIEWER_A', 'Content Reviewer A', 'ROLE_REVIEW_CONTENT_A', 1, 1, 1, 30
FROM workflow_node_rule r
WHERE r.node_key = 'ON_SITE_ASSESSMENT'
  AND NOT EXISTS (
    SELECT 1
    FROM workflow_node_rule_item i
    WHERE i.rule_id = r.id AND i.slot_key = 'CONTENT_REVIEWER_A' AND i.role_code = 'ROLE_REVIEW_CONTENT_A'
  );

INSERT INTO workflow_node_rule_item (rule_id, slot_key, slot_label, role_code, required_flag, min_count, max_count, sort_order)
SELECT r.id, 'CONTENT_REVIEWER_B', 'Content Reviewer B', 'ROLE_SUPER_ADMIN', 1, 1, 1, 10
FROM workflow_node_rule r
WHERE r.node_key = 'ON_SITE_ASSESSMENT'
  AND NOT EXISTS (
    SELECT 1
    FROM workflow_node_rule_item i
    WHERE i.rule_id = r.id AND i.slot_key = 'CONTENT_REVIEWER_B' AND i.role_code = 'ROLE_SUPER_ADMIN'
  );

INSERT INTO workflow_node_rule_item (rule_id, slot_key, slot_label, role_code, required_flag, min_count, max_count, sort_order)
SELECT r.id, 'CONTENT_REVIEWER_B', 'Content Reviewer B', 'ROLE_REVIEWER', 1, 1, 1, 20
FROM workflow_node_rule r
WHERE r.node_key = 'ON_SITE_ASSESSMENT'
  AND NOT EXISTS (
    SELECT 1
    FROM workflow_node_rule_item i
    WHERE i.rule_id = r.id AND i.slot_key = 'CONTENT_REVIEWER_B' AND i.role_code = 'ROLE_REVIEWER'
  );

INSERT INTO workflow_node_rule_item (rule_id, slot_key, slot_label, role_code, required_flag, min_count, max_count, sort_order)
SELECT r.id, 'CONTENT_REVIEWER_B', 'Content Reviewer B', 'ROLE_REVIEW_CONTENT_B', 1, 1, 1, 30
FROM workflow_node_rule r
WHERE r.node_key = 'ON_SITE_ASSESSMENT'
  AND NOT EXISTS (
    SELECT 1
    FROM workflow_node_rule_item i
    WHERE i.rule_id = r.id AND i.slot_key = 'CONTENT_REVIEWER_B' AND i.role_code = 'ROLE_REVIEW_CONTENT_B'
  );

INSERT INTO workflow_node_rule_item (rule_id, slot_key, slot_label, role_code, required_flag, min_count, max_count, sort_order)
SELECT r.id, 'CONTENT_REVIEWER_C', 'Content Reviewer C', 'ROLE_SUPER_ADMIN', 1, 1, 1, 10
FROM workflow_node_rule r
WHERE r.node_key = 'ON_SITE_ASSESSMENT'
  AND NOT EXISTS (
    SELECT 1
    FROM workflow_node_rule_item i
    WHERE i.rule_id = r.id AND i.slot_key = 'CONTENT_REVIEWER_C' AND i.role_code = 'ROLE_SUPER_ADMIN'
  );

INSERT INTO workflow_node_rule_item (rule_id, slot_key, slot_label, role_code, required_flag, min_count, max_count, sort_order)
SELECT r.id, 'CONTENT_REVIEWER_C', 'Content Reviewer C', 'ROLE_REVIEWER', 1, 1, 1, 20
FROM workflow_node_rule r
WHERE r.node_key = 'ON_SITE_ASSESSMENT'
  AND NOT EXISTS (
    SELECT 1
    FROM workflow_node_rule_item i
    WHERE i.rule_id = r.id AND i.slot_key = 'CONTENT_REVIEWER_C' AND i.role_code = 'ROLE_REVIEWER'
  );

INSERT INTO workflow_node_rule_item (rule_id, slot_key, slot_label, role_code, required_flag, min_count, max_count, sort_order)
SELECT r.id, 'CONTENT_REVIEWER_C', 'Content Reviewer C', 'ROLE_REVIEW_CONTENT_C', 1, 1, 1, 30
FROM workflow_node_rule r
WHERE r.node_key = 'ON_SITE_ASSESSMENT'
  AND NOT EXISTS (
    SELECT 1
    FROM workflow_node_rule_item i
    WHERE i.rule_id = r.id AND i.slot_key = 'CONTENT_REVIEWER_C' AND i.role_code = 'ROLE_REVIEW_CONTENT_C'
  );
