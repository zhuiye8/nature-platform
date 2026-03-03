-- 钉钉登录与部门默认角色映射补充

SET @ddl := (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'user_account'
        AND COLUMN_NAME = 'must_change_password'
    ),
    'SELECT 1',
    'ALTER TABLE user_account ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER password_hash'
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
        AND INDEX_NAME = 'uk_user_account_ding_union_id'
    ),
    'SELECT 1',
    'ALTER TABLE user_account ADD UNIQUE KEY uk_user_account_ding_union_id (ding_union_id)'
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
        AND TABLE_NAME = 'iam_department'
        AND COLUMN_NAME = 'default_role_code'
    ),
    'SELECT 1',
    'ALTER TABLE iam_department ADD COLUMN default_role_code VARCHAR(64) NULL AFTER sort_order'
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
        AND TABLE_NAME = 'iam_department'
        AND INDEX_NAME = 'idx_iam_department_default_role_code'
    ),
    'SELECT 1',
    'ALTER TABLE iam_department ADD KEY idx_iam_department_default_role_code (default_role_code)'
  )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE user_account
SET must_change_password = 1
WHERE source_type = 'DINGTALK'
  AND (password_hash = 'dingtalk-login-only' OR password_hash LIKE 'TEMP_%');
