-- ============================================================================
-- 一次性脚本：批量创建 42 名员工账号
-- 默认密码: 123456 | must_change_pwd = true（首次登录强制改密码+填手机号）
-- 用法: docker exec -i nature-postgres psql -U nature -d nature < scripts/init-employees.sql
-- ============================================================================

BEGIN;

-- bcrypt hash for '123456'
-- $2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK

INSERT INTO user_account (username, display_name, password_hash, must_change_pwd) VALUES
('lutao',          '鲁涛',     '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('xiebaojian',     '谢宝建',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('zhangqiao',      '张侨',     '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('yinteng',        '殷腾',     '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('jiangli2',       '蒋力',     '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('wangli2',        '王莉',     '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('tianyanxin',     '田焱鑫',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('mengzhixin',     '孟志新',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('bailongjiang',   '柏龙江',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('hangwei',        '杭伟',     '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('songjun',        '宋俊',     '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('caihaiyong',     '蔡海勇',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('luyuxin',        '卢雨欣',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('lixu',           '李旭',     '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('zhaojianhua',    '赵建华',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('zhangyusong',    '张渝松',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('chenxindong',    '陈新东',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('chenyanwen',     '陈彦文',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('yangquansen',    '杨泉森',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('songxiuzhen',    '宋秀珍',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('wangxiali',      '王霞莉',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('wujiang',        '吴江',     '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('zhangyuxuan',    '张羽轩',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('wangxin',        '王昕',     '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('chenjunli',      '陈君利',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('tianchengcheng', '田成成',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('zhangxiang',     '张翔',     '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('chengyingfang',  '程婴仿',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('guopengfei',     '郭鹏飞',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('tianyue',        '田跃',     '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('gengyu',         '耿宇',     '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('songmouting',    '宋牟婷',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('menghao',        '孟浩',     '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('chawentao',      '查文韬',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('ouyangbicheng',  '欧阳毕成', '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('zhangcheng',     '张成',     '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('hehuaji',        '何化吉',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('gujunlong',      '顾俊龙',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('zhangwenjun',    '张文君',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('wangyinsen',     '王寅森',   '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('tangting',       '汤婷',     '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE),
('liqing',         '李青',     '$2b$10$bfA8DdYeQOzg2nYBokw8quvtAW.7h6IMWPAbCp4uxIvogloEzuuyK', TRUE)
ON CONFLICT (username) DO NOTHING;

-- 角色分配
INSERT INTO user_role (user_id, role_code) SELECT id, 'sales' FROM user_account WHERE username IN ('lutao','xiebaojian','zhangqiao','yinteng','jiangli2','wangli2','tianyanxin','mengzhixin','bailongjiang','hangwei','songjun','caihaiyong','luyuxin','lixu','zhaojianhua') ON CONFLICT DO NOTHING;
INSERT INTO user_role (user_id, role_code) SELECT id, 'commercial' FROM user_account WHERE username = 'zhangyusong' ON CONFLICT DO NOTHING;
INSERT INTO user_role (user_id, role_code) SELECT id, 'project_manager' FROM user_account WHERE username IN ('xiebaojian','chenxindong','chenyanwen','yangquansen','songxiuzhen','wangxiali','wujiang','zhangyuxuan','wangxin','chenjunli','tianchengcheng','zhangxiang','chengyingfang','guopengfei','tianyue','gengyu','songmouting','menghao','chawentao','lixu','bailongjiang','ouyangbicheng') ON CONFLICT DO NOTHING;
INSERT INTO user_role (user_id, role_code) SELECT id, 'assessor' FROM user_account WHERE username IN ('xiebaojian','chenxindong','chenyanwen','yangquansen','songxiuzhen','wangxiali','wujiang','zhangyuxuan','wangxin','chenjunli','tianchengcheng','zhangxiang','chengyingfang','guopengfei','tianyue','gengyu','songmouting','menghao','chawentao','lixu','bailongjiang','ouyangbicheng','zhangcheng','hehuaji','gujunlong','zhangwenjun') ON CONFLICT DO NOTHING;
INSERT INTO user_role (user_id, role_code) SELECT id, 'dept_manager' FROM user_account WHERE username = 'xiebaojian' ON CONFLICT DO NOTHING;
INSERT INTO user_role (user_id, role_code) SELECT id, 'project_director' FROM user_account WHERE username = 'chenyanwen' ON CONFLICT DO NOTHING;
INSERT INTO user_role (user_id, role_code) SELECT id, 'police_register' FROM user_account WHERE username = 'songxiuzhen' ON CONFLICT DO NOTHING;
INSERT INTO user_role (user_id, role_code) SELECT id, 'tech_reviewer' FROM user_account WHERE username IN ('chenyanwen','chenxindong') ON CONFLICT DO NOTHING;
INSERT INTO user_role (user_id, role_code) SELECT id, 'content_reviewer_tech' FROM user_account WHERE username IN ('wangyinsen','yangquansen') ON CONFLICT DO NOTHING;
INSERT INTO user_role (user_id, role_code) SELECT id, 'content_reviewer_mgmt' FROM user_account WHERE username IN ('songxiuzhen','wangxiali') ON CONFLICT DO NOTHING;
INSERT INTO user_role (user_id, role_code) SELECT id, 'content_reviewer_network' FROM user_account WHERE username IN ('chenyanwen','chenxindong') ON CONFLICT DO NOTHING;
INSERT INTO user_role (user_id, role_code) SELECT id, 'report_writer' FROM user_account WHERE username IN ('lixu','luyuxin','songxiuzhen','gengyu') ON CONFLICT DO NOTHING;
INSERT INTO user_role (user_id, role_code) SELECT id, 'report_assigner' FROM user_account WHERE username = 'songxiuzhen' ON CONFLICT DO NOTHING;
INSERT INTO user_role (user_id, role_code) SELECT id, 'archiver' FROM user_account WHERE username IN ('tangting','zhangyusong') ON CONFLICT DO NOTHING;
INSERT INTO user_role (user_id, role_code) SELECT id, 'finance' FROM user_account WHERE username = 'liqing' ON CONFLICT DO NOTHING;

-- 验证
SELECT ua.username, ua.display_name, ua.must_change_pwd,
       string_agg(ur.role_code, ', ' ORDER BY ur.role_code) as roles
FROM user_account ua
LEFT JOIN user_role ur ON ua.id = ur.user_id
WHERE ua.username != 'admin'
GROUP BY ua.id, ua.username, ua.display_name, ua.must_change_pwd
ORDER BY ua.id;

COMMIT;
