-- @doc-sync Align content-review taxonomy to technical/management/network and localize built-in role names.

INSERT INTO iam_role (role_code, role_name, description, system_flag, enabled)
SELECT 'ROLE_REVIEW_CONTENT_TECH', '内容审核（技术）', '负责内容审核技术维度', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM iam_role WHERE role_code = 'ROLE_REVIEW_CONTENT_TECH');

INSERT INTO iam_role (role_code, role_name, description, system_flag, enabled)
SELECT 'ROLE_REVIEW_CONTENT_MANAGEMENT', '内容审核（管理）', '负责内容审核管理维度', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM iam_role WHERE role_code = 'ROLE_REVIEW_CONTENT_MANAGEMENT');

INSERT INTO iam_role (role_code, role_name, description, system_flag, enabled)
SELECT 'ROLE_REVIEW_CONTENT_NETWORK', '内容审核（网络）', '负责内容审核网络维度', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM iam_role WHERE role_code = 'ROLE_REVIEW_CONTENT_NETWORK');

INSERT IGNORE INTO user_role (username, role_code)
SELECT username, 'ROLE_REVIEW_CONTENT_TECH'
FROM user_role
WHERE role_code = 'ROLE_REVIEW_CONTENT_A';

INSERT IGNORE INTO user_role (username, role_code)
SELECT username, 'ROLE_REVIEW_CONTENT_MANAGEMENT'
FROM user_role
WHERE role_code = 'ROLE_REVIEW_CONTENT_B';

INSERT IGNORE INTO user_role (username, role_code)
SELECT username, 'ROLE_REVIEW_CONTENT_NETWORK'
FROM user_role
WHERE role_code = 'ROLE_REVIEW_CONTENT_C';

INSERT IGNORE INTO iam_role_permission (role_code, permission_code)
SELECT 'ROLE_REVIEW_CONTENT_TECH', permission_code
FROM iam_role_permission
WHERE role_code = 'ROLE_REVIEW_CONTENT_A';

INSERT IGNORE INTO iam_role_permission (role_code, permission_code)
SELECT 'ROLE_REVIEW_CONTENT_MANAGEMENT', permission_code
FROM iam_role_permission
WHERE role_code = 'ROLE_REVIEW_CONTENT_B';

INSERT IGNORE INTO iam_role_permission (role_code, permission_code)
SELECT 'ROLE_REVIEW_CONTENT_NETWORK', permission_code
FROM iam_role_permission
WHERE role_code = 'ROLE_REVIEW_CONTENT_C';

INSERT IGNORE INTO workflow_node_rule_item (
  rule_id,
  slot_key,
  slot_label,
  role_code,
  required_flag,
  min_count,
  max_count,
  sort_order
)
SELECT
  rule_id,
  CASE slot_key
    WHEN 'CONTENT_REVIEWER_A' THEN 'CONTENT_REVIEWER_TECH'
    WHEN 'CONTENT_REVIEWER_B' THEN 'CONTENT_REVIEWER_MANAGEMENT'
    WHEN 'CONTENT_REVIEWER_C' THEN 'CONTENT_REVIEWER_NETWORK'
    ELSE slot_key
  END,
  CASE slot_key
    WHEN 'CONTENT_REVIEWER_A' THEN '内容审核-技术'
    WHEN 'CONTENT_REVIEWER_B' THEN '内容审核-管理'
    WHEN 'CONTENT_REVIEWER_C' THEN '内容审核-网络'
    ELSE slot_label
  END,
  CASE role_code
    WHEN 'ROLE_REVIEW_CONTENT_A' THEN 'ROLE_REVIEW_CONTENT_TECH'
    WHEN 'ROLE_REVIEW_CONTENT_B' THEN 'ROLE_REVIEW_CONTENT_MANAGEMENT'
    WHEN 'ROLE_REVIEW_CONTENT_C' THEN 'ROLE_REVIEW_CONTENT_NETWORK'
    ELSE role_code
  END,
  required_flag,
  min_count,
  max_count,
  sort_order
FROM workflow_node_rule_item
WHERE slot_key IN ('CONTENT_REVIEWER_A', 'CONTENT_REVIEWER_B', 'CONTENT_REVIEWER_C');

DELETE FROM workflow_node_rule_item
WHERE slot_key IN ('CONTENT_REVIEWER_A', 'CONTENT_REVIEWER_B', 'CONTENT_REVIEWER_C');

UPDATE workflow_node_rule_item
SET slot_label = '内容审核-技术'
WHERE slot_key = 'CONTENT_REVIEWER_TECH';

UPDATE workflow_node_rule_item
SET slot_label = '内容审核-管理'
WHERE slot_key = 'CONTENT_REVIEWER_MANAGEMENT';

UPDATE workflow_node_rule_item
SET slot_label = '内容审核-网络'
WHERE slot_key = 'CONTENT_REVIEWER_NETWORK';

UPDATE workflow_node_rule_item
SET role_code = 'ROLE_REVIEW_CONTENT_TECH'
WHERE role_code = 'ROLE_REVIEW_CONTENT_A';

UPDATE workflow_node_rule_item
SET role_code = 'ROLE_REVIEW_CONTENT_MANAGEMENT'
WHERE role_code = 'ROLE_REVIEW_CONTENT_B';

UPDATE workflow_node_rule_item
SET role_code = 'ROLE_REVIEW_CONTENT_NETWORK'
WHERE role_code = 'ROLE_REVIEW_CONTENT_C';

UPDATE quality_review_task
SET review_role = 'CONTENT_TECH'
WHERE review_role = 'CONTENT_A';

UPDATE quality_review_task
SET review_role = 'CONTENT_MANAGEMENT'
WHERE review_role = 'CONTENT_B';

UPDATE quality_review_task
SET review_role = 'CONTENT_NETWORK'
WHERE review_role = 'CONTENT_C';

UPDATE report_content_review_task
SET review_role = 'CONTENT_TECH'
WHERE review_role = 'CONTENT_A';

UPDATE report_content_review_task
SET review_role = 'CONTENT_MANAGEMENT'
WHERE review_role = 'CONTENT_B';

UPDATE report_content_review_task
SET review_role = 'CONTENT_NETWORK'
WHERE review_role = 'CONTENT_C';

DELETE FROM iam_role_permission
WHERE role_code IN ('ROLE_REVIEW_CONTENT_A', 'ROLE_REVIEW_CONTENT_B', 'ROLE_REVIEW_CONTENT_C');

DELETE FROM user_role
WHERE role_code IN ('ROLE_REVIEW_CONTENT_A', 'ROLE_REVIEW_CONTENT_B', 'ROLE_REVIEW_CONTENT_C');

DELETE FROM iam_role
WHERE role_code IN ('ROLE_REVIEW_CONTENT_A', 'ROLE_REVIEW_CONTENT_B', 'ROLE_REVIEW_CONTENT_C');

UPDATE iam_role
SET role_name = '普通用户', description = '平台基础登录角色'
WHERE role_code = 'ROLE_USER';

UPDATE iam_role
SET role_name = '超级管理员', description = '平台超级管理员'
WHERE role_code = 'ROLE_SUPER_ADMIN';

UPDATE iam_role
SET role_name = '流程审核员', description = '跨节点流程审核角色'
WHERE role_code = 'ROLE_REVIEWER';

UPDATE iam_role
SET role_name = '报告技术审核员', description = '负责报告整体技术审核'
WHERE role_code = 'ROLE_REVIEW_TECH';

UPDATE iam_role
SET role_name = '内容审核（技术）', description = '负责内容审核技术维度'
WHERE role_code = 'ROLE_REVIEW_CONTENT_TECH';

UPDATE iam_role
SET role_name = '内容审核（管理）', description = '负责内容审核管理维度'
WHERE role_code = 'ROLE_REVIEW_CONTENT_MANAGEMENT';

UPDATE iam_role
SET role_name = '内容审核（网络）', description = '负责内容审核网络维度'
WHERE role_code = 'ROLE_REVIEW_CONTENT_NETWORK';

UPDATE workflow_definition_registry
SET description = '内容审核（技术/管理/网络）并行处理阶段'
WHERE node_key = 'REPORT_CONTENT_REVIEW';

UPDATE workflow_definition_registry
SET description = '上传现场测评ZIP并分配技术审核+内容审核（技术/管理/网络）'
WHERE node_key = 'ON_SITE_ASSESSMENT';
