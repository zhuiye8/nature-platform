/**
 * @input JdbcTemplate IAM tables, PermissionSyncService, and admin permission write payloads
 * @output Permission catalog CRUD methods plus built-in permission sync operation for admin APIs
 * @position IAM application service for permission dictionary maintenance and migration-free permission evolution
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Service
public class AdminPermissionService {
  private final JdbcTemplate jdbcTemplate;
  private final AdminAuditService adminAuditService;
  private final PermissionSyncService permissionSyncService;

  public AdminPermissionService(
      JdbcTemplate jdbcTemplate,
      AdminAuditService adminAuditService,
      PermissionSyncService permissionSyncService) {
    this.jdbcTemplate = jdbcTemplate;
    this.adminAuditService = adminAuditService;
    this.permissionSyncService = permissionSyncService;
  }

  public List<AdminPermissionRecord> listPermissions(String category, String keyword, Boolean enabled) {
    StringBuilder sql =
        new StringBuilder(
            """
            SELECT permission_code, permission_name, category, description, enabled, built_in
            FROM iam_permission
            WHERE 1 = 1
            """);
    List<Object> args = new ArrayList<>();

    if (category != null && !category.isBlank()) {
      sql.append(" AND category = ? ");
      args.add(category.trim());
    }
    if (enabled != null) {
      sql.append(" AND enabled = ? ");
      args.add(enabled ? 1 : 0);
    }
    if (keyword != null && !keyword.isBlank()) {
      String like = "%" + keyword.trim() + "%";
      sql.append(
          """
           AND (
             permission_code LIKE ?
             OR permission_name LIKE ?
             OR description LIKE ?
           )
          """);
      args.add(like);
      args.add(like);
      args.add(like);
    }
    sql.append(" ORDER BY category ASC, permission_code ASC ");
    return jdbcTemplate.query(sql.toString(), new AdminPermissionRowMapper(), args.toArray());
  }

  @Transactional
  public AdminPermissionRecord create(AdminPermissionCreateRequest request, String operator) {
    String permissionCode = normalizePermissionCode(request.getPermissionCode());
    String permissionName = normalizeRequired(request.getPermissionName(), "permissionName is required");
    String category = normalizeRequired(request.getCategory(), "category is required");
    String description = normalizeOptional(request.getDescription());
    boolean enabled = request.getEnabled();

    ensurePermissionCodeNotExists(permissionCode);
    jdbcTemplate.update(
        """
        INSERT INTO iam_permission (
          permission_code, permission_name, category, description, enabled, built_in
        ) VALUES (?, ?, ?, ?, ?, 0)
        """,
        permissionCode,
        permissionName,
        category,
        description,
        enabled ? 1 : 0);
    adminAuditService.logAction(
        operator,
        "ADMIN_PERMISSION_CREATE",
        "PERMISSION",
        permissionCode,
        Map.of(
            "permissionName", permissionName,
            "category", category,
            "enabled", enabled));
    return detail(permissionCode);
  }

  @Transactional
  public AdminPermissionRecord update(
      String permissionCode, AdminPermissionUpdateRequest request, String operator) {
    PermissionState state = loadPermissionState(permissionCode);
    String permissionName = normalizeRequired(request.getPermissionName(), "permissionName is required");
    String category = normalizeRequired(request.getCategory(), "category is required");
    String description = normalizeOptional(request.getDescription());
    boolean enabled = request.getEnabled();

    jdbcTemplate.update(
        """
        UPDATE iam_permission
        SET permission_name = ?, category = ?, description = ?, enabled = ?
        WHERE permission_code = ?
        """,
        permissionName,
        category,
        description,
        enabled ? 1 : 0,
        state.permissionCode());
    adminAuditService.logAction(
        operator,
        "ADMIN_PERMISSION_UPDATE",
        "PERMISSION",
        state.permissionCode(),
        Map.of(
            "permissionName", permissionName,
            "category", category,
            "enabled", enabled,
            "builtIn", state.builtIn()));
    return detail(state.permissionCode());
  }

  @Transactional
  public void delete(String permissionCode, String operator) {
    PermissionState state = loadPermissionState(permissionCode);
    if (state.builtIn()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "built-in permission can not be deleted");
    }
    Integer roleBindingCount =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(1) FROM iam_role_permission WHERE permission_code = ?",
            Integer.class,
            state.permissionCode());
    if (roleBindingCount != null && roleBindingCount > 0) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "permission is still assigned to roles");
    }
    jdbcTemplate.update("DELETE FROM iam_permission WHERE permission_code = ?", state.permissionCode());
    adminAuditService.logAction(
        operator,
        "ADMIN_PERMISSION_DELETE",
        "PERMISSION",
        state.permissionCode(),
        Map.of("permissionName", state.permissionName()));
  }

  @Transactional
  public PermissionSyncService.PermissionSyncResult syncBuiltInPermissions(
      boolean overwriteText, String operator) {
    return permissionSyncService.syncBuiltInPermissions(overwriteText, operator);
  }

  private AdminPermissionRecord detail(String permissionCode) {
    String normalizedPermissionCode = normalizePermissionCode(permissionCode);
    List<AdminPermissionRecord> rows =
        jdbcTemplate.query(
            """
            SELECT permission_code, permission_name, category, description, enabled, built_in
            FROM iam_permission
            WHERE permission_code = ?
            """,
            new AdminPermissionRowMapper(),
            normalizedPermissionCode);
    if (rows.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "permission not found");
    }
    return rows.get(0);
  }

  private PermissionState loadPermissionState(String permissionCode) {
    String normalizedPermissionCode = normalizePermissionCode(permissionCode);
    List<PermissionState> rows =
        jdbcTemplate.query(
            """
            SELECT permission_code, permission_name, built_in
            FROM iam_permission
            WHERE permission_code = ?
            """,
            (rs, rowNum) ->
                new PermissionState(
                    rs.getString("permission_code"),
                    rs.getString("permission_name"),
                    rs.getBoolean("built_in")),
            normalizedPermissionCode);
    if (rows.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "permission not found");
    }
    return rows.get(0);
  }

  private void ensurePermissionCodeNotExists(String permissionCode) {
    Integer count =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(1) FROM iam_permission WHERE permission_code = ?",
            Integer.class,
            permissionCode);
    if (count != null && count > 0) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "permission already exists");
    }
  }

  private String normalizePermissionCode(String rawPermissionCode) {
    String code = normalizeRequired(rawPermissionCode, "permissionCode is required").toLowerCase(Locale.ROOT);
    if (!code.contains(":") || !code.matches("^[a-z0-9][a-z0-9:-]{1,63}$")) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "permissionCode must match [a-z0-9:-] and contain ':'");
    }
    return code;
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

  private static class AdminPermissionRowMapper implements RowMapper<AdminPermissionRecord> {
    @Override
    public AdminPermissionRecord mapRow(ResultSet rs, int rowNum) throws SQLException {
      AdminPermissionRecord record = new AdminPermissionRecord();
      record.setPermissionCode(rs.getString("permission_code"));
      record.setPermissionName(rs.getString("permission_name"));
      record.setCategory(rs.getString("category"));
      record.setDescription(rs.getString("description"));
      record.setEnabled(rs.getBoolean("enabled"));
      record.setBuiltIn(rs.getBoolean("built_in"));
      return record;
    }
  }

  private record PermissionState(String permissionCode, String permissionName, boolean builtIn) {}
}
