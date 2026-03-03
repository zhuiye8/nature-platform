-- Drop unused workflow node-rule item numeric fields (min/max/sort).
-- MySQL 8.4 does not support "DROP COLUMN IF EXISTS" syntax directly, so use dynamic guards.
SET @ddl = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'workflow_node_rule_item'
        AND COLUMN_NAME = 'min_count'
    ),
    'ALTER TABLE workflow_node_rule_item DROP COLUMN min_count',
    'SELECT 1'
  )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'workflow_node_rule_item'
        AND COLUMN_NAME = 'max_count'
    ),
    'ALTER TABLE workflow_node_rule_item DROP COLUMN max_count',
    'SELECT 1'
  )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'workflow_node_rule_item'
        AND COLUMN_NAME = 'sort_order'
    ),
    'ALTER TABLE workflow_node_rule_item DROP COLUMN sort_order',
    'SELECT 1'
  )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
