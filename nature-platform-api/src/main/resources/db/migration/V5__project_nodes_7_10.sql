CREATE TABLE IF NOT EXISTS police_register (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_register_id BIGINT NOT NULL,
  register_no VARCHAR(128) NULL,
  filing_agency VARCHAR(255) NULL,
  contact_name VARCHAR(64) NULL,
  contact_phone VARCHAR(32) NULL,
  remark TEXT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  created_by VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_police_register_project (project_register_id),
  KEY idx_police_register_status (status, updated_at)
);

CREATE TABLE IF NOT EXISTS on_site_assessment (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_register_id BIGINT NOT NULL,
  package_object_key VARCHAR(512) NULL,
  assessment_detail TEXT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  created_by VARCHAR(64) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_on_site_assessment_project (project_register_id),
  KEY idx_on_site_assessment_status (status, updated_at)
);

CREATE TABLE IF NOT EXISTS quality_review_apply (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_register_id BIGINT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  applied_by VARCHAR(64) NOT NULL,
  submitted_at DATETIME NULL,
  finished_at DATETIME NULL,
  updated_by VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_quality_review_apply_project (project_register_id),
  KEY idx_quality_review_apply_status (status, updated_at)
);

CREATE TABLE IF NOT EXISTS quality_review_task (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  quality_apply_id BIGINT NOT NULL,
  project_register_id BIGINT NOT NULL,
  review_role VARCHAR(32) NOT NULL,
  assignee VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  remark VARCHAR(500) NULL,
  processed_by VARCHAR(64) NULL,
  processed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_quality_review_task_role (quality_apply_id, review_role),
  KEY idx_quality_review_task_assignee (assignee, status, updated_at),
  KEY idx_quality_review_task_project (project_register_id, status)
);
