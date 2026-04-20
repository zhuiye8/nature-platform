-- ============================================================================
-- 测评师角色迁移脚本 (一次性，开发/测试环境)
--
-- 作用:
--   1. 清理旧的 assessor / project_manager 角色分配
--   2. 清理 project_member 测试数据
--   3. 清理运行中的项目工作流（避免老流程混入）
--   4. 把非终态项目改回草稿
--   5. 新建 9 个测评师人员账号（密码 Nature@2026 + 强制改密）
--   6. 为 37 位测评师批量分配新角色（senior/middle/junior_assessor）
--
-- 用法:
--   psql $DATABASE_URL -f scripts/migrate-assessor-roles.sql
--
-- 前置条件:
--   - seed.sql 已执行（确保 senior/middle/junior_assessor 角色存在）
-- ============================================================================

BEGIN;

-- ============================================================================
-- Part 1: 清理旧数据
-- ============================================================================

-- 清理项目成员指派（测试数据）
DELETE FROM project_member;

-- 清理旧角色分配
DELETE FROM user_role WHERE role_code IN ('assessor', 'project_manager');

-- 清理旧角色权限映射
DELETE FROM iam_role_permission WHERE role_code IN ('assessor', 'project_manager');

-- 清理旧角色资源映射
DELETE FROM iam_role_resource WHERE role_code IN ('assessor', 'project_manager');

-- 清理旧角色定义
DELETE FROM iam_role WHERE role_code IN ('assessor', 'project_manager');

-- 清理正在运行的项目工作流
DELETE FROM wf_task WHERE instance_id IN (
  SELECT id FROM wf_instance WHERE biz_type='PROJECT_REGISTER' AND status='RUNNING');
DELETE FROM wf_action_log WHERE instance_id IN (
  SELECT id FROM wf_instance WHERE biz_type='PROJECT_REGISTER' AND status='RUNNING');
DELETE FROM wf_instance WHERE biz_type='PROJECT_REGISTER' AND status='RUNNING';

-- 清理旧的 PROJECT_REVIEW 节点相关数据（重命名为 DIRECTOR_REVIEW）
DELETE FROM wf_assignment_rule WHERE node_key = 'PROJECT_REVIEW';
DELETE FROM wf_transition WHERE from_node_key = 'PROJECT_REVIEW' OR to_node_key = 'PROJECT_REVIEW';
DELETE FROM wf_node WHERE node_key = 'PROJECT_REVIEW';

-- 把非终态项目改回草稿，以便提交后走新流程
UPDATE project_register SET status = 'DRAFT' WHERE status NOT IN ('DRAFT', 'REJECTED');

-- ============================================================================
-- Part 2: 新建 9 个缺失的测评师账号
-- 密码: Nature@2026 (bcrypt hash 已生成)
-- mustChangePwd: TRUE (首次登录强制改密)
-- ============================================================================

INSERT INTO user_account (username, password_hash, display_name, enabled, source_type, must_change_pwd)
VALUES
  -- 中级
  ('yanjiawei',         '$2b$10$f4uNVwKzbGPrw/i2EUh.zuUFyqRMjU3JYZChni0OUxnLhB15eBAC2', '颜佳威', TRUE, 'LOCAL', TRUE),
  -- 初级
  ('shiheyang',         '$2b$10$f4uNVwKzbGPrw/i2EUh.zuUFyqRMjU3JYZChni0OUxnLhB15eBAC2', '师何洋', TRUE, 'LOCAL', TRUE),
  ('liliyang',          '$2b$10$f4uNVwKzbGPrw/i2EUh.zuUFyqRMjU3JYZChni0OUxnLhB15eBAC2', '李立扬', TRUE, 'LOCAL', TRUE),
  ('shangwujun',        '$2b$10$f4uNVwKzbGPrw/i2EUh.zuUFyqRMjU3JYZChni0OUxnLhB15eBAC2', '尚武军', TRUE, 'LOCAL', TRUE),
  ('hongshuangshuang',  '$2b$10$f4uNVwKzbGPrw/i2EUh.zuUFyqRMjU3JYZChni0OUxnLhB15eBAC2', '洪双双', TRUE, 'LOCAL', TRUE),
  ('caowei',            '$2b$10$f4uNVwKzbGPrw/i2EUh.zuUFyqRMjU3JYZChni0OUxnLhB15eBAC2', '曹玮',   TRUE, 'LOCAL', TRUE),
  ('wujiaxiang',        '$2b$10$f4uNVwKzbGPrw/i2EUh.zuUFyqRMjU3JYZChni0OUxnLhB15eBAC2', '吴家祥', TRUE, 'LOCAL', TRUE),
  ('wuzhenxing',        '$2b$10$f4uNVwKzbGPrw/i2EUh.zuUFyqRMjU3JYZChni0OUxnLhB15eBAC2', '吴振兴', TRUE, 'LOCAL', TRUE),
  ('sunbin',            '$2b$10$f4uNVwKzbGPrw/i2EUh.zuUFyqRMjU3JYZChni0OUxnLhB15eBAC2', '孙斌',   TRUE, 'LOCAL', TRUE)
ON CONFLICT (username) DO NOTHING;

-- ============================================================================
-- Part 3: 补齐证书编号（按名单填入）
-- ============================================================================

UPDATE user_account SET certificate_no = '2500015586031331' WHERE username = 'chenyanwen';         -- 陈彦文 高级
UPDATE user_account SET certificate_no = '2600016664555X45' WHERE username = 'xiebaojian';          -- 谢宝建 高级
UPDATE user_account SET certificate_no = '2500010142001624' WHERE username = 'tianyue';             -- 田跃   中级
UPDATE user_account SET certificate_no = '2500010141122326' WHERE username = 'chengyingfang';       -- 程婴仿 中级
UPDATE user_account SET certificate_no = '2500009845301X25' WHERE username = 'zhangxiang';          -- 张翔   中级
UPDATE user_account SET certificate_no = '2500010352311624' WHERE username = 'zhangwenjun';         -- 张文君 中级
UPDATE user_account SET certificate_no = '2500000964203526' WHERE username = 'tianchengcheng';      -- 田成成 中级
UPDATE user_account SET certificate_no = '2500009959673628' WHERE username = 'zhangyuxuan';         -- 张羽轩 中级
UPDATE user_account SET certificate_no = '2500010336223926' WHERE username = 'yanjiawei';           -- 颜佳威 中级
UPDATE user_account SET certificate_no = '2500010351301227' WHERE username = 'zhangcheng';          -- 张成   中级
UPDATE user_account SET certificate_no = '2500009954732122' WHERE username = 'wangxiali';           -- 王霞莉 中级
UPDATE user_account SET certificate_no = '2500009955006228' WHERE username = 'songxiuzhen';         -- 宋秀珍 中级
UPDATE user_account SET certificate_no = '2500009957091721' WHERE username = 'wangyinsen';          -- 王寅森 中级
UPDATE user_account SET certificate_no = '2500009958673224' WHERE username = 'chenxindong';         -- 陈新东 中级
UPDATE user_account SET certificate_no = '2500009956395523' WHERE username = 'yangquansen';         -- 杨泉森 中级
UPDATE user_account SET certificate_no = '2600016409031924' WHERE username = 'lutao';               -- 鲁涛   中级
UPDATE user_account SET certificate_no = '2500013256591214' WHERE username = 'shiheyang';           -- 师何洋 初级
UPDATE user_account SET certificate_no = '2500015745002113' WHERE username = 'gengyu';              -- 耿宇   初级
UPDATE user_account SET certificate_no = '2500001479502817' WHERE username = 'songmouting';         -- 宋牟婷 初级
UPDATE user_account SET certificate_no = '2600016064551417' WHERE username = 'menghao';             -- 孟浩   初级
UPDATE user_account SET certificate_no = '2600016066003418' WHERE username = 'chawentao';           -- 查文韬 初级
UPDATE user_account SET certificate_no = '2500012965771914' WHERE username = 'guopengfei';          -- 郭鹏飞 初级
UPDATE user_account SET certificate_no = '21522093243310111' WHERE username = 'bailongjiang';       -- 柏龙江 初级
UPDATE user_account SET certificate_no = '2500001162181410' WHERE username = 'hehuaji';             -- 何化吉 初级
UPDATE user_account SET certificate_no = '2500001369321719' WHERE username = 'ouyangbicheng';       -- 欧阳毕成 初级
UPDATE user_account SET certificate_no = '2500015781731412' WHERE username = 'wangxin';             -- 王昕   初级
UPDATE user_account SET certificate_no = '20135653212520110' WHERE username = 'liliyang';           -- 李立扬 初级
UPDATE user_account SET certificate_no = '2500015757281315' WHERE username = 'wujiang';             -- 吴江   初级
UPDATE user_account SET certificate_no = '20462803230580116' WHERE username = 'shangwujun';         -- 尚武军 初级
UPDATE user_account SET certificate_no = '18013673277210217' WHERE username = 'chenjunli';          -- 陈君利 初级
UPDATE user_account SET certificate_no = '11003153207470218' WHERE username = 'hongshuangshuang';   -- 洪双双 初级
UPDATE user_account SET certificate_no = '11001963200230215' WHERE username = 'caowei';             -- 曹玮   初级
UPDATE user_account SET certificate_no = '11004483242140111' WHERE username = 'wujiaxiang';         -- 吴家祥 初级
UPDATE user_account SET certificate_no = '110045232031X0114' WHERE username = 'wuzhenxing';         -- 吴振兴 初级
UPDATE user_account SET certificate_no = '12010903215110118' WHERE username = 'sunbin';             -- 孙斌   初级
UPDATE user_account SET certificate_no = '15007943263280219' WHERE username = 'wangli2';            -- 王莉   初级
UPDATE user_account SET certificate_no = '2600016065782916' WHERE username = 'lixu';                -- 李旭   初级

-- ============================================================================
-- Part 4: 为 37 位测评师批量分配新角色
-- ============================================================================

-- 高级测评师 (2)
INSERT INTO user_role (user_id, role_code, sort_order)
SELECT id, 'senior_assessor', 0 FROM user_account
WHERE username IN ('chenyanwen', 'xiebaojian')
ON CONFLICT DO NOTHING;

-- 中级测评师 (14)
INSERT INTO user_role (user_id, role_code, sort_order)
SELECT id, 'middle_assessor', 0 FROM user_account
WHERE username IN (
  'tianyue', 'chengyingfang', 'zhangxiang', 'zhangwenjun', 'tianchengcheng',
  'zhangyuxuan', 'yanjiawei', 'zhangcheng', 'wangxiali', 'songxiuzhen',
  'wangyinsen', 'chenxindong', 'yangquansen', 'lutao'
)
ON CONFLICT DO NOTHING;

-- 初级测评师 (21)
INSERT INTO user_role (user_id, role_code, sort_order)
SELECT id, 'junior_assessor', 0 FROM user_account
WHERE username IN (
  'shiheyang', 'gengyu', 'songmouting', 'menghao', 'chawentao',
  'guopengfei', 'bailongjiang', 'hehuaji', 'ouyangbicheng', 'wangxin',
  'liliyang', 'wujiang', 'shangwujun', 'chenjunli', 'hongshuangshuang',
  'caowei', 'wujiaxiang', 'wuzhenxing', 'sunbin', 'wangli2', 'lixu'
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 执行完成检查
-- ============================================================================

DO $$
DECLARE
  senior_count INT;
  middle_count INT;
  junior_count INT;
BEGIN
  SELECT COUNT(*) INTO senior_count FROM user_role WHERE role_code = 'senior_assessor';
  SELECT COUNT(*) INTO middle_count FROM user_role WHERE role_code = 'middle_assessor';
  SELECT COUNT(*) INTO junior_count FROM user_role WHERE role_code = 'junior_assessor';
  RAISE NOTICE '迁移完成: 高级测评师 % 人 / 中级测评师 % 人 / 初级测评师 % 人',
    senior_count, middle_count, junior_count;
END $$;

COMMIT;
