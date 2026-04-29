-- 修复 m-to-n 绑定表缺失唯一约束的历史 bug
-- 原因：iam_role_permission / user_role / iam_role_resource 三张表只有自增主键，
--       没有 (role,permission) / (user,role) / (role,resource) 复合唯一约束。
--       seed.sql 里的 ON CONFLICT DO NOTHING 因找不到约束而失效，每跑一次都
--       重复插入一行。生产环境累积出 3-4 倍重复行。
-- 修复：先去重（保留 id 最小的那条），再加唯一约束防止后续累积。
-- 幂等：DELETE 用 NOT IN MIN(id) 子查询，已无重复时是 no-op。

-- 1. 去重 ----------------------------------------------------------------
DELETE FROM "iam_role_permission"
WHERE id NOT IN (SELECT MIN(id) FROM "iam_role_permission" GROUP BY role_code, permission_code);
--> statement-breakpoint
DELETE FROM "user_role"
WHERE id NOT IN (SELECT MIN(id) FROM "user_role" GROUP BY user_id, role_code);
--> statement-breakpoint
DELETE FROM "iam_role_resource"
WHERE id NOT IN (SELECT MIN(id) FROM "iam_role_resource" GROUP BY role_code, resource_key);
--> statement-breakpoint

-- 2. 加唯一约束 ----------------------------------------------------------
ALTER TABLE "iam_role_permission" ADD CONSTRAINT "iam_role_permission_role_code_permission_code_unique" UNIQUE("role_code","permission_code");--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_user_id_role_code_unique" UNIQUE("user_id","role_code");--> statement-breakpoint
ALTER TABLE "iam_role_resource" ADD CONSTRAINT "iam_role_resource_role_code_resource_key_unique" UNIQUE("role_code","resource_key");
