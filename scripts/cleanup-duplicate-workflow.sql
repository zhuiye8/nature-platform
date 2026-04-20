-- ============================================================================
-- 清理 wf_definition 重复数据 + 添加 UNIQUE 约束防止再次重复
-- 原因: seed.sql 中 `ON CONFLICT DO NOTHING` 在没有唯一约束时不生效，
--       多次执行会创建多份 definition。
-- ============================================================================

BEGIN;

-- 1. 保留每个 def_key 的第一份（id 最小的），删除其余
-- 注意: wf_instance 只会引用 id=1 和 id=2，其他 definition 没有实例

-- 先删除重复 definition 的 transition
DELETE FROM wf_transition
WHERE definition_id IN (
  SELECT id FROM wf_definition d
  WHERE id > (SELECT MIN(id) FROM wf_definition WHERE def_key = d.def_key AND version = d.version)
);

-- 删除重复 definition 的 node
DELETE FROM wf_node
WHERE definition_id IN (
  SELECT id FROM wf_definition d
  WHERE id > (SELECT MIN(id) FROM wf_definition WHERE def_key = d.def_key AND version = d.version)
);

-- 删除重复 definition 本身
DELETE FROM wf_definition d
WHERE id > (SELECT MIN(id) FROM wf_definition WHERE def_key = d.def_key AND version = d.version);

-- 2. 添加唯一约束防止以后再重复
ALTER TABLE wf_definition
  DROP CONSTRAINT IF EXISTS wf_definition_def_key_version_key;
ALTER TABLE wf_definition
  ADD CONSTRAINT wf_definition_def_key_version_key UNIQUE (def_key, version);

-- 3. 清理 assignment_rule 和 transition 重复（按 node_key + slot_key + role_code 去重）
DELETE FROM wf_assignment_rule a
WHERE id NOT IN (
  SELECT MIN(id) FROM wf_assignment_rule
  GROUP BY node_key, slot_key, role_code
);

-- transition 去重（按 definition_id + from_node_key + to_node_key + event + COALESCE(guard_expr)）
DELETE FROM wf_transition t
WHERE id NOT IN (
  SELECT MIN(id) FROM wf_transition
  GROUP BY definition_id, from_node_key, to_node_key, event, COALESCE(guard_expr, '__null__')
);

-- node 去重（按 definition_id + node_key）
DELETE FROM wf_node n
WHERE id NOT IN (
  SELECT MIN(id) FROM wf_node
  GROUP BY definition_id, node_key
);

-- 4. 核实结果
DO $$
DECLARE
  def_count INT;
  node_count INT;
  trans_count INT;
  rule_count INT;
BEGIN
  SELECT COUNT(*) INTO def_count FROM wf_definition;
  SELECT COUNT(*) INTO node_count FROM wf_node;
  SELECT COUNT(*) INTO trans_count FROM wf_transition;
  SELECT COUNT(*) INTO rule_count FROM wf_assignment_rule;
  RAISE NOTICE '清理完成: 定义 % 份 / 节点 % 条 / 转换 % 条 / 规则 % 条',
    def_count, node_count, trans_count, rule_count;
END $$;

COMMIT;
