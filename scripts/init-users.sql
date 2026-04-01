-- ============================================================================
-- Nature 等保测评平台 — 生产用户初始化脚本
-- 执行方式: docker exec nature-postgres psql -U nature -d nature -f /tmp/init-users.sql
-- 或: docker cp scripts/init-users.sql nature-postgres:/tmp/ && docker exec nature-postgres psql -U nature -d nature -f /tmp/init-users.sql
-- 所有用户密码: 123456
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. 清理旧数据和测试用户（保留 admin）
-- ============================================================================
-- 先清理有外键引用 user_account 的表
DELETE FROM system_notification WHERE receiver_id IN (SELECT id FROM user_account WHERE username NOT IN ('admin'));
DELETE FROM project_member WHERE user_id IN (SELECT id FROM user_account WHERE username NOT IN ('admin'));
DELETE FROM field_change_log WHERE operator_id IN (SELECT id FROM user_account WHERE username NOT IN ('admin'));
-- 清理业务数据（测试数据）
DELETE FROM wf_action_log;
DELETE FROM wf_task;
DELETE FROM wf_instance;
DELETE FROM review_opinion;
DELETE FROM assessment_file;
DELETE FROM compile_report_file;
DELETE FROM on_site_assessment;
DELETE FROM material_archive;
DELETE FROM police_register;
DELETE FROM project_system_item;
DELETE FROM project_register;
DELETE FROM contract_system_item;
DELETE FROM contract_serial;
DELETE FROM contract;
DELETE FROM file_attachment;
-- 清理用户
DELETE FROM user_role WHERE user_id IN (SELECT id FROM user_account WHERE username NOT IN ('admin'));
DELETE FROM user_account WHERE username NOT IN ('admin');

-- ============================================================================
-- 2. 创建生产用户（密码: 123456）
-- ============================================================================
-- bcrypt hash for '123456'
-- $2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK

INSERT INTO user_account (username, display_name, password_hash) VALUES
-- 销售 (15人)
('lutao',          '鲁涛',     '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
('xiebaojian',     '谢宝建',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
('zhangqiao',      '张侨',     '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
('yinteng',        '殷腾',     '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
('jiangli2',       '蒋力',     '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
('wangli2',        '王莉',     '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
('tianyanxin',     '田焱鑫',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
('mengzhixin',     '孟志新',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
('bailongjiang',   '柏龙江',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
('hangwei',        '杭伟',     '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
('songjun',        '宋俊',     '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
('caihaiyong',     '蔡海勇',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
('luyuxin',        '卢雨欣',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
('lixu',           '李旭',     '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
('zhaojianhua',    '赵建华',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
-- 商务 (1人)
('zhangyusong',    '张渝松',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
-- 项目经理+测评师 (19人，不含上面已列的多角色用户)
('chenxindong',    '陈新东',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
('chenyanwen',     '陈彦文',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
('yangquansen',    '杨泉森',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
('songxiuzhen',    '宋秀珍',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
('wangxiali',      '王霞莉',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
('wujiang',        '吴江',     '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
('zhangyuxuan',    '张羽轩',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
('wangxin',        '王昕',     '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
('chenjunli',      '陈君利',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
('tianchengcheng', '田成成',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
('zhangxiang',     '张翔',     '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
('chengyingfang',  '程婴仿',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
('guopengfei',     '郭鹏飞',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
('tianyue',        '田跃',     '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
('gengyu',         '耿宇',     '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
('songmouting',    '宋牟婷',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
('menghao',        '孟浩',     '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
('chawentao',      '查文韬',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
('ouyangbicheng',  '欧阳毕成', '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
-- 纯测评师 (4人)
('zhangcheng',     '张成',     '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
('hehuaji',        '何化吉',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
('gujunlong',      '顾俊龙',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
('zhangwenjun',    '张文君',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
-- 内容审核(技术)
('wangyinsen',     '王寅森',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK'),
-- 归档
('tangting',       '汤婷',     '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK')
ON CONFLICT (username) DO NOTHING;

-- ============================================================================
-- 3. 分配角色
-- ============================================================================

-- 销售
INSERT INTO user_role (user_id, role_code)
SELECT id, 'sales' FROM user_account WHERE username IN (
  'lutao','xiebaojian','zhangqiao','yinteng','jiangli2','wangli2',
  'tianyanxin','mengzhixin','bailongjiang','hangwei','songjun',
  'caihaiyong','luyuxin','lixu','zhaojianhua'
) ON CONFLICT DO NOTHING;

-- 商务
INSERT INTO user_role (user_id, role_code)
SELECT id, 'commercial' FROM user_account WHERE username = 'zhangyusong'
ON CONFLICT DO NOTHING;

-- 项目经理
INSERT INTO user_role (user_id, role_code)
SELECT id, 'project_manager' FROM user_account WHERE username IN (
  'xiebaojian','chenxindong','chenyanwen','yangquansen','songxiuzhen',
  'wangxiali','wujiang','zhangyuxuan','wangxin','chenjunli',
  'tianchengcheng','zhangxiang','chengyingfang','guopengfei','tianyue',
  'gengyu','songmouting','menghao','chawentao','lixu','bailongjiang',
  'ouyangbicheng'
) ON CONFLICT DO NOTHING;

-- 测评师
INSERT INTO user_role (user_id, role_code)
SELECT id, 'assessor' FROM user_account WHERE username IN (
  'xiebaojian','chenxindong','chenyanwen','yangquansen','songxiuzhen',
  'wangxiali','wujiang','zhangyuxuan','wangxin','chenjunli',
  'tianchengcheng','zhangxiang','chengyingfang','guopengfei','tianyue',
  'gengyu','songmouting','menghao','chawentao','lixu','bailongjiang',
  'ouyangbicheng',
  'zhangcheng','hehuaji','gujunlong','zhangwenjun'
) ON CONFLICT DO NOTHING;

-- 部门经理
INSERT INTO user_role (user_id, role_code)
SELECT id, 'dept_manager' FROM user_account WHERE username = 'xiebaojian'
ON CONFLICT DO NOTHING;

-- 公安登记专员
INSERT INTO user_role (user_id, role_code)
SELECT id, 'police_register' FROM user_account WHERE username = 'songxiuzhen'
ON CONFLICT DO NOTHING;

-- 技术审核
INSERT INTO user_role (user_id, role_code)
SELECT id, 'tech_reviewer' FROM user_account WHERE username IN (
  'chenyanwen','chenxindong'
) ON CONFLICT DO NOTHING;

-- 内容审核（技术）CONTENT_A
INSERT INTO user_role (user_id, role_code)
SELECT id, 'content_reviewer_tech' FROM user_account WHERE username IN (
  'wangyinsen','yangquansen'
) ON CONFLICT DO NOTHING;

-- 内容审核（管理）CONTENT_B
INSERT INTO user_role (user_id, role_code)
SELECT id, 'content_reviewer_mgmt' FROM user_account WHERE username IN (
  'songxiuzhen','wangxiali'
) ON CONFLICT DO NOTHING;

-- 内容审核（网络）CONTENT_C
INSERT INTO user_role (user_id, role_code)
SELECT id, 'content_reviewer_network' FROM user_account WHERE username IN (
  'chenyanwen','chenxindong'
) ON CONFLICT DO NOTHING;

-- 报告编制人
INSERT INTO user_role (user_id, role_code)
SELECT id, 'report_writer' FROM user_account WHERE username IN (
  'lixu','luyuxin','songxiuzhen','gengyu'
) ON CONFLICT DO NOTHING;

-- 报告分配人
INSERT INTO user_role (user_id, role_code)
SELECT id, 'report_assigner' FROM user_account WHERE username = 'songxiuzhen'
ON CONFLICT DO NOTHING;

-- 归档员
INSERT INTO user_role (user_id, role_code)
SELECT id, 'archiver' FROM user_account WHERE username IN (
  'tangting','zhangyusong'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. 验证
-- ============================================================================
SELECT ua.username, ua.display_name, string_agg(ur.role_code, ', ' ORDER BY ur.role_code) as roles
FROM user_account ua
LEFT JOIN user_role ur ON ua.id = ur.user_id
GROUP BY ua.id, ua.username, ua.display_name
ORDER BY ua.id;

COMMIT;
