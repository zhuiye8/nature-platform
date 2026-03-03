-- @doc-sync Add final-review assignee slot to on-site assignment and bootstrap node-rule defaults.

ALTER TABLE workflow_assignment
  ADD COLUMN final_reviewer VARCHAR(64) NULL AFTER content_reviewer_c;

UPDATE workflow_assignment wa
JOIN report_final_review_apply a ON a.project_register_id = wa.project_register_id
SET wa.final_reviewer = a.reviewer
WHERE (wa.final_reviewer IS NULL OR TRIM(wa.final_reviewer) = '')
  AND a.reviewer IS NOT NULL
  AND TRIM(a.reviewer) <> '';

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
  '最终审核',
  'ROLE_SUPER_ADMIN',
  1,
  1,
  1,
  40
FROM workflow_node_rule r
WHERE r.node_key = 'ON_SITE_ASSESSMENT'
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
  '最终审核',
  'ROLE_REVIEWER',
  1,
  1,
  1,
  50
FROM workflow_node_rule r
WHERE r.node_key = 'ON_SITE_ASSESSMENT'
  AND NOT EXISTS (
    SELECT 1
    FROM workflow_node_rule_item i
    WHERE i.rule_id = r.id
      AND i.slot_key = 'FINAL_REVIEWER'
      AND i.role_code = 'ROLE_REVIEWER'
  );
