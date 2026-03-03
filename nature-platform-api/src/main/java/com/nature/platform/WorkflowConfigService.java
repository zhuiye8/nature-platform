/**
 * @input JdbcTemplate workflow-config tables, AdminAuditService logger, and workflow rule/definition DTOs
 * @output Workflow definition and node-rule CRUD APIs with stage-option validation plus role-resolution helper for runtime candidate selection
 * @position Workflow governance service bridging admin configuration to business-node assignment behavior
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class WorkflowConfigService {
  private static final Set<String> ALLOWED_STAGES =
      Set.of("BUSINESS", "REPORT", "SYSTEM");

  private final JdbcTemplate jdbcTemplate;
  private final AdminAuditService adminAuditService;

  public WorkflowConfigService(JdbcTemplate jdbcTemplate, AdminAuditService adminAuditService) {
    this.jdbcTemplate = jdbcTemplate;
    this.adminAuditService = adminAuditService;
  }

  public List<WorkflowDefinitionRecord> listDefinitions() {
    return jdbcTemplate.query(
        """
        SELECT node_key, node_name, node_order, stage, enabled, description
        FROM workflow_definition_registry
        ORDER BY node_order ASC, node_key ASC
        """,
        new WorkflowDefinitionRowMapper());
  }

  public WorkflowDefinitionRecord detailDefinition(String nodeKey) {
    String normalizedNodeKey = normalizeNodeKey(nodeKey);
    List<WorkflowDefinitionRecord> rows =
        jdbcTemplate.query(
            """
            SELECT node_key, node_name, node_order, stage, enabled, description
            FROM workflow_definition_registry
            WHERE node_key = ?
            """,
            new WorkflowDefinitionRowMapper(),
            normalizedNodeKey);
    if (rows.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "workflow definition not found");
    }
    return rows.get(0);
  }

  @Transactional
  public WorkflowDefinitionRecord upsertDefinition(
      String nodeKey, WorkflowDefinitionUpsertRequest request, String operator) {
    String normalizedNodeKey = normalizeNodeKey(nodeKey);
    String nodeName = normalizeRequired(request.getNodeName(), "nodeName is required");
    int nodeOrder = request.getNodeOrder();
    String stage = normalizeStage(request.getStage());
    boolean enabled = request.getEnabled();
    String description = normalizeOptional(request.getDescription());

    Integer count =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(1) FROM workflow_definition_registry WHERE node_key = ?",
            Integer.class,
            normalizedNodeKey);
    if (count != null && count > 0) {
      jdbcTemplate.update(
          """
          UPDATE workflow_definition_registry
          SET node_name = ?, node_order = ?, stage = ?, enabled = ?, description = ?
          WHERE node_key = ?
          """,
          nodeName,
          nodeOrder,
          stage,
          enabled ? 1 : 0,
          description,
          normalizedNodeKey);
    } else {
      jdbcTemplate.update(
          """
          INSERT INTO workflow_definition_registry (node_key, node_name, node_order, stage, enabled, description)
          VALUES (?, ?, ?, ?, ?, ?)
          """,
          normalizedNodeKey,
          nodeName,
          nodeOrder,
          stage,
          enabled ? 1 : 0,
          description);
    }

    adminAuditService.logAction(
        operator,
        "WORKFLOW_DEFINITION_UPSERT",
        "WORKFLOW_DEFINITION",
        normalizedNodeKey,
        Map.of(
            "nodeName", nodeName,
            "nodeOrder", nodeOrder,
            "stage", stage,
            "enabled", enabled));
    return detailDefinition(normalizedNodeKey);
  }

  public List<WorkflowNodeRuleRecord> listNodeRules() {
    List<RuleRow> ruleRows =
        jdbcTemplate.query(
            """
            SELECT id, node_key, rule_name, enabled, updated_by, updated_at
            FROM workflow_node_rule
            ORDER BY node_key ASC
            """,
            new RuleRowMapper());
    if (ruleRows.isEmpty()) {
      return List.of();
    }

    Map<Long, WorkflowNodeRuleRecord> byRuleId = new LinkedHashMap<>();
    for (RuleRow row : ruleRows) {
      WorkflowNodeRuleRecord record = new WorkflowNodeRuleRecord();
      record.setNodeKey(row.nodeKey());
      record.setRuleName(row.ruleName());
      record.setEnabled(row.enabled());
      record.setUpdatedBy(row.updatedBy());
      record.setUpdatedAt(row.updatedAt());
      byRuleId.put(row.id(), record);
    }

    List<Long> ruleIds = new ArrayList<>(byRuleId.keySet());
    String placeholders = String.join(",", Collections.nCopies(ruleIds.size(), "?"));
    String itemSql =
        """
        SELECT rule_id, slot_key, slot_label, role_code, required_flag
        FROM workflow_node_rule_item
        WHERE rule_id IN (%s)
        ORDER BY rule_id ASC, id ASC
        """
            .formatted(placeholders);

    List<RuleItemRow> itemRows =
        jdbcTemplate.query(itemSql, new RuleItemRowMapper(), ruleIds.toArray());
    for (RuleItemRow row : itemRows) {
      WorkflowNodeRuleRecord record = byRuleId.get(row.ruleId());
      if (record == null) {
        continue;
      }
      WorkflowNodeRuleItemRecord item = new WorkflowNodeRuleItemRecord();
      item.setSlotKey(row.slotKey());
      item.setSlotLabel(row.slotLabel());
      item.setRoleCode(row.roleCode());
      item.setRequiredFlag(row.requiredFlag());
      record.getItems().add(item);
    }

    return new ArrayList<>(byRuleId.values());
  }

  public WorkflowNodeRuleRecord detailNodeRule(String nodeKey) {
    String normalizedNodeKey = normalizeNodeKey(nodeKey);
    List<RuleRow> rows =
        jdbcTemplate.query(
            """
            SELECT id, node_key, rule_name, enabled, updated_by, updated_at
            FROM workflow_node_rule
            WHERE node_key = ?
            """,
            new RuleRowMapper(),
            normalizedNodeKey);
    if (rows.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "workflow node rule not found");
    }

    RuleRow row = rows.get(0);
    WorkflowNodeRuleRecord record = new WorkflowNodeRuleRecord();
    record.setNodeKey(row.nodeKey());
    record.setRuleName(row.ruleName());
    record.setEnabled(row.enabled());
    record.setUpdatedBy(row.updatedBy());
    record.setUpdatedAt(row.updatedAt());
    record.setItems(
        jdbcTemplate.query(
            """
            SELECT slot_key, slot_label, role_code, required_flag
            FROM workflow_node_rule_item
            WHERE rule_id = ?
            ORDER BY id ASC
            """,
            (rs, rowNum) -> {
              WorkflowNodeRuleItemRecord item = new WorkflowNodeRuleItemRecord();
              item.setSlotKey(rs.getString("slot_key"));
              item.setSlotLabel(rs.getString("slot_label"));
              item.setRoleCode(rs.getString("role_code"));
              item.setRequiredFlag(rs.getBoolean("required_flag"));
              return item;
            },
            row.id()));
    return record;
  }

  @Transactional
  public WorkflowNodeRuleRecord upsertNodeRule(
      String nodeKey, WorkflowNodeRuleUpsertRequest request, String operator) {
    String normalizedNodeKey = normalizeNodeKey(nodeKey);
    String ruleName = normalizeRequired(request.getRuleName(), "ruleName is required");
    boolean enabled = request.getEnabled();
    List<WorkflowNodeRuleItemRequest> items = normalizeRuleItems(request.getItems());
    ensureRuleItemRoleCodesExist(items);

    List<Long> existingIds =
        jdbcTemplate.query(
            "SELECT id FROM workflow_node_rule WHERE node_key = ?",
            (rs, rowNum) -> rs.getLong("id"),
            normalizedNodeKey);

    long ruleId;
    if (existingIds.isEmpty()) {
      jdbcTemplate.update(
          """
          INSERT INTO workflow_node_rule (node_key, rule_name, enabled, updated_by)
          VALUES (?, ?, ?, ?)
          """,
          normalizedNodeKey,
          ruleName,
          enabled ? 1 : 0,
          operator);
      Long generatedId = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
      ruleId = generatedId == null ? 0L : generatedId;
    } else {
      ruleId = existingIds.get(0);
      jdbcTemplate.update(
          """
          UPDATE workflow_node_rule
          SET rule_name = ?, enabled = ?, updated_by = ?
          WHERE id = ?
          """,
          ruleName,
          enabled ? 1 : 0,
          operator,
          ruleId);
      jdbcTemplate.update("DELETE FROM workflow_node_rule_item WHERE rule_id = ?", ruleId);
    }

    for (WorkflowNodeRuleItemRequest item : items) {
      jdbcTemplate.update(
          """
          INSERT INTO workflow_node_rule_item (
            rule_id, slot_key, slot_label, role_code, required_flag
          ) VALUES (?, ?, ?, ?, ?)
          """,
          ruleId,
          item.getSlotKey(),
          item.getSlotLabel(),
          item.getRoleCode(),
          item.getRequiredFlag() ? 1 : 0);
    }

    adminAuditService.logAction(
        operator,
        "WORKFLOW_NODE_RULE_UPSERT",
        "WORKFLOW_NODE_RULE",
        normalizedNodeKey,
        Map.of(
            "ruleName", ruleName,
            "enabled", enabled,
            "itemCount", items.size()));
    return detailNodeRule(normalizedNodeKey);
  }

  public List<String> listEnabledRoleCodes() {
    return jdbcTemplate.queryForList(
        """
        SELECT role_code
        FROM iam_role
        WHERE enabled = 1
        ORDER BY role_code ASC
        """,
        String.class);
  }

  public List<String> listRoleCodesBySlot(
      String nodeKey, String slotKey, List<String> fallbackRoleCodes) {
    String normalizedNodeKey = normalizeNodeKey(nodeKey);
    String normalizedSlotKey = normalizeRequired(slotKey, "slotKey is required").toUpperCase(Locale.ROOT);

    List<String> configured =
        jdbcTemplate.queryForList(
            """
            SELECT i.role_code
            FROM workflow_node_rule r
            JOIN workflow_node_rule_item i ON i.rule_id = r.id
            WHERE r.node_key = ?
              AND r.enabled = 1
              AND i.slot_key = ?
            ORDER BY i.id ASC
            """,
            String.class,
            normalizedNodeKey,
            normalizedSlotKey);

    if (!configured.isEmpty()) {
      return new ArrayList<>(new LinkedHashSet<>(configured));
    }

    LinkedHashSet<String> fallback = new LinkedHashSet<>();
    if (fallbackRoleCodes != null) {
      for (String roleCode : fallbackRoleCodes) {
        if (roleCode != null && !roleCode.isBlank()) {
          fallback.add(roleCode.trim().toUpperCase(Locale.ROOT));
        }
      }
    }
    return new ArrayList<>(fallback);
  }

  private void ensureRuleItemRoleCodesExist(List<WorkflowNodeRuleItemRequest> items) {
    if (items.isEmpty()) {
      return;
    }
    List<String> roleCodes =
        new ArrayList<>(
            items.stream()
                .map(WorkflowNodeRuleItemRequest::getRoleCode)
                .filter(item -> item != null && !item.isBlank())
                .map(item -> item.trim().toUpperCase(Locale.ROOT))
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new)));
    String placeholders = String.join(",", Collections.nCopies(roleCodes.size(), "?"));
    String sql = "SELECT role_code FROM iam_role WHERE role_code IN (%s)".formatted(placeholders);
    Set<String> existing = new LinkedHashSet<>(jdbcTemplate.queryForList(sql, String.class, roleCodes.toArray()));
    List<String> missing = roleCodes.stream().filter(code -> !existing.contains(code)).toList();
    if (!missing.isEmpty()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "unknown role codes in rule items: " + String.join(",", missing));
    }
  }

  private List<WorkflowNodeRuleItemRequest> normalizeRuleItems(List<WorkflowNodeRuleItemRequest> rawItems) {
    if (rawItems == null || rawItems.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "at least one rule item is required");
    }

    List<WorkflowNodeRuleItemRequest> normalized = new ArrayList<>();
    for (WorkflowNodeRuleItemRequest raw : rawItems) {
      WorkflowNodeRuleItemRequest item = new WorkflowNodeRuleItemRequest();
      item.setSlotKey(normalizeRequired(raw.getSlotKey(), "slotKey is required").toUpperCase(Locale.ROOT));
      item.setSlotLabel(normalizeRequired(raw.getSlotLabel(), "slotLabel is required"));
      item.setRoleCode(normalizeRequired(raw.getRoleCode(), "roleCode is required").toUpperCase(Locale.ROOT));
      item.setRequiredFlag(raw.getRequiredFlag() == null || raw.getRequiredFlag());
      normalized.add(item);
    }

    normalized.sort(
        java.util.Comparator.comparing(WorkflowNodeRuleItemRequest::getSlotKey)
            .thenComparing(WorkflowNodeRuleItemRequest::getRoleCode));
    return normalized;
  }

  private String normalizeNodeKey(String rawNodeKey) {
    String normalized = normalizeRequired(rawNodeKey, "nodeKey is required").toUpperCase(Locale.ROOT);
    if (!normalized.matches("^[A-Z0-9_]{3,64}$")) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "nodeKey must match [A-Z0-9_]{3,64}");
    }
    return normalized;
  }

  private String normalizeRequired(String raw, String message) {
    if (raw == null || raw.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
    return raw.trim();
  }

  private String normalizeOptional(String raw) {
    if (raw == null || raw.isBlank()) {
      return null;
    }
    return raw.trim();
  }

  private String normalizeStage(String rawStage) {
    String stage = normalizeRequired(rawStage, "stage is required").toUpperCase(Locale.ROOT);
    if (!ALLOWED_STAGES.contains(stage)) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "stage must be one of BUSINESS/REPORT/SYSTEM");
    }
    return stage;
  }

  private static class WorkflowDefinitionRowMapper implements RowMapper<WorkflowDefinitionRecord> {
    @Override
    public WorkflowDefinitionRecord mapRow(ResultSet rs, int rowNum) throws SQLException {
      WorkflowDefinitionRecord record = new WorkflowDefinitionRecord();
      record.setNodeKey(rs.getString("node_key"));
      record.setNodeName(rs.getString("node_name"));
      record.setNodeOrder(rs.getInt("node_order"));
      record.setStage(rs.getString("stage"));
      record.setEnabled(rs.getBoolean("enabled"));
      record.setDescription(rs.getString("description"));
      return record;
    }
  }

  private static class RuleRowMapper implements RowMapper<RuleRow> {
    @Override
    public RuleRow mapRow(ResultSet rs, int rowNum) throws SQLException {
      return new RuleRow(
          rs.getLong("id"),
          rs.getString("node_key"),
          rs.getString("rule_name"),
          rs.getBoolean("enabled"),
          rs.getString("updated_by"),
          String.valueOf(rs.getTimestamp("updated_at")));
    }
  }

  private static class RuleItemRowMapper implements RowMapper<RuleItemRow> {
    @Override
    public RuleItemRow mapRow(ResultSet rs, int rowNum) throws SQLException {
      return new RuleItemRow(
          rs.getLong("rule_id"),
          rs.getString("slot_key"),
          rs.getString("slot_label"),
          rs.getString("role_code"),
          rs.getBoolean("required_flag"));
    }
  }

  private record RuleRow(
      long id, String nodeKey, String ruleName, boolean enabled, String updatedBy, String updatedAt) {}

  private record RuleItemRow(
      long ruleId,
      String slotKey,
      String slotLabel,
      String roleCode,
      boolean requiredFlag) {}
}
