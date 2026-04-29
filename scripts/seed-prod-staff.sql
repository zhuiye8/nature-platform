-- ============================================================================
-- 生产环境初始化人员（51 人）
--
-- 数据来源：
--   - 47 人：客户提供的《人员及角色表.docx》
--   - 4 人：客户口头追加（李青、王晓华、李立扬、李毅民）
--
-- 默认密码：nature@2026  （bcrypt cost=10）
-- 首次登录强制改密：must_change_pwd = TRUE
--
-- 角色映射规则（docx "角色"列 → role_code）:
--   部门经理               → dept_manager
--   项目主管               → project_director
--   项目经理               → project_manager（独立资格，仅授予 13 位）
--   整体技术审核员          → tech_reviewer
--   内容审核（技术/管理/网络） → content_reviewer_tech / mgmt / network
--   公安登记专员            → police_register
--   质量主管                → report_assigner
--   材料核查员 / 档案管理员  → archiver
--   业务员                  → sales
--   商务                    → commercial
--   测评师 + 高级           → senior_assessor
--   测评师 + 中级           → middle_assessor
--   测评师 + 初级           → junior_assessor
--   财务                    → finance
--   董事长                  → chairman
--
-- 前置条件：
--   1. seed.sql 已执行（chairman / project_manager 角色已存在）
--   2. cleanup-prod-data.sql 已执行（生产数据已清空）
--
-- 用法：
--   docker exec -i nature-postgres psql -U nature -d nature \
--     < scripts/seed-prod-staff.sql
--
-- 幂等性：所有 INSERT 使用 ON CONFLICT DO NOTHING，可重复执行。
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. 创建 51 个用户账号
--    密码: nature@2026 / hash: $2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO
-- ============================================================================
INSERT INTO user_account (username, password_hash, display_name, enabled, source_type, must_change_pwd) VALUES
  -- ── 等保部 高级测评师（2）──
  ('xiebaojian',       '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '谢宝建',     TRUE, 'LOCAL', TRUE),
  ('chenyanwen',       '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '陈彦文',     TRUE, 'LOCAL', TRUE),
  -- ── 等保部 中级测评师（14）──
  ('songxiuzhen',      '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '宋秀珍',     TRUE, 'LOCAL', TRUE),
  ('chenxindong',      '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '陈新东',     TRUE, 'LOCAL', TRUE),
  ('yangquansen',      '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '杨泉森',     TRUE, 'LOCAL', TRUE),
  ('wangyinsen',       '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '王寅森',     TRUE, 'LOCAL', TRUE),
  ('wangxiali',        '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '王霞莉',     TRUE, 'LOCAL', TRUE),
  ('zhangyuxuan',      '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '张羽轩',     TRUE, 'LOCAL', TRUE),
  ('zhangcheng',       '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '张成',       TRUE, 'LOCAL', TRUE),
  ('zhangwenjun',      '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '张文君',     TRUE, 'LOCAL', TRUE),
  ('zhangxiang',       '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '张翔',       TRUE, 'LOCAL', TRUE),
  ('tianchengcheng',   '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '田成成',     TRUE, 'LOCAL', TRUE),
  ('tianyue',          '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '田跃',       TRUE, 'LOCAL', TRUE),
  ('chengyingfang',    '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '程婴仿',     TRUE, 'LOCAL', TRUE),
  ('lutao',            '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '鲁涛',       TRUE, 'LOCAL', TRUE),
  ('yanjiawei',        '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '颜佳威',     TRUE, 'LOCAL', TRUE),
  -- ── 等保部 初级测评师（20）──
  ('menghao',          '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '孟浩',       TRUE, 'LOCAL', TRUE),
  ('chawentao',        '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '查文韬',     TRUE, 'LOCAL', TRUE),
  ('hehuaji',          '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '何化吉',     TRUE, 'LOCAL', TRUE),
  ('ouyangbicheng',    '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '欧阳毕成',   TRUE, 'LOCAL', TRUE),
  ('wangxin',          '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '王昕',       TRUE, 'LOCAL', TRUE),
  ('wujiang',          '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '吴江',       TRUE, 'LOCAL', TRUE),
  ('chenjunli',        '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '陈君利',     TRUE, 'LOCAL', TRUE),
  ('guopengfei',       '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '郭鹏飞',     TRUE, 'LOCAL', TRUE),
  ('shuaiheyang',      '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '帅何洋',     TRUE, 'LOCAL', TRUE),
  ('songmouting',      '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '宋牟婷',     TRUE, 'LOCAL', TRUE),
  ('gengyu',           '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '耿宇',       TRUE, 'LOCAL', TRUE),
  ('lixu',             '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '李旭',       TRUE, 'LOCAL', TRUE),
  ('shangwujun',       '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '尚武军',     TRUE, 'LOCAL', TRUE),
  ('hongshuangshuang', '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '洪双双',     TRUE, 'LOCAL', TRUE),
  ('wangli2',          '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '王莉',       TRUE, 'LOCAL', TRUE),
  ('bailongjiang',     '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '柏龙江',     TRUE, 'LOCAL', TRUE),
  ('wuzhenxing',       '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '吴振兴',     TRUE, 'LOCAL', TRUE),
  ('sunbin',           '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '孙斌',       TRUE, 'LOCAL', TRUE),
  ('wujiaxiang',       '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '吴家祥',     TRUE, 'LOCAL', TRUE),
  ('caowei',           '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '曹玮',       TRUE, 'LOCAL', TRUE),
  -- ── 等保部 非测评师（2）──
  ('luyuxin',          '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '卢雨欣',     TRUE, 'LOCAL', TRUE),
  ('tangting',         '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '汤婷',       TRUE, 'LOCAL', TRUE),
  -- ── 市场部（9）──
  ('caihaiyong',       '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '蔡海勇',     TRUE, 'LOCAL', TRUE),
  ('tianyanxin',       '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '田焱鑫',     TRUE, 'LOCAL', TRUE),
  ('hangwei',          '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '杭伟',       TRUE, 'LOCAL', TRUE),
  ('jiangli2',         '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '蒋力',       TRUE, 'LOCAL', TRUE),
  ('yinteng',          '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '殷腾',       TRUE, 'LOCAL', TRUE),
  ('mengzhixin',       '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '孟志新',     TRUE, 'LOCAL', TRUE),
  ('zhuli',            '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '朱俐',       TRUE, 'LOCAL', TRUE),
  ('zhaojianhua',      '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '赵建华',     TRUE, 'LOCAL', TRUE),
  ('zhangyusong',      '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '张喻松',     TRUE, 'LOCAL', TRUE),
  -- ── 客户口头追加：财务（2）──
  ('liqing',           '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '李青',       TRUE, 'LOCAL', TRUE),
  ('wangxiaohua',      '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '王晓华',     TRUE, 'LOCAL', TRUE),
  -- ── 客户口头追加：董事长（2）──
  ('liliyang',         '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '李立扬',     TRUE, 'LOCAL', TRUE),
  ('liyimin',          '$2b$10$0/mzj83VQvZmHqjpA1wmS.ap1PZsGi8pG6bRuV3YbqOUQmJbd4NZO', '李毅民',     TRUE, 'LOCAL', TRUE)
ON CONFLICT (username) DO NOTHING;

-- ============================================================================
-- 2. 角色分配
-- ============================================================================

-- 部门经理（1）
INSERT INTO user_role (user_id, role_code, sort_order)
SELECT id, 'dept_manager', 0 FROM user_account WHERE username IN ('xiebaojian')
ON CONFLICT DO NOTHING;

-- 项目主管（1）
INSERT INTO user_role (user_id, role_code, sort_order)
SELECT id, 'project_director', 0 FROM user_account WHERE username IN ('chenxindong')
ON CONFLICT DO NOTHING;

-- 整体技术审核员（1）
INSERT INTO user_role (user_id, role_code, sort_order)
SELECT id, 'tech_reviewer', 0 FROM user_account WHERE username IN ('chenyanwen')
ON CONFLICT DO NOTHING;

-- 内容审核（技术）（1）
INSERT INTO user_role (user_id, role_code, sort_order)
SELECT id, 'content_reviewer_tech', 0 FROM user_account WHERE username IN ('yangquansen')
ON CONFLICT DO NOTHING;

-- 内容审核（管理）（1）
INSERT INTO user_role (user_id, role_code, sort_order)
SELECT id, 'content_reviewer_mgmt', 0 FROM user_account WHERE username IN ('songxiuzhen')
ON CONFLICT DO NOTHING;

-- 内容审核（网络）（1）
INSERT INTO user_role (user_id, role_code, sort_order)
SELECT id, 'content_reviewer_network', 0 FROM user_account WHERE username IN ('chenyanwen')
ON CONFLICT DO NOTHING;

-- 公安登记专员（1）
INSERT INTO user_role (user_id, role_code, sort_order)
SELECT id, 'police_register', 0 FROM user_account WHERE username IN ('songxiuzhen')
ON CONFLICT DO NOTHING;

-- 报告分配人（"质量主管"映射）（1）
INSERT INTO user_role (user_id, role_code, sort_order)
SELECT id, 'report_assigner', 0 FROM user_account WHERE username IN ('songxiuzhen')
ON CONFLICT DO NOTHING;

-- 报告编制员（按客户口头指定，仅 2 人）
INSERT INTO user_role (user_id, role_code, sort_order)
SELECT id, 'report_writer', 0 FROM user_account WHERE username IN ('lixu', 'luyuxin')
ON CONFLICT DO NOTHING;

-- 归档员（"材料核查员/档案管理员"映射）（5）
INSERT INTO user_role (user_id, role_code, sort_order)
SELECT id, 'archiver', 0 FROM user_account
WHERE username IN ('songxiuzhen', 'gengyu', 'lixu', 'luyuxin', 'tangting')
ON CONFLICT DO NOTHING;

-- 业务员（13）
INSERT INTO user_role (user_id, role_code, sort_order)
SELECT id, 'sales', 0 FROM user_account
WHERE username IN (
  -- 等保部 业务员（5）
  'lixu', 'hongshuangshuang', 'wangli2', 'bailongjiang', 'luyuxin',
  -- 市场部 业务员（8）
  'caihaiyong', 'tianyanxin', 'hangwei', 'jiangli2', 'yinteng',
  'mengzhixin', 'zhuli', 'zhaojianhua'
)
ON CONFLICT DO NOTHING;

-- 商务（1）
INSERT INTO user_role (user_id, role_code, sort_order)
SELECT id, 'commercial', 0 FROM user_account WHERE username IN ('zhangyusong')
ON CONFLICT DO NOTHING;

-- 高级测评师（2）
INSERT INTO user_role (user_id, role_code, sort_order)
SELECT id, 'senior_assessor', 0 FROM user_account
WHERE username IN ('xiebaojian', 'chenyanwen')
ON CONFLICT DO NOTHING;

-- 中级测评师（14）
INSERT INTO user_role (user_id, role_code, sort_order)
SELECT id, 'middle_assessor', 0 FROM user_account
WHERE username IN (
  'songxiuzhen', 'chenxindong', 'yangquansen', 'wangyinsen', 'wangxiali',
  'zhangyuxuan', 'zhangcheng', 'zhangwenjun', 'zhangxiang', 'tianchengcheng',
  'tianyue', 'chengyingfang', 'lutao', 'yanjiawei'
)
ON CONFLICT DO NOTHING;

-- 初级测评师（20）
INSERT INTO user_role (user_id, role_code, sort_order)
SELECT id, 'junior_assessor', 0 FROM user_account
WHERE username IN (
  'menghao', 'chawentao', 'hehuaji', 'ouyangbicheng', 'wangxin',
  'wujiang', 'chenjunli', 'guopengfei', 'shuaiheyang', 'songmouting',
  'gengyu', 'lixu', 'shangwujun', 'hongshuangshuang', 'wangli2',
  'bailongjiang', 'wuzhenxing', 'sunbin', 'wujiaxiang', 'caowei'
)
ON CONFLICT DO NOTHING;

-- 项目经理资格（13）：仅授予 docx 中"角色"列含"项目经理"的人员
-- ⚠ 颜佳威是中级测评师但不是项目经理，故不在此列表
INSERT INTO user_role (user_id, role_code, sort_order)
SELECT id, 'project_manager', 0 FROM user_account
WHERE username IN (
  'chenyanwen',     -- 高级 + PM
  'chenxindong',    -- 中级 + 项目主管 + PM
  'yangquansen', 'wangyinsen', 'wangxiali', 'zhangyuxuan', 'zhangcheng',
  'zhangwenjun', 'zhangxiang', 'tianchengcheng', 'tianyue',
  'chengyingfang', 'lutao'
)
ON CONFLICT DO NOTHING;

-- 财务（2）
INSERT INTO user_role (user_id, role_code, sort_order)
SELECT id, 'finance', 0 FROM user_account WHERE username IN ('liqing', 'wangxiaohua')
ON CONFLICT DO NOTHING;

-- 董事长（2）
INSERT INTO user_role (user_id, role_code, sort_order)
SELECT id, 'chairman', 0 FROM user_account WHERE username IN ('liliyang', 'liyimin')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3. 测评师证书编号（来自历史 migrate-assessor-roles.sql）
-- ============================================================================

-- 高级（2）
UPDATE user_account SET certificate_no = '2500015586031331'  WHERE username = 'chenyanwen';
UPDATE user_account SET certificate_no = '2600016664555X45'  WHERE username = 'xiebaojian';

-- 中级（14）
UPDATE user_account SET certificate_no = '2500010142001624'  WHERE username = 'tianyue';
UPDATE user_account SET certificate_no = '2500010141122326'  WHERE username = 'chengyingfang';
UPDATE user_account SET certificate_no = '2500009845301X25'  WHERE username = 'zhangxiang';
UPDATE user_account SET certificate_no = '2500010352311624'  WHERE username = 'zhangwenjun';
UPDATE user_account SET certificate_no = '2500000964203526'  WHERE username = 'tianchengcheng';
UPDATE user_account SET certificate_no = '2500009959673628'  WHERE username = 'zhangyuxuan';
UPDATE user_account SET certificate_no = '2500010336223926'  WHERE username = 'yanjiawei';
UPDATE user_account SET certificate_no = '2500010351301227'  WHERE username = 'zhangcheng';
UPDATE user_account SET certificate_no = '2500009954732122'  WHERE username = 'wangxiali';
UPDATE user_account SET certificate_no = '2500009955006228'  WHERE username = 'songxiuzhen';
UPDATE user_account SET certificate_no = '2500009957091721'  WHERE username = 'wangyinsen';
UPDATE user_account SET certificate_no = '2500009958673224'  WHERE username = 'chenxindong';
UPDATE user_account SET certificate_no = '2500009956395523'  WHERE username = 'yangquansen';
UPDATE user_account SET certificate_no = '2600016409031924'  WHERE username = 'lutao';

-- 初级（20）
UPDATE user_account SET certificate_no = '2500013256591214'  WHERE username = 'shuaiheyang';   -- 帅何洋（原 师何洋 typo 修正）
UPDATE user_account SET certificate_no = '2500015745002113'  WHERE username = 'gengyu';
UPDATE user_account SET certificate_no = '2500001479502817'  WHERE username = 'songmouting';
UPDATE user_account SET certificate_no = '2600016064551417'  WHERE username = 'menghao';
UPDATE user_account SET certificate_no = '2600016066003418'  WHERE username = 'chawentao';
UPDATE user_account SET certificate_no = '2500012965771914'  WHERE username = 'guopengfei';
UPDATE user_account SET certificate_no = '21522093243310111' WHERE username = 'bailongjiang';
UPDATE user_account SET certificate_no = '2500001162181410'  WHERE username = 'hehuaji';
UPDATE user_account SET certificate_no = '2500001369321719'  WHERE username = 'ouyangbicheng';
UPDATE user_account SET certificate_no = '2500015781731412'  WHERE username = 'wangxin';
UPDATE user_account SET certificate_no = '2500015757281315'  WHERE username = 'wujiang';
UPDATE user_account SET certificate_no = '20462803230580116' WHERE username = 'shangwujun';
UPDATE user_account SET certificate_no = '18013673277210217' WHERE username = 'chenjunli';
UPDATE user_account SET certificate_no = '11003153207470218' WHERE username = 'hongshuangshuang';
UPDATE user_account SET certificate_no = '11001963200230215' WHERE username = 'caowei';
UPDATE user_account SET certificate_no = '11004483242140111' WHERE username = 'wujiaxiang';
UPDATE user_account SET certificate_no = '110045232031X0114' WHERE username = 'wuzhenxing';
UPDATE user_account SET certificate_no = '12010903215110118' WHERE username = 'sunbin';
UPDATE user_account SET certificate_no = '15007943263280219' WHERE username = 'wangli2';
UPDATE user_account SET certificate_no = '2600016065782916'  WHERE username = 'lixu';

-- ============================================================================
-- 4. 验证
-- ============================================================================
DO $$
DECLARE
  v_user_count INT;
  v_role_count INT;
  v_pm_count INT;
  v_assessor_count INT;
  v_chairman_count INT;
  v_finance_count INT;
  v_cert_count INT;
  v_must_change INT;
BEGIN
  SELECT COUNT(*) INTO v_user_count FROM user_account WHERE username != 'admin';
  SELECT COUNT(*) INTO v_role_count FROM user_role WHERE user_id IN (
    SELECT id FROM user_account WHERE username != 'admin'
  );
  SELECT COUNT(*) INTO v_pm_count FROM user_role WHERE role_code = 'project_manager';
  SELECT COUNT(*) INTO v_assessor_count FROM user_role
    WHERE role_code IN ('senior_assessor','middle_assessor','junior_assessor');
  SELECT COUNT(*) INTO v_chairman_count FROM user_role WHERE role_code = 'chairman';
  SELECT COUNT(*) INTO v_finance_count FROM user_role WHERE role_code = 'finance';
  SELECT COUNT(*) INTO v_cert_count FROM user_account
    WHERE username != 'admin' AND certificate_no IS NOT NULL;
  SELECT COUNT(*) INTO v_must_change FROM user_account
    WHERE username != 'admin' AND must_change_pwd = TRUE;

  RAISE NOTICE '=== 生产人员入库完成 ===';
  RAISE NOTICE '总用户数（排除 admin）: %（期望 51）', v_user_count;
  RAISE NOTICE '角色绑定总数: %（期望 82）', v_role_count;
  RAISE NOTICE '项目经理资格人数: %（期望 13）', v_pm_count;
  RAISE NOTICE '测评师人数: %（期望 36 = 2+14+20）', v_assessor_count;
  RAISE NOTICE '董事长人数: %（期望 2）', v_chairman_count;
  RAISE NOTICE '财务人数: %（期望 2）', v_finance_count;
  RAISE NOTICE '已填证书编号: %（期望 36）', v_cert_count;
  RAISE NOTICE '强制改密用户数: %（期望 51）', v_must_change;
END $$;

COMMIT;

-- ============================================================================
-- 一览：用户 → 角色 列表（仅供执行后人工核对）
-- ============================================================================
SELECT ua.username, ua.display_name, ua.certificate_no,
       string_agg(ur.role_code, ', ' ORDER BY ur.role_code) AS roles
FROM user_account ua
LEFT JOIN user_role ur ON ua.id = ur.user_id
WHERE ua.username != 'admin'
GROUP BY ua.id, ua.username, ua.display_name, ua.certificate_no
ORDER BY ua.id;
