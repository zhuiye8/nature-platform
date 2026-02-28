SET @sql_add_enabled = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'iam_permission'
        AND COLUMN_NAME = 'enabled'
    ),
    'SELECT 1',
    'ALTER TABLE iam_permission ADD COLUMN enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER description'
  )
);
PREPARE stmt_add_enabled FROM @sql_add_enabled;
EXECUTE stmt_add_enabled;
DEALLOCATE PREPARE stmt_add_enabled;

SET @sql_add_built_in = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'iam_permission'
        AND COLUMN_NAME = 'built_in'
    ),
    'SELECT 1',
    'ALTER TABLE iam_permission ADD COLUMN built_in TINYINT(1) NOT NULL DEFAULT 0 AFTER enabled'
  )
);
PREPARE stmt_add_built_in FROM @sql_add_built_in;
EXECUTE stmt_add_built_in;
DEALLOCATE PREPARE stmt_add_built_in;

UPDATE iam_permission
SET enabled = 1
WHERE enabled IS NULL;
