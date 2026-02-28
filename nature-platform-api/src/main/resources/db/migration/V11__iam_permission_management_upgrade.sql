ALTER TABLE iam_permission
  ADD COLUMN enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER description;

ALTER TABLE iam_permission
  ADD COLUMN built_in TINYINT(1) NOT NULL DEFAULT 0 AFTER enabled;

UPDATE iam_permission
SET enabled = 1
WHERE enabled IS NULL;
