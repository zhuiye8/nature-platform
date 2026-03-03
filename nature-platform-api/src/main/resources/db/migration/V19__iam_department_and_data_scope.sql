CREATE TABLE IF NOT EXISTS iam_department (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  dept_code VARCHAR(64) NOT NULL,
  dept_name VARCHAR(128) NOT NULL,
  parent_id BIGINT NULL,
  source_type VARCHAR(16) NOT NULL DEFAULT 'LOCAL',
  ding_dept_id VARCHAR(64) NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_iam_department_code (dept_code),
  UNIQUE KEY uk_iam_department_ding_dept_id (ding_dept_id),
  KEY idx_iam_department_parent (parent_id),
  KEY idx_iam_department_enabled (enabled)
);

SET @ddl := (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'user_account'
        AND COLUMN_NAME = 'dept_id'
    ),
    'SELECT 1',
    'ALTER TABLE user_account ADD COLUMN dept_id BIGINT NULL AFTER source_type'
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
        AND TABLE_NAME = 'user_account'
        AND COLUMN_NAME = 'ding_user_id'
    ),
    'SELECT 1',
    'ALTER TABLE user_account ADD COLUMN ding_user_id VARCHAR(64) NULL AFTER dept_id'
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
        AND TABLE_NAME = 'user_account'
        AND COLUMN_NAME = 'ding_union_id'
    ),
    'SELECT 1',
    'ALTER TABLE user_account ADD COLUMN ding_union_id VARCHAR(128) NULL AFTER ding_user_id'
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
        AND TABLE_NAME = 'user_account'
        AND COLUMN_NAME = 'ding_job_number'
    ),
    'SELECT 1',
    'ALTER TABLE user_account ADD COLUMN ding_job_number VARCHAR(64) NULL AFTER ding_union_id'
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
        AND TABLE_NAME = 'user_account'
        AND COLUMN_NAME = 'last_sync_at'
    ),
    'SELECT 1',
    'ALTER TABLE user_account ADD COLUMN last_sync_at DATETIME NULL AFTER ding_job_number'
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
        AND TABLE_NAME = 'user_account'
        AND INDEX_NAME = 'uk_user_account_ding_user_id'
    ),
    'SELECT 1',
    'ALTER TABLE user_account ADD UNIQUE KEY uk_user_account_ding_user_id (ding_user_id)'
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
        AND TABLE_NAME = 'user_account'
        AND INDEX_NAME = 'idx_user_account_dept_id'
    ),
    'SELECT 1',
    'ALTER TABLE user_account ADD KEY idx_user_account_dept_id (dept_id)'
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
        AND TABLE_NAME = 'iam_role'
        AND COLUMN_NAME = 'data_scope'
    ),
    'SELECT 1',
    'ALTER TABLE iam_role ADD COLUMN data_scope VARCHAR(32) NOT NULL DEFAULT ''SELF'' AFTER enabled'
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
        AND TABLE_NAME = 'iam_role'
        AND COLUMN_NAME = 'project_view_all'
    ),
    'SELECT 1',
    'ALTER TABLE iam_role ADD COLUMN project_view_all TINYINT(1) NOT NULL DEFAULT 0 AFTER data_scope'
  )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE iam_role
SET data_scope = 'ALL', project_view_all = 1
WHERE role_code = 'ROLE_SUPER_ADMIN';

SET @ddl := (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'user_role'
        AND COLUMN_NAME = 'sort_order'
    ),
    'SELECT 1',
    'ALTER TABLE user_role ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER role_code'
  )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS iam_role_data_scope_dept (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  role_code VARCHAR(64) NOT NULL,
  dept_id BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_iam_role_data_scope_dept (role_code, dept_id),
  KEY idx_iam_role_data_scope_dept_dept_id (dept_id)
);

INSERT INTO iam_resource
  (resource_key, resource_name, resource_type, parent_key, route_path, icon, sort_order, enabled, built_in, description)
VALUES
  ('page.admin-departments', '部门管理', 'PAGE', 'group.system', '/admin-departments', 'OfficeBuilding', 305, 1, 1, '系统部门与组织同步管理页面')
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
VALUES ('ROLE_SUPER_ADMIN', 'page.admin-departments');
