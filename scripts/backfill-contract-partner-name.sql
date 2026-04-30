-- ============================================================================
-- 历史数据修复：合同 partner_name 字段被前端写空串
--
-- 背景：
--   ContractForm.vue 的 el-select 只把 partnerId 绑入表单，partnerName
--   永远是空串，提交后 contract.partner_name 写成 ''。
--   导致 project.service.findById 等不 JOIN partner 表的查询拿到空值，
--   前端 `{{ partnerName || '--' }}` 渲染为 "--"。
--
-- 修复路径：
--   1. 代码侧：contract.service create/update 写库前用 partnerId 反查
--      partner.name 作为权威值（已修复，commit ?）
--   2. 数据侧：本脚本，用 partner 表回填历史 contract.partner_name
--
-- 用法：
--   docker exec -i nature-postgres psql -U nature -d nature \
--     < scripts/backfill-contract-partner-name.sql
--
-- 幂等：WHERE 条件守卫，已正确的数据不会被重复 UPDATE。
-- ============================================================================

BEGIN;

\echo ''
\echo '=== 修复前：合同 partner_name 为空但 partner_id 有值的情况 ==='
SELECT
  c.id,
  c.contract_no,
  c.partner_id,
  c.partner_name AS old_partner_name,
  p.name AS true_partner_name
FROM contract c
JOIN partner p ON p.id = c.partner_id
WHERE c.partner_id IS NOT NULL
  AND (c.partner_name IS NULL OR c.partner_name = '')
ORDER BY c.id;

-- 实际修复
UPDATE contract c
SET partner_name = p.name,
    updated_at = NOW()
FROM partner p
WHERE c.partner_id = p.id
  AND c.partner_id IS NOT NULL
  AND (c.partner_name IS NULL OR c.partner_name = '');

\echo ''
\echo '=== 修复后：还有不一致吗（应该返回 0 行） ==='
SELECT
  c.id,
  c.partner_id,
  c.partner_name,
  p.name AS true_name
FROM contract c
JOIN partner p ON p.id = c.partner_id
WHERE c.partner_id IS NOT NULL
  AND (c.partner_name IS NULL OR c.partner_name = '' OR c.partner_name <> p.name)
ORDER BY c.id;

\echo ''
\echo '=== 总览：合同 partner 字段覆盖率 ==='
SELECT
  COUNT(*) FILTER (WHERE partner_id IS NOT NULL) AS 有合作方ID,
  COUNT(*) FILTER (WHERE partner_id IS NOT NULL AND partner_name IS NOT NULL AND partner_name <> '') AS 名称已正确,
  COUNT(*) FILTER (WHERE partner_id IS NULL AND partner_name = '无') AS 选了无,
  COUNT(*) FILTER (WHERE partner_id IS NULL AND (partner_name IS NULL OR partner_name = '')) AS 既无ID也无名称
FROM contract
WHERE deleted = FALSE;

COMMIT;
