-- @doc-sync Add project manager selection, assessment-member mapping, role peer-sales flag, and material-status checklist fields.

SET @ddl := (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'police_register'
        AND COLUMN_NAME = 'project_manager_username'
    ),
    'SELECT 1',
    'ALTER TABLE police_register ADD COLUMN project_manager_username VARCHAR(64) NULL AFTER contact_phone'
  )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'police_register'
        AND INDEX_NAME = 'idx_police_register_project_manager'
    ),
    'SELECT 1',
    'ALTER TABLE police_register ADD KEY idx_police_register_project_manager (project_manager_username)'
  )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS project_assessment_member (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_register_id BIGINT NOT NULL,
  username VARCHAR(64) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_by VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_project_assessment_member_project_user (project_register_id, username),
  KEY idx_project_assessment_member_project (project_register_id, sort_order),
  KEY idx_project_assessment_member_user (username)
);

SET @ddl := (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'on_site_assessment'
        AND COLUMN_NAME = 'evidence_files_json'
    ),
    'SELECT 1',
    'ALTER TABLE on_site_assessment ADD COLUMN evidence_files_json LONGTEXT NULL AFTER package_object_key'
  )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE on_site_assessment
SET evidence_files_json = JSON_ARRAY(package_object_key)
WHERE (evidence_files_json IS NULL OR TRIM(evidence_files_json) = '')
  AND package_object_key IS NOT NULL
  AND TRIM(package_object_key) <> '';

UPDATE on_site_assessment
SET evidence_files_json = '[]'
WHERE evidence_files_json IS NULL OR TRIM(evidence_files_json) = '';

SET @ddl := (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'on_site_assessment'
        AND COLUMN_NAME = 'assessment_remark'
    ),
    'SELECT 1',
    'ALTER TABLE on_site_assessment ADD COLUMN assessment_remark TEXT NULL AFTER assessment_detail'
  )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'material_archive'
        AND COLUMN_NAME = 'material_status_codes_json'
    ),
    'SELECT 1',
    'ALTER TABLE material_archive ADD COLUMN material_status_codes_json LONGTEXT NULL AFTER form_files_json'
  )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE material_archive
SET material_status_codes_json = '[]'
WHERE material_status_codes_json IS NULL OR TRIM(material_status_codes_json) = '';

SET @ddl := (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'iam_role'
        AND COLUMN_NAME = 'peer_sales_limited'
    ),
    'SELECT 1',
    'ALTER TABLE iam_role ADD COLUMN peer_sales_limited TINYINT(1) NOT NULL DEFAULT 0 AFTER project_view_all'
  )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT INTO iam_resource
  (resource_key, resource_name, resource_type, parent_key, route_path, icon, sort_order, enabled, built_in, description)
VALUES
  ('page.on-site-assessment-executions', '现场测评实施', 'PAGE', 'group.business', '/on-site-assessment-executions', 'Connection', 140, 1, 1, '测评人员维护现场测评信息并提交审核'),
  ('page.on-site-assessment-results', '现场测评结果', 'PAGE', 'group.business', '/on-site-assessment-results', 'CircleCheck', 145, 1, 1, '项目经理查看现场测评结果并提交审核')
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

INSERT IGNORE INTO iam_role_resource (role_code, resource_key)
VALUES
  ('ROLE_SUPER_ADMIN', 'page.on-site-assessment-executions'),
  ('ROLE_SUPER_ADMIN', 'page.on-site-assessment-results');
