CREATE TABLE IF NOT EXISTS report_tech_review_apply (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_register_id BIGINT NOT NULL,
  reviewer VARCHAR(64) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  remark VARCHAR(500) NULL,
  version_no INT NOT NULL DEFAULT 0,
  applied_by VARCHAR(64) NOT NULL,
  submitted_at DATETIME NULL,
  finished_at DATETIME NULL,
  updated_by VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_report_tech_review_project (project_register_id),
  KEY idx_report_tech_review_status (status, updated_at)
);

CREATE TABLE IF NOT EXISTS report_tech_review_task (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  apply_id BIGINT NOT NULL,
  project_register_id BIGINT NOT NULL,
  assignee VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  remark VARCHAR(500) NULL,
  processed_by VARCHAR(64) NULL,
  processed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_report_tech_review_task_apply (apply_id),
  KEY idx_report_tech_review_task_assignee (assignee, status, updated_at)
);

CREATE TABLE IF NOT EXISTS report_content_review_apply (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_register_id BIGINT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  applied_by VARCHAR(64) NOT NULL,
  submitted_at DATETIME NULL,
  finished_at DATETIME NULL,
  updated_by VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_report_content_review_project (project_register_id),
  KEY idx_report_content_review_status (status, updated_at)
);

CREATE TABLE IF NOT EXISTS report_content_review_task (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  apply_id BIGINT NOT NULL,
  project_register_id BIGINT NOT NULL,
  review_role VARCHAR(32) NOT NULL,
  assignee VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  remark VARCHAR(500) NULL,
  processed_by VARCHAR(64) NULL,
  processed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_report_content_review_task_role (apply_id, review_role),
  KEY idx_report_content_review_task_assignee (assignee, status, updated_at)
);

CREATE TABLE IF NOT EXISTS report_compile_assignment (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_register_id BIGINT NOT NULL,
  assignee VARCHAR(64) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  version_no INT NOT NULL DEFAULT 0,
  submitted_at DATETIME NULL,
  updated_by VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_report_compile_assignment_project (project_register_id),
  KEY idx_report_compile_assignment_status (status, updated_at)
);

CREATE TABLE IF NOT EXISTS report_compile_submission (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_register_id BIGINT NOT NULL,
  report_object_key VARCHAR(512) NULL,
  report_remark VARCHAR(1000) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  submitted_by VARCHAR(64) NULL,
  submitted_at DATETIME NULL,
  finished_at DATETIME NULL,
  updated_by VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_report_compile_submission_project (project_register_id),
  KEY idx_report_compile_submission_status (status, updated_at)
);

CREATE TABLE IF NOT EXISTS report_final_review_apply (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_register_id BIGINT NOT NULL,
  reviewer VARCHAR(64) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  remark VARCHAR(500) NULL,
  version_no INT NOT NULL DEFAULT 0,
  applied_by VARCHAR(64) NOT NULL,
  submitted_at DATETIME NULL,
  finished_at DATETIME NULL,
  updated_by VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_report_final_review_project (project_register_id),
  KEY idx_report_final_review_status (status, updated_at)
);

CREATE TABLE IF NOT EXISTS report_final_review_task (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  apply_id BIGINT NOT NULL,
  project_register_id BIGINT NOT NULL,
  assignee VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  remark VARCHAR(500) NULL,
  processed_by VARCHAR(64) NULL,
  processed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_report_final_review_task_apply (apply_id),
  KEY idx_report_final_review_task_assignee (assignee, status, updated_at)
);

CREATE TABLE IF NOT EXISTS material_archive (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_register_id BIGINT NOT NULL,
  report_files_json TEXT NULL,
  form_files_json TEXT NULL,
  remark VARCHAR(1000) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  submitted_by VARCHAR(64) NULL,
  submitted_at DATETIME NULL,
  updated_by VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_material_archive_project (project_register_id),
  KEY idx_material_archive_status (status, updated_at)
);
