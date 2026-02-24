/**
 * @input JdbcTemplate for persistence; old/new field maps from business services
 * @output logFieldChanges() writes field-level audit records to field_change_log
 * @position Audit infrastructure layer enforcing V1 field-level traceability requirement
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class FieldChangeLogService {
  private final JdbcTemplate jdbcTemplate;

  public FieldChangeLogService(JdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
  }

  public void logFieldChanges(
      String bizType,
      long bizId,
      String operator,
      Map<String, Object> oldValues,
      Map<String, Object> newValues) {
    for (Map.Entry<String, Object> item : newValues.entrySet()) {
      String field = item.getKey();
      String oldValue = normalize(oldValues.get(field));
      String newValue = normalize(item.getValue());
      if (oldValue.equals(newValue)) {
        continue;
      }

      jdbcTemplate.update(
          """
          INSERT INTO field_change_log (biz_type, biz_id, field_name, old_value, new_value, operator)
          VALUES (?, ?, ?, ?, ?, ?)
          """,
          bizType,
          bizId,
          field,
          oldValue,
          newValue,
          operator);
    }
  }

  private String normalize(Object value) {
    return value == null ? "" : String.valueOf(value);
  }
}

