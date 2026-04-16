-- Step 1: Remove duplicate assignment rules (keep the row with the smallest id)
DELETE FROM wf_assignment_rule a
USING wf_assignment_rule b
WHERE a.id > b.id
  AND a.node_key = b.node_key
  AND a.slot_key = b.slot_key
  AND a.role_code = b.role_code;
--> statement-breakpoint

-- Step 2: Insert missing dept_manager rule for PROJECT_REVIEW (idempotent)
INSERT INTO wf_assignment_rule (node_key, slot_key, slot_label, role_code, avoidance_rule, priority)
SELECT 'PROJECT_REVIEW', 'REVIEWER', '项目审核人（部门经理池化）', 'dept_manager', 'NONE', 50
WHERE NOT EXISTS (
  SELECT 1 FROM wf_assignment_rule
  WHERE node_key = 'PROJECT_REVIEW' AND role_code = 'dept_manager'
);
--> statement-breakpoint

-- Step 3: Add unique constraint to prevent future duplicates
-- With this constraint, seed.sql's ON CONFLICT DO NOTHING works correctly
ALTER TABLE "wf_assignment_rule" ADD CONSTRAINT "wf_assignment_rule_node_slot_role_uq" UNIQUE("node_key","slot_key","role_code");
