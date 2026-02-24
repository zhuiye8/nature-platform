CREATE TABLE IF NOT EXISTS user_role (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL,
  role_code VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_role (username, role_code),
  KEY idx_user_role_code (role_code)
);

INSERT INTO user_role (username, role_code)
SELECT u.username, 'ROLE_USER'
FROM user_account u
WHERE u.enabled = 1
  AND NOT EXISTS (
    SELECT 1 FROM user_role ur WHERE ur.username = u.username AND ur.role_code = 'ROLE_USER'
  );

INSERT INTO user_role (username, role_code)
SELECT 'admin', 'ROLE_SUPER_ADMIN'
WHERE EXISTS (SELECT 1 FROM user_account WHERE username = 'admin')
  AND NOT EXISTS (
    SELECT 1 FROM user_role WHERE username = 'admin' AND role_code = 'ROLE_SUPER_ADMIN'
  );

INSERT INTO user_role (username, role_code)
SELECT 'admin', 'ROLE_REVIEWER'
WHERE EXISTS (SELECT 1 FROM user_account WHERE username = 'admin')
  AND NOT EXISTS (
    SELECT 1 FROM user_role WHERE username = 'admin' AND role_code = 'ROLE_REVIEWER'
  );

INSERT INTO user_role (username, role_code)
SELECT 'admin', 'ROLE_REVIEW_TECH'
WHERE EXISTS (SELECT 1 FROM user_account WHERE username = 'admin')
  AND NOT EXISTS (
    SELECT 1 FROM user_role WHERE username = 'admin' AND role_code = 'ROLE_REVIEW_TECH'
  );

INSERT INTO user_role (username, role_code)
SELECT 'admin', 'ROLE_REVIEW_CONTENT_A'
WHERE EXISTS (SELECT 1 FROM user_account WHERE username = 'admin')
  AND NOT EXISTS (
    SELECT 1 FROM user_role WHERE username = 'admin' AND role_code = 'ROLE_REVIEW_CONTENT_A'
  );

INSERT INTO user_role (username, role_code)
SELECT 'admin', 'ROLE_REVIEW_CONTENT_B'
WHERE EXISTS (SELECT 1 FROM user_account WHERE username = 'admin')
  AND NOT EXISTS (
    SELECT 1 FROM user_role WHERE username = 'admin' AND role_code = 'ROLE_REVIEW_CONTENT_B'
  );

INSERT INTO user_role (username, role_code)
SELECT 'admin', 'ROLE_REVIEW_CONTENT_C'
WHERE EXISTS (SELECT 1 FROM user_account WHERE username = 'admin')
  AND NOT EXISTS (
    SELECT 1 FROM user_role WHERE username = 'admin' AND role_code = 'ROLE_REVIEW_CONTENT_C'
  );

INSERT INTO user_role (username, role_code)
SELECT 'reviewer', 'ROLE_REVIEWER'
WHERE EXISTS (SELECT 1 FROM user_account WHERE username = 'reviewer')
  AND NOT EXISTS (
    SELECT 1 FROM user_role WHERE username = 'reviewer' AND role_code = 'ROLE_REVIEWER'
  );

INSERT INTO user_role (username, role_code)
SELECT 'reviewer', 'ROLE_REVIEW_TECH'
WHERE EXISTS (SELECT 1 FROM user_account WHERE username = 'reviewer')
  AND NOT EXISTS (
    SELECT 1 FROM user_role WHERE username = 'reviewer' AND role_code = 'ROLE_REVIEW_TECH'
  );

INSERT INTO user_role (username, role_code)
SELECT 'reviewer', 'ROLE_REVIEW_CONTENT_A'
WHERE EXISTS (SELECT 1 FROM user_account WHERE username = 'reviewer')
  AND NOT EXISTS (
    SELECT 1 FROM user_role WHERE username = 'reviewer' AND role_code = 'ROLE_REVIEW_CONTENT_A'
  );

INSERT INTO user_role (username, role_code)
SELECT 'reviewer', 'ROLE_REVIEW_CONTENT_B'
WHERE EXISTS (SELECT 1 FROM user_account WHERE username = 'reviewer')
  AND NOT EXISTS (
    SELECT 1 FROM user_role WHERE username = 'reviewer' AND role_code = 'ROLE_REVIEW_CONTENT_B'
  );

INSERT INTO user_role (username, role_code)
SELECT 'reviewer', 'ROLE_REVIEW_CONTENT_C'
WHERE EXISTS (SELECT 1 FROM user_account WHERE username = 'reviewer')
  AND NOT EXISTS (
    SELECT 1 FROM user_role WHERE username = 'reviewer' AND role_code = 'ROLE_REVIEW_CONTENT_C'
  );
