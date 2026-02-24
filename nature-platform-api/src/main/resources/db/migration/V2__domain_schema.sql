CREATE TABLE IF NOT EXISTS user_account (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(128) NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  source_type VARCHAR(32) NOT NULL DEFAULT 'LOCAL',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_notification (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  receiver_username VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  read_flag TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS field_change_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  biz_type VARCHAR(64) NOT NULL,
  biz_id BIGINT NOT NULL,
  field_name VARCHAR(128) NOT NULL,
  old_value TEXT NULL,
  new_value TEXT NULL,
  operator VARCHAR(64) NOT NULL,
  operated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  full_name VARCHAR(255) NOT NULL,
  industry VARCHAR(128) NULL,
  region VARCHAR(128) NULL,
  address_detail VARCHAR(255) NULL,
  uscc VARCHAR(64) NULL,
  contact_name VARCHAR(64) NULL,
  mobile_phone VARCHAR(32) NULL,
  remark TEXT NULL,
  created_by VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_flag TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL,
  KEY idx_customer_deleted (deleted_flag),
  KEY idx_customer_creator (created_by)
);

CREATE TABLE IF NOT EXISTS contract (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  customer_id BIGINT NOT NULL,
  project_name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(64) NULL,
  mobile_phone VARCHAR(32) NULL,
  payment_company VARCHAR(255) NULL,
  payment_amount DECIMAL(18,2) NULL,
  payment_method VARCHAR(128) NULL,
  partner_name VARCHAR(255) NULL,
  sales_person VARCHAR(64) NULL,
  performance_city VARCHAR(64) NULL,
  deal_status VARCHAR(64) NULL,
  remark TEXT NULL,
  contract_type VARCHAR(64) NULL,
  service_years_json TEXT NOT NULL,
  contract_name VARCHAR(500) NULL,
  contract_no VARCHAR(64) NULL,
  application_form_no VARCHAR(64) NULL,
  review_status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  archive_status VARCHAR(32) NOT NULL DEFAULT 'PENDING_ARCHIVE',
  contract_file_object_key VARCHAR(512) NULL,
  service_year_detail TEXT NULL,
  payment_status VARCHAR(32) NOT NULL DEFAULT 'UNPAID',
  signed_at DATETIME NULL,
  file_count INT NULL,
  storage_location VARCHAR(255) NULL,
  archive_remark TEXT NULL,
  archive_scan_object_key VARCHAR(512) NULL,
  created_by VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_flag TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL,
  KEY idx_contract_customer (customer_id),
  KEY idx_contract_status (review_status, archive_status),
  KEY idx_contract_deleted (deleted_flag)
);

CREATE TABLE IF NOT EXISTS contract_system_item (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  contract_id BIGINT NOT NULL,
  system_level TINYINT NOT NULL,
  system_name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_flag TINYINT(1) NOT NULL DEFAULT 0,
  KEY idx_contract_system_contract (contract_id, deleted_flag)
);

CREATE TABLE IF NOT EXISTS contract_serial (
  serial_year INT PRIMARY KEY,
  next_seq INT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_register (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  contract_id BIGINT NOT NULL,
  contract_year INT NOT NULL,
  application_name VARCHAR(500) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  created_by VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_flag TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL,
  UNIQUE KEY uk_project_contract_year_active (contract_id, contract_year, deleted_flag),
  KEY idx_project_status (status),
  KEY idx_project_deleted (deleted_flag)
);

CREATE TABLE IF NOT EXISTS project_system_item (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_register_id BIGINT NOT NULL,
  system_name VARCHAR(255) NOT NULL,
  filing_agency VARCHAR(255) NOT NULL,
  security_level VARCHAR(64) NOT NULL,
  is_reassessment TINYINT(1) NOT NULL,
  required_entry_date DATE NOT NULL,
  required_report_delivery_date DATE NOT NULL,
  assessed_unit_name VARCHAR(255) NOT NULL,
  assessed_unit_industry VARCHAR(128) NOT NULL,
  assessed_unit_contact VARCHAR(64) NOT NULL,
  assessed_unit_mobile VARCHAR(32) NOT NULL,
  assessed_unit_address VARCHAR(255) NOT NULL,
  has_filing_certificate TINYINT(1) NOT NULL,
  filing_certificate_files_json TEXT NULL,
  filing_certificate_no VARCHAR(128) NULL,
  filing_certificate_issued_at DATE NULL,
  has_filing_form TINYINT(1) NOT NULL,
  filing_form_files_json TEXT NULL,
  has_classification_report TINYINT(1) NOT NULL,
  classification_report_files_json TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_flag TINYINT(1) NOT NULL DEFAULT 0,
  KEY idx_project_system_project (project_register_id, deleted_flag)
);

CREATE TABLE IF NOT EXISTS workflow_assignment (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_register_id BIGINT NOT NULL,
  tech_reviewer VARCHAR(64) NOT NULL,
  content_reviewer_a VARCHAR(64) NOT NULL,
  content_reviewer_b VARCHAR(64) NOT NULL,
  content_reviewer_c VARCHAR(64) NOT NULL,
  version_no INT NOT NULL DEFAULT 0,
  updated_by VARCHAR(64) NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_workflow_assignment_project (project_register_id)
);

CREATE TABLE IF NOT EXISTS recycle_bin (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  biz_type VARCHAR(32) NOT NULL,
  biz_id BIGINT NOT NULL,
  deleted_by VARCHAR(64) NOT NULL,
  deleted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  remark VARCHAR(255) NULL,
  UNIQUE KEY uk_recycle_biz (biz_type, biz_id)
);

ALTER TABLE system_notification
  ADD COLUMN event_type VARCHAR(64) NULL,
  ADD COLUMN ref_type VARCHAR(64) NULL,
  ADD COLUMN ref_id BIGINT NULL,
  ADD COLUMN deleted_flag TINYINT(1) NOT NULL DEFAULT 0;

INSERT INTO user_account (username, password_hash, display_name, enabled, source_type)
SELECT 'admin', 'admin123', '管理员', 1, 'LOCAL'
WHERE NOT EXISTS (SELECT 1 FROM user_account WHERE username = 'admin');

INSERT INTO user_account (username, password_hash, display_name, enabled, source_type)
SELECT 'reviewer', 'review123', '审核员', 1, 'LOCAL'
WHERE NOT EXISTS (SELECT 1 FROM user_account WHERE username = 'reviewer');
