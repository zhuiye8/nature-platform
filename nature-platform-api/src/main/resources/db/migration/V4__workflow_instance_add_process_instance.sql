ALTER TABLE workflow_instance
  ADD COLUMN process_instance_id VARCHAR(64) NULL AFTER started_by;

CREATE INDEX idx_workflow_instance_process_id ON workflow_instance (process_instance_id);
