/**
 * @input JdbcTemplate department persistence, audit logger, and department save request payloads
 * @output Department list/tree/create/update operations with source-type edit constraints and parent-cycle validation
 * @position IAM organization application service for local department maintenance and option query capabilities
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AdminDepartmentService {
  public static final String SOURCE_LOCAL = "LOCAL";
  public static final String SOURCE_DINGTALK = "DINGTALK";

  private final JdbcTemplate jdbcTemplate;
  private final AdminAuditService adminAuditService;

  public AdminDepartmentService(JdbcTemplate jdbcTemplate, AdminAuditService adminAuditService) {
    this.jdbcTemplate = jdbcTemplate;
    this.adminAuditService = adminAuditService;
  }

  public List<AdminDepartmentRecord> list() {
    return jdbcTemplate.query(baseSql() + " ORDER BY d.sort_order ASC, d.id ASC", new DepartmentRowMapper());
  }

  public List<AdminDepartmentRecord> tree() {
    List<AdminDepartmentRecord> rows = list();
    if (rows.isEmpty()) {
      return rows;
    }
    Map<Long, AdminDepartmentRecord> map = new LinkedHashMap<>();
    for (AdminDepartmentRecord row : rows) {
      row.setChildren(new ArrayList<>());
      map.put(row.getId(), row);
    }
    List<AdminDepartmentRecord> roots = new ArrayList<>();
    for (AdminDepartmentRecord row : rows) {
      Long parentId = row.getParentId();
      if (parentId == null || parentId <= 0 || !map.containsKey(parentId)) {
        roots.add(row);
      } else {
        map.get(parentId).getChildren().add(row);
      }
    }
    return roots;
  }

  @Transactional
  public AdminDepartmentRecord create(AdminDepartmentSaveRequest request, String operator) {
    String deptCode = normalizeDeptCode(request.getDeptCode());
    String deptName = normalizeRequired(request.getDeptName(), "deptName is required");
    Long parentId = normalizeParentId(request.getParentId());
    int sortOrder = request.getSortOrder() == null ? 0 : request.getSortOrder();
    boolean enabled = request.getEnabled() == null || request.getEnabled();
    String defaultRoleCode = normalizeRoleCode(request.getDefaultRoleCode());

    ensureDeptCodeNotExists(deptCode);
    ensureParentExists(parentId);
    ensureRoleCodeEnabled(defaultRoleCode);

    jdbcTemplate.update(
        """
        INSERT INTO iam_department (dept_code, dept_name, parent_id, source_type, enabled, sort_order, default_role_code)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        deptCode,
        deptName,
        parentId,
        SOURCE_LOCAL,
        enabled ? 1 : 0,
        sortOrder,
        defaultRoleCode);

    Long id = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
    if (id == null || id <= 0) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "create department failed");
    }

    adminAuditService.logAction(
        operator,
        "ADMIN_DEPARTMENT_CREATE",
        "DEPARTMENT",
        String.valueOf(id),
        Map.of(
            "deptCode", deptCode,
            "deptName", deptName,
            "parentId", parentId,
            "enabled", enabled,
            "sortOrder", sortOrder,
            "defaultRoleCode", defaultRoleCode));
    return detail(id);
  }

  @Transactional
  public AdminDepartmentRecord update(long id, AdminDepartmentSaveRequest request, String operator) {
    DepartmentState state = loadDepartmentState(id);
    if (SOURCE_DINGTALK.equalsIgnoreCase(state.sourceType())) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "DingTalk synced department is read-only");
    }

    String deptCode = normalizeDeptCode(request.getDeptCode());
    String deptName = normalizeRequired(request.getDeptName(), "deptName is required");
    Long parentId = normalizeParentId(request.getParentId());
    int sortOrder = request.getSortOrder() == null ? state.sortOrder() : request.getSortOrder();
    boolean enabled = request.getEnabled() == null ? state.enabled() : request.getEnabled();
    String defaultRoleCode = normalizeRoleCode(request.getDefaultRoleCode());

    if (!deptCode.equalsIgnoreCase(state.deptCode())) {
      ensureDeptCodeNotExists(deptCode);
    }
    ensureParentExists(parentId);
    ensureRoleCodeEnabled(defaultRoleCode);
    ensureNoParentCycle(id, parentId);

    jdbcTemplate.update(
        """
        UPDATE iam_department
        SET dept_code = ?, dept_name = ?, parent_id = ?, enabled = ?, sort_order = ?, default_role_code = ?
        WHERE id = ?
        """,
        deptCode,
        deptName,
        parentId,
        enabled ? 1 : 0,
        sortOrder,
        defaultRoleCode,
        id);

    adminAuditService.logAction(
        operator,
        "ADMIN_DEPARTMENT_UPDATE",
        "DEPARTMENT",
        String.valueOf(id),
        Map.of(
            "deptCode", deptCode,
            "deptName", deptName,
            "parentId", parentId,
            "enabled", enabled,
            "sortOrder", sortOrder,
            "defaultRoleCode", defaultRoleCode));
    return detail(id);
  }

  public AdminDepartmentRecord detail(long id) {
    List<AdminDepartmentRecord> rows =
        jdbcTemplate.query(baseSql() + " AND d.id = ?", new DepartmentRowMapper(), id);
    if (rows.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "department not found");
    }
    return rows.get(0);
  }

  public void ensureDepartmentExists(Long deptId) {
    if (deptId == null || deptId <= 0) {
      return;
    }
    Integer count =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(1) FROM iam_department WHERE id = ?", Integer.class, deptId);
    if (count == null || count <= 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "department not found: " + deptId);
    }
  }

  private void ensureDeptCodeNotExists(String deptCode) {
    Integer count =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(1) FROM iam_department WHERE UPPER(dept_code) = ?",
            Integer.class,
            deptCode.toUpperCase(Locale.ROOT));
    if (count != null && count > 0) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "department code already exists");
    }
  }

  private void ensureParentExists(Long parentId) {
    if (parentId == null || parentId <= 0) {
      return;
    }
    Integer count =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(1) FROM iam_department WHERE id = ?", Integer.class, parentId);
    if (count == null || count <= 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "parent department not found");
    }
  }

  private void ensureRoleCodeEnabled(String roleCode) {
    if (!StringUtils.hasText(roleCode)) {
      return;
    }
    Integer count =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(1) FROM iam_role WHERE role_code = ? AND enabled = 1",
            Integer.class,
            roleCode);
    if (count == null || count <= 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "default role not found or disabled");
    }
  }

  private void ensureNoParentCycle(long selfId, Long parentId) {
    if (parentId == null || parentId <= 0) {
      return;
    }
    long current = parentId;
    int guard = 0;
    while (current > 0 && guard < 2000) {
      if (current == selfId) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "parent department causes cycle");
      }
      Long next =
          jdbcTemplate.query(
                  "SELECT parent_id FROM iam_department WHERE id = ?",
                  (rs, rowNum) -> {
                    long value = rs.getLong("parent_id");
                    return rs.wasNull() ? null : value;
                  },
                  current)
              .stream()
              .findFirst()
              .orElse(null);
      if (next == null || next <= 0) {
        return;
      }
      current = next;
      guard++;
    }
  }

  private DepartmentState loadDepartmentState(long id) {
    List<DepartmentState> rows =
        jdbcTemplate.query(
            """
            SELECT id, dept_code, source_type, enabled, sort_order
            FROM iam_department
            WHERE id = ?
            """,
            (rs, rowNum) ->
                new DepartmentState(
                    rs.getLong("id"),
                    rs.getString("dept_code"),
                    rs.getString("source_type"),
                    rs.getBoolean("enabled"),
                    rs.getInt("sort_order")),
            id);
    if (rows.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "department not found");
    }
    return rows.get(0);
  }

  private Long normalizeParentId(Long parentId) {
    if (parentId == null || parentId <= 0) {
      return null;
    }
    return parentId;
  }

  private String normalizeDeptCode(String raw) {
    String normalized = normalizeRequired(raw, "deptCode is required").toUpperCase(Locale.ROOT);
    if (!normalized.matches("^[A-Z0-9_\\-]{2,64}$")) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "deptCode must be 2-64 chars of A-Z/0-9/_/-");
    }
    return normalized;
  }

  private String normalizeRequired(String raw, String message) {
    if (raw == null || raw.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
    return raw.trim();
  }

  private String baseSql() {
    return """
        SELECT d.id, d.dept_code, d.dept_name, d.parent_id,
               p.dept_name parent_name, d.source_type, d.ding_dept_id,
               d.default_role_code, r.role_name default_role_name,
               d.enabled, d.sort_order
        FROM iam_department d
        LEFT JOIN iam_department p ON p.id = d.parent_id
        LEFT JOIN iam_role r ON r.role_code = d.default_role_code
        WHERE 1 = 1
        """;
  }

  private static class DepartmentRowMapper implements RowMapper<AdminDepartmentRecord> {
    @Override
    public AdminDepartmentRecord mapRow(ResultSet rs, int rowNum) throws SQLException {
      AdminDepartmentRecord row = new AdminDepartmentRecord();
      row.setId(rs.getLong("id"));
      row.setDeptCode(rs.getString("dept_code"));
      row.setDeptName(rs.getString("dept_name"));
      long parentValue = rs.getLong("parent_id");
      row.setParentId(rs.wasNull() ? null : parentValue);
      row.setParentName(rs.getString("parent_name"));
      row.setSourceType(rs.getString("source_type"));
      row.setDingDeptId(rs.getString("ding_dept_id"));
      row.setDefaultRoleCode(rs.getString("default_role_code"));
      row.setDefaultRoleName(rs.getString("default_role_name"));
      row.setEnabled(rs.getBoolean("enabled"));
      row.setSortOrder(rs.getInt("sort_order"));
      return row;
    }
  }

  private record DepartmentState(
      long id, String deptCode, String sourceType, boolean enabled, int sortOrder) {}

  private String normalizeRoleCode(String rawRoleCode) {
    if (rawRoleCode == null || rawRoleCode.isBlank()) {
      return null;
    }
    return rawRoleCode.trim().toUpperCase(Locale.ROOT);
  }
}
