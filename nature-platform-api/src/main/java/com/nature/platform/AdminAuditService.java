/**
 * @input JdbcTemplate admin_audit_log persistence and JsonSupport serialization helper
 * @output Admin audit write/read operations for management domain traceability
 * @position Cross-cutting audit infrastructure capturing sensitive configuration and IAM changes
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;

@Service
public class AdminAuditService {
  private final JdbcTemplate jdbcTemplate;
  private final JsonSupport jsonSupport;

  public AdminAuditService(JdbcTemplate jdbcTemplate, JsonSupport jsonSupport) {
    this.jdbcTemplate = jdbcTemplate;
    this.jsonSupport = jsonSupport;
  }

  public void logAction(
      String operator, String actionType, String targetType, String targetId, Object detail) {
    jdbcTemplate.update(
        """
        INSERT INTO admin_audit_log (operator, action_type, target_type, target_id, detail_json)
        VALUES (?, ?, ?, ?, ?)
        """,
        normalize(operator),
        normalize(actionType),
        normalize(targetType),
        normalize(targetId),
        detail == null ? null : jsonSupport.toJson(detail));
  }

  public List<AdminAuditLogRecord> list(
      String actionType, String operator, String targetType, int limit) {
    StringBuilder sql =
        new StringBuilder(
            """
            SELECT id, operator, action_type, target_type, target_id, detail_json, created_at
            FROM admin_audit_log
            WHERE 1 = 1
            """);
    List<Object> params = new ArrayList<>();

    if (actionType != null && !actionType.isBlank()) {
      sql.append(" AND action_type = ?");
      params.add(actionType.trim());
    }
    if (operator != null && !operator.isBlank()) {
      sql.append(" AND operator = ?");
      params.add(operator.trim());
    }
    if (targetType != null && !targetType.isBlank()) {
      sql.append(" AND target_type = ?");
      params.add(targetType.trim());
    }

    int safeLimit = Math.max(1, Math.min(limit, 500));
    sql.append(" ORDER BY id DESC LIMIT ?");
    params.add(safeLimit);

    return jdbcTemplate.query(sql.toString(), new AdminAuditRowMapper(), params.toArray());
  }

  private String normalize(String raw) {
    if (raw == null || raw.isBlank()) {
      return "system";
    }
    return raw.trim();
  }

  private static class AdminAuditRowMapper implements RowMapper<AdminAuditLogRecord> {
    @Override
    public AdminAuditLogRecord mapRow(ResultSet rs, int rowNum) throws SQLException {
      AdminAuditLogRecord record = new AdminAuditLogRecord();
      record.setId(rs.getLong("id"));
      record.setOperator(rs.getString("operator"));
      record.setActionType(rs.getString("action_type"));
      record.setTargetType(rs.getString("target_type"));
      record.setTargetId(rs.getString("target_id"));
      record.setDetailJson(rs.getString("detail_json"));
      record.setCreatedAt(String.valueOf(rs.getTimestamp("created_at")));
      return record;
    }
  }
}
