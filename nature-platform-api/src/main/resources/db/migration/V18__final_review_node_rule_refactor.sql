-- @doc-sync Shift final-review assignee source to final-review node rule and normalize corrupted slot labels.

INSERT INTO workflow_node_rule (node_key, rule_name, enabled, updated_by)
SELECT 'REPORT_FINAL_REVIEW_TASK', '最终审核安插规则', 1, 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM workflow_node_rule WHERE node_key = 'REPORT_FINAL_REVIEW_TASK'
);

INSERT INTO workflow_node_rule_item (
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
  r.id,
  'FINAL_REVIEWER',
  '最终审核人',
  'ROLE_SUPER_ADMIN',
  1,
  1,
  1,
  10
FROM workflow_node_rule r
WHERE r.node_key = 'REPORT_FINAL_REVIEW_TASK'
  AND NOT EXISTS (
    SELECT 1
    FROM workflow_node_rule_item i
    WHERE i.rule_id = r.id
      AND i.slot_key = 'FINAL_REVIEWER'
      AND i.role_code = 'ROLE_SUPER_ADMIN'
  );

INSERT INTO workflow_node_rule_item (
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
  r.id,
  'FINAL_REVIEWER',
  '最终审核人',
  'ROLE_REVIEWER',
  1,
  1,
  1,
  20
FROM workflow_node_rule r
WHERE r.node_key = 'REPORT_FINAL_REVIEW_TASK'
  AND NOT EXISTS (
    SELECT 1
    FROM workflow_node_rule_item i
    WHERE i.rule_id = r.id
      AND i.slot_key = 'FINAL_REVIEWER'
      AND i.role_code = 'ROLE_REVIEWER'
  );

DELETE i
FROM workflow_node_rule_item i
JOIN workflow_node_rule r ON r.id = i.rule_id
WHERE r.node_key = 'ON_SITE_ASSESSMENT'
  AND i.slot_key = 'FINAL_REVIEWER';

UPDATE workflow_node_rule_item
SET slot_label = CASE slot_key
  WHEN 'TECH_REVIEWER' THEN '技术审核人'
  WHEN 'CONTENT_REVIEWER_A' THEN '内容审核-技术'
  WHEN 'CONTENT_REVIEWER_B' THEN '内容审核-管理'
  WHEN 'CONTENT_REVIEWER_C' THEN '内容审核-网络'
  WHEN 'CONTENT_REVIEWER_TECH' THEN '内容审核-技术'
  WHEN 'CONTENT_REVIEWER_MANAGEMENT' THEN '内容审核-管理'
  WHEN 'CONTENT_REVIEWER_NETWORK' THEN '内容审核-网络'
  WHEN 'FINAL_REVIEWER' THEN '最终审核人'
  ELSE slot_label
END
WHERE slot_key IN (
  'TECH_REVIEWER',
  'CONTENT_REVIEWER_A',
  'CONTENT_REVIEWER_B',
  'CONTENT_REVIEWER_C',
  'CONTENT_REVIEWER_TECH',
  'CONTENT_REVIEWER_MANAGEMENT',
  'CONTENT_REVIEWER_NETWORK',
  'FINAL_REVIEWER'
)
  AND (
    slot_label IS NULL
    OR TRIM(slot_label) = ''
    OR slot_label LIKE '%?%'
    OR slot_label LIKE '%�%'
    OR slot_label LIKE '%锟%'
  );
