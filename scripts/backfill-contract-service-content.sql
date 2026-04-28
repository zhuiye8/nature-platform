-- ============================================================================
-- 合同 service_content 历史 NULL 数据 backfill
-- ============================================================================
--
-- 背景:
--   ContractForm 已强制 service_content 必填 (rules: required=true)
--   但库里仍有早期遗留的 service_content IS NULL 合同 (DB 直插或老版本创建)
--   这导致合同审核详情页 / 财务详情页等"服务内容"显示为 '--' 而非彩色标签
--
-- 修复:
--   按 contract_no 自动编号前缀推断:
--     YZDZR-DBCP-* → 等级保护测评
--     YZDZR-DBZH-* → 等保（综合）
--     YZDZR-AQZX-* → 安全咨询
--     YZDZR-STCS-* → 渗透测试
--     YZDZR-FXPG-* → 风险评估
--     YZDZR-QT-*   → 其他
--   contract_no 为空且 service_content NULL 的，统一给"等级保护测评"作为兜底
--
-- 幂等性: 带 WHERE service_content IS NULL，重复执行无害
--
-- 执行方式:
--   docker exec -i nature-postgres psql -U nature -d nature \
--     < scripts/backfill-contract-service-content.sql
-- ============================================================================

BEGIN;

\echo '== 当前 service_content IS NULL 的合同数 =='
SELECT COUNT(*) AS null_count FROM contract WHERE deleted = FALSE AND service_content IS NULL;

\echo '== 受影响的合同详情 =='
SELECT id, contract_no, contract_name FROM contract
WHERE deleted = FALSE AND service_content IS NULL
ORDER BY id;

-- 按 contract_no 前缀分类回填
UPDATE contract SET service_content = '等级保护测评', updated_at = NOW()
  WHERE deleted = FALSE AND service_content IS NULL AND contract_no LIKE 'YZDZR-DBCP-%';

UPDATE contract SET service_content = '等保（综合）', updated_at = NOW()
  WHERE deleted = FALSE AND service_content IS NULL AND contract_no LIKE 'YZDZR-DBZH-%';

UPDATE contract SET service_content = '安全咨询', updated_at = NOW()
  WHERE deleted = FALSE AND service_content IS NULL AND contract_no LIKE 'YZDZR-AQZX-%';

UPDATE contract SET service_content = '渗透测试', updated_at = NOW()
  WHERE deleted = FALSE AND service_content IS NULL AND contract_no LIKE 'YZDZR-STCS-%';

UPDATE contract SET service_content = '风险评估', updated_at = NOW()
  WHERE deleted = FALSE AND service_content IS NULL AND contract_no LIKE 'YZDZR-FXPG-%';

-- 兜底：仍为 NULL 的（无 contract_no 或前缀不匹配）→ 等级保护测评
UPDATE contract SET service_content = '等级保护测评', updated_at = NOW()
  WHERE deleted = FALSE AND service_content IS NULL;

\echo '== 回填后剩余 NULL 数（应为 0）=='
SELECT COUNT(*) AS remaining FROM contract WHERE deleted = FALSE AND service_content IS NULL;

\echo '== 回填后 service_content 分布 =='
SELECT service_content, COUNT(*) FROM contract
WHERE deleted = FALSE
GROUP BY service_content
ORDER BY COUNT(*) DESC;

COMMIT;

\echo '== 回填完成 =='
