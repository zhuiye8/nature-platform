CREATE TABLE IF NOT EXISTS workflow_instance (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  biz_type VARCHAR(64) NOT NULL,
  biz_id BIGINT NOT NULL,
  workflow_key VARCHAR(64) NOT NULL,
  current_node VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  started_by VARCHAR(64) NOT NULL,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_workflow_instance_biz (biz_type, biz_id),
  KEY idx_workflow_instance_status (biz_type, status, updated_at)
);

CREATE TABLE IF NOT EXISTS workflow_action_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  instance_id BIGINT NOT NULL,
  biz_type VARCHAR(64) NOT NULL,
  biz_id BIGINT NOT NULL,
  action VARCHAR(32) NOT NULL,
  from_status VARCHAR(32) NULL,
  to_status VARCHAR(32) NULL,
  operator VARCHAR(64) NOT NULL,
  remark VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_workflow_action_biz (biz_type, biz_id, id),
  KEY idx_workflow_action_instance (instance_id, id)
);

INSERT INTO workflow_instance (biz_type, biz_id, workflow_key, current_node, status, started_by, started_at, finished_at)
SELECT
  'PROJECT_REGISTER',
  p.id,
  'PROJECT_REGISTER_FLOW',
  'PROJECT_REGISTER_REVIEW',
  'PENDING',
  p.created_by,
  COALESCE(p.updated_at, p.created_at),
  NULL
FROM project_register p
WHERE p.deleted_flag = 0
  AND p.status = 'SUBMITTED'
ON DUPLICATE KEY UPDATE
  workflow_key = VALUES(workflow_key),
  current_node = VALUES(current_node),
  status = VALUES(status),
  finished_at = NULL;

INSERT INTO workflow_action_log (instance_id, biz_type, biz_id, action, from_status, to_status, operator, remark, created_at)
SELECT
  wi.id,
  'PROJECT_REGISTER',
  p.id,
  'SUBMIT',
  NULL,
  'SUBMITTED',
  p.created_by,
  '历史数据补齐',
  COALESCE(p.updated_at, p.created_at)
FROM project_register p
JOIN workflow_instance wi
  ON wi.biz_type = 'PROJECT_REGISTER'
 AND wi.biz_id = p.id
LEFT JOIN workflow_action_log wal
  ON wal.instance_id = wi.id
 AND wal.action = 'SUBMIT'
WHERE p.deleted_flag = 0
  AND p.status = 'SUBMITTED'
  AND wal.id IS NULL;
