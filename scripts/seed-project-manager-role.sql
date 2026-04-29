-- ============================================================================
-- 增量种子：project_manager（项目经理）角色
--
-- 背景：
--   原系统将 PM 资格隐式绑定到"中/高级测评师"等级，
--   但实际业务中存在"中级测评师但不能担任 PM"的情况（如颜佳威）。
--   因此把 PM 资格独立成一个角色，由项目主管显式授予。
--
-- 作用：
--   1. 在 iam_role 中插入 project_manager 角色（幂等）
--   2. 为 13 位获得 PM 资格的人员追加 user_role 记录（幂等）
--
-- 权限/菜单设计：
--   project_manager 是"资格标志"角色，不附带任何权限/资源。
--   持有者一定同时持有某等级测评师角色，菜单由测评师角色提供。
--   后端在 DIRECTOR_REVIEW 节点指派 PM 时，对候选池做交集过滤：
--     senior/middle_assessor ∩ project_manager
--
-- 用法：
--   docker exec -i nature-postgres psql -U nature -d nature \
--     < scripts/seed-project-manager-role.sql
--
-- 幂等性：所有 INSERT 使用 ON CONFLICT DO NOTHING，可重复执行。
-- ============================================================================

BEGIN;

-- 1. 角色定义
INSERT INTO iam_role (role_code, role_name, description, enabled, system_flag) VALUES
    ('project_manager', '项目经理', '可被项目主管指派为项目经理（与测评师等级独立授权）', TRUE, TRUE)
ON CONFLICT (role_code) DO NOTHING;

-- 2. 给 13 位人员授予 PM 资格（基于 docx 名单中"项目经理"角色标记）
--    名单来源：人员及角色表.docx 中"角色"列含"项目经理"的所有人
--    PM 资格不会自动给"测评师"（如颜佳威），由项目主管根据实际业务能力授予
INSERT INTO user_role (user_id, role_code, sort_order)
SELECT id, 'project_manager', 0 FROM user_account
WHERE username IN (
  'chenyanwen',       -- 陈彦文（高级，部门经理同时是 PM）
  'chenxindong',      -- 陈新东（中级，项目主管同时是 PM）
  'yangquansen',      -- 杨泉森（中级）
  'wangyinsen',       -- 王寅森（中级）
  'wangxiali',        -- 王霞莉（中级）
  'zhangyuxuan',      -- 张羽轩（中级）
  'zhangcheng',       -- 张成（中级）
  'zhangwenjun',      -- 张文君（中级）
  'zhangxiang',       -- 张翔（中级）
  'tianchengcheng',   -- 田成成（中级）
  'tianyue',          -- 田跃（中级）
  'chengyingfang',    -- 程婴仿（中级）
  'lutao'             -- 鲁涛（中级）
)
ON CONFLICT DO NOTHING;

-- 3. 验证
DO $$
DECLARE
  pm_count INT;
BEGIN
  SELECT COUNT(*) INTO pm_count FROM user_role WHERE role_code = 'project_manager';
  RAISE NOTICE 'project_manager 角色当前已分配人数: % (期望 13)', pm_count;
END $$;

COMMIT;
