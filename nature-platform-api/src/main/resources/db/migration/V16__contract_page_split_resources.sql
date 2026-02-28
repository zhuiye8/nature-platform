INSERT INTO iam_resource
  (resource_key, resource_name, resource_type, parent_key, route_path, icon, sort_order, enabled, built_in, description)
VALUES
  ('page.contract-submissions', '合同提审', 'PAGE', 'group.business', '/contract-submissions', 'Document', 210, 1, 1, '合同创建、编辑与提交审核页面'),
  ('page.contract-archives', '合同归档', 'PAGE', 'group.business', '/contract-archives', 'FolderChecked', 215, 1, 1, '合同归档与归档记录页面')
ON DUPLICATE KEY UPDATE
  resource_name = VALUES(resource_name),
  resource_type = VALUES(resource_type),
  parent_key = VALUES(parent_key),
  route_path = VALUES(route_path),
  icon = VALUES(icon),
  sort_order = VALUES(sort_order),
  enabled = VALUES(enabled),
  built_in = VALUES(built_in),
  description = VALUES(description);

INSERT IGNORE INTO iam_role_resource (role_code, resource_key)
SELECT role_code, 'page.contract-submissions'
FROM iam_role_resource
WHERE resource_key = 'page.contracts';

INSERT IGNORE INTO iam_role_resource (role_code, resource_key)
SELECT role_code, 'page.contract-archives'
FROM iam_role_resource
WHERE resource_key = 'page.contracts';

INSERT IGNORE INTO iam_role_resource (role_code, resource_key)
VALUES
  ('ROLE_SUPER_ADMIN', 'page.contract-submissions'),
  ('ROLE_SUPER_ADMIN', 'page.contract-archives');

DELETE FROM iam_role_resource WHERE resource_key = 'page.contracts';
DELETE FROM iam_resource WHERE resource_key = 'page.contracts';
