/**
 * @input JdbcTemplate IAM tables, AdminAuditService operation logger, and role/resource request payloads
 * @output Role CRUD methods with role-resource and role-user binding persistence plus conflict validation
 * @position IAM application service for role lifecycle, role-user allocation, and page-resource governance in admin module
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AdminRoleService {
  private final JdbcTemplate jdbcTemplate;
  private final AdminAuditService adminAuditService;

  public AdminRoleService(JdbcTemplate jdbcTemplate, AdminAuditService adminAuditService) {
    this.jdbcTemplate = jdbcTemplate;
    this.adminAuditService = adminAuditService;
  }

  public List<AdminRoleRecord> listRoles() {
    List<AdminRoleRecord> rows =
        jdbcTemplate.query(
            """
            SELECT role_code, role_name, description, system_flag, enabled
            FROM iam_role
            ORDER BY system_flag DESC, role_code ASC
            """,
            new AdminRoleRowMapper());

    if (rows.isEmpty()) {
      return rows;
    }

    Map<String, List<String>> resourceMap = loadRoleResourceMap(rows);
    for (AdminRoleRecord row : rows) {
      row.setResourceKeys(resourceMap.getOrDefault(row.getRoleCode(), List.of()));
    }
    return rows;
  }

  public AdminRoleRecord detail(String roleCode) {
    String normalizedRoleCode = normalizeRoleCode(roleCode);
    List<AdminRoleRecord> rows =
        jdbcTemplate.query(
            """
            SELECT role_code, role_name, description, system_flag, enabled
            FROM iam_role
            WHERE role_code = ?
            """,
            new AdminRoleRowMapper(),
            normalizedRoleCode);
    if (rows.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "role not found");
    }

    AdminRoleRecord row = rows.get(0);
    row.setResourceKeys(
        jdbcTemplate.queryForList(
            """
            SELECT resource_key
            FROM iam_role_resource
            WHERE role_code = ?
            ORDER BY resource_key ASC
            """,
            String.class,
            normalizedRoleCode));
    return row;
  }

  @Transactional
  public AdminRoleRecord create(AdminRoleUpsertRequest request, String operator) {
    String roleCode = normalizeRoleCode(request.getRoleCode());
    String roleName = normalizeRequired(request.getRoleName(), "roleName is required");
    String description = normalizeOptional(request.getDescription());
    boolean enabled = request.getEnabled() == null || request.getEnabled();

    ensureRoleCodeNotExists(roleCode);
    List<String> resources = normalizeResourceKeys(request.getResourceKeys());
    ensureResourceKeysExist(resources);

    jdbcTemplate.update(
        """
        INSERT INTO iam_role (role_code, role_name, description, system_flag, enabled)
        VALUES (?, ?, ?, 0, ?)
        """,
        roleCode,
        roleName,
        description,
        enabled ? 1 : 0);

    replaceRoleResources(roleCode, resources);
    adminAuditService.logAction(
        operator,
        "ADMIN_ROLE_CREATE",
        "ROLE",
        roleCode,
        Map.of(
            "roleName", roleName,
            "enabled", enabled,
            "resourceKeys", resources));
    return detail(roleCode);
  }

  @Transactional
  public AdminRoleRecord update(String roleCode, AdminRoleUpsertRequest request, String operator) {
    String normalizedRoleCode = normalizeRoleCode(roleCode);
    RoleState state = loadRoleState(normalizedRoleCode);

    String roleName = normalizeRequired(request.getRoleName(), "roleName is required");
    String description = normalizeOptional(request.getDescription());
    boolean enabled = request.getEnabled() == null ? state.enabled() : request.getEnabled();
    List<String> resources = normalizeResourceKeys(request.getResourceKeys());
    ensureResourceKeysExist(resources);

    jdbcTemplate.update(
        """
        UPDATE iam_role
        SET role_name = ?, description = ?, enabled = ?
        WHERE role_code = ?
        """,
        roleName,
        description,
        enabled ? 1 : 0,
        normalizedRoleCode);

    replaceRoleResources(normalizedRoleCode, resources);
    adminAuditService.logAction(
        operator,
        "ADMIN_ROLE_UPDATE",
        "ROLE",
        normalizedRoleCode,
        Map.of(
            "roleName", roleName,
            "enabled", enabled,
            "resourceKeys", resources,
            "systemFlag", state.systemFlag()));
    return detail(normalizedRoleCode);
  }

  @Transactional
  public void delete(String roleCode, String operator) {
    String normalizedRoleCode = normalizeRoleCode(roleCode);
    RoleState state = loadRoleState(normalizedRoleCode);
    if (state.systemFlag()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "system role cannot be deleted");
    }

    Integer assignedCount =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(1) FROM user_role WHERE role_code = ?",
            Integer.class,
            normalizedRoleCode);
    if (assignedCount != null && assignedCount > 0) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "role is still assigned to users");
    }

    jdbcTemplate.update("DELETE FROM iam_role_resource WHERE role_code = ?", normalizedRoleCode);
    jdbcTemplate.update("DELETE FROM iam_role WHERE role_code = ?", normalizedRoleCode);
    adminAuditService.logAction(
        operator,
        "ADMIN_ROLE_DELETE",
        "ROLE",
        normalizedRoleCode,
        Map.of("roleName", state.roleName()));
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

  public List<String> listRoleUsers(String roleCode) {
    String normalizedRoleCode = normalizeRoleCode(roleCode);
    loadRoleState(normalizedRoleCode);
    return jdbcTemplate.queryForList(
        """
        SELECT username
        FROM user_role
        WHERE role_code = ?
        ORDER BY username ASC
        """,
        String.class,
        normalizedRoleCode);
  }

  public List<AdminRoleUserOptionRecord> listUserOptions() {
    return jdbcTemplate.query(
        """
        SELECT username, display_name, enabled
        FROM user_account
        ORDER BY enabled DESC, username ASC
        """,
        (rs, rowNum) -> {
          AdminRoleUserOptionRecord record = new AdminRoleUserOptionRecord();
          record.setUsername(rs.getString("username"));
          record.setDisplayName(rs.getString("display_name"));
          record.setEnabled(rs.getBoolean("enabled"));
          return record;
        });
  }

  @Transactional
  public List<String> replaceRoleUsers(String roleCode, List<String> usernames, String operator) {
    String normalizedRoleCode = normalizeRoleCode(roleCode);
    RoleState state = loadRoleState(normalizedRoleCode);
    List<String> normalizedUsernames = normalizeUsernames(usernames);
    ensureUsernamesExist(normalizedUsernames);
    ensureEnabledSuperAdminStillExists(normalizedRoleCode, normalizedUsernames);

    jdbcTemplate.update("DELETE FROM user_role WHERE role_code = ?", normalizedRoleCode);
    for (String username : normalizedUsernames) {
      jdbcTemplate.update(
          """
          INSERT INTO user_role (username, role_code)
          VALUES (?, ?)
          """,
          username,
          normalizedRoleCode);
    }

    adminAuditService.logAction(
        operator,
        "ADMIN_ROLE_USER_ASSIGN",
        "ROLE",
        normalizedRoleCode,
        Map.of(
            "roleName", state.roleName(),
            "usernameCount", normalizedUsernames.size(),
            "usernames", normalizedUsernames));
    return listRoleUsers(normalizedRoleCode);
  }

  private Map<String, List<String>> loadRoleResourceMap(List<AdminRoleRecord> rows) {
    List<String> roleCodes = rows.stream().map(AdminRoleRecord::getRoleCode).toList();
    String placeholders = String.join(",", Collections.nCopies(roleCodes.size(), "?"));
    String sql =
        """
        SELECT role_code, resource_key
        FROM iam_role_resource
        WHERE role_code IN (%s)
        ORDER BY role_code ASC, resource_key ASC
        """
            .formatted(placeholders);

    return jdbcTemplate.query(
            sql,
            (rs, rowNum) ->
                new RoleResourceRef(rs.getString("role_code"), rs.getString("resource_key")),
            roleCodes.toArray())
        .stream()
        .collect(
            Collectors.groupingBy(
                RoleResourceRef::roleCode,
                Collectors.mapping(RoleResourceRef::resourceKey, Collectors.toList())));
  }

  private void replaceRoleResources(String roleCode, List<String> resourceKeys) {
    jdbcTemplate.update("DELETE FROM iam_role_resource WHERE role_code = ?", roleCode);
    for (String resourceKey : resourceKeys) {
      jdbcTemplate.update(
          """
          INSERT INTO iam_role_resource (role_code, resource_key)
          VALUES (?, ?)
          """,
          roleCode,
          resourceKey);
    }
  }

  private void ensureResourceKeysExist(List<String> resourceKeys) {
    if (resourceKeys.isEmpty()) {
      return;
    }
    String placeholders = String.join(",", Collections.nCopies(resourceKeys.size(), "?"));
    String sql =
        "SELECT resource_key FROM iam_resource WHERE resource_key IN (%s)"
            .formatted(placeholders);
    Set<String> existing =
        new LinkedHashSet<>(
            jdbcTemplate.queryForList(sql, String.class, resourceKeys.toArray()));

    List<String> missing = resourceKeys.stream().filter(code -> !existing.contains(code)).toList();
    if (!missing.isEmpty()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "unknown resource keys: " + String.join(",", missing));
    }
  }

  private void ensureUsernamesExist(List<String> usernames) {
    if (usernames == null || usernames.isEmpty()) {
      return;
    }
    String placeholders = String.join(",", Collections.nCopies(usernames.size(), "?"));
    String sql = "SELECT username FROM user_account WHERE username IN (%s)".formatted(placeholders);
    Set<String> existing = new LinkedHashSet<>(jdbcTemplate.queryForList(sql, String.class, usernames.toArray()));
    List<String> missing = usernames.stream().filter(username -> !existing.contains(username)).toList();
    if (!missing.isEmpty()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "unknown usernames: " + String.join(",", missing));
    }
  }

  private void ensureEnabledSuperAdminStillExists(String roleCode, List<String> usernames) {
    if (!UserAccountService.ROLE_SUPER_ADMIN.equals(roleCode)) {
      return;
    }
    if (usernames == null || usernames.isEmpty()) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "at least one enabled super admin must remain");
    }
    String placeholders = String.join(",", Collections.nCopies(usernames.size(), "?"));
    String sql =
        """
        SELECT COUNT(1)
        FROM user_account
        WHERE enabled = 1
          AND username IN (%s)
        """
            .formatted(placeholders);
    Integer enabledCount = jdbcTemplate.queryForObject(sql, Integer.class, usernames.toArray());
    if (enabledCount == null || enabledCount <= 0) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "at least one enabled super admin must remain");
    }
  }

  private void ensureRoleCodeNotExists(String roleCode) {
    Integer count =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(1) FROM iam_role WHERE role_code = ?", Integer.class, roleCode);
    if (count != null && count > 0) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "role already exists");
    }
  }

  private RoleState loadRoleState(String roleCode) {
    List<RoleState> states =
        jdbcTemplate.query(
            """
            SELECT role_code, role_name, system_flag, enabled
            FROM iam_role
            WHERE role_code = ?
            """,
            (rs, rowNum) ->
                new RoleState(
                    rs.getString("role_code"),
                    rs.getString("role_name"),
                    rs.getBoolean("system_flag"),
                    rs.getBoolean("enabled")),
            roleCode);
    if (states.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "role not found");
    }
    return states.get(0);
  }

  private List<String> normalizeResourceKeys(List<String> rawCodes) {
    if (rawCodes == null || rawCodes.isEmpty()) {
      return List.of();
    }
    LinkedHashSet<String> set = new LinkedHashSet<>();
    for (String raw : rawCodes) {
      if (raw == null || raw.isBlank()) {
        continue;
      }
      set.add(raw.trim().toLowerCase(Locale.ROOT));
    }
    return new ArrayList<>(set);
  }

  private List<String> normalizeUsernames(List<String> usernames) {
    if (usernames == null || usernames.isEmpty()) {
      return List.of();
    }
    LinkedHashSet<String> set = new LinkedHashSet<>();
    for (String raw : usernames) {
      if (raw == null || raw.isBlank()) {
        continue;
      }
      String normalized = raw.trim();
      if (!normalized.matches("^[a-zA-Z0-9._-]{3,64}$")) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "invalid username format: " + normalized);
      }
      set.add(normalized);
    }
    return new ArrayList<>(set);
  }

  private String normalizeRoleCode(String raw) {
    String normalized = normalizeRequired(raw, "roleCode is required");
    String upper = normalized.toUpperCase(Locale.ROOT);
    if (!upper.startsWith("ROLE_")) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "roleCode must start with ROLE_");
    }
    return upper;
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

  private static class AdminRoleRowMapper implements RowMapper<AdminRoleRecord> {
    @Override
    public AdminRoleRecord mapRow(ResultSet rs, int rowNum) throws SQLException {
      AdminRoleRecord record = new AdminRoleRecord();
      record.setRoleCode(rs.getString("role_code"));
      record.setRoleName(rs.getString("role_name"));
      record.setDescription(rs.getString("description"));
      record.setSystemFlag(rs.getBoolean("system_flag"));
      record.setEnabled(rs.getBoolean("enabled"));
      return record;
    }
  }

  private record RoleState(String roleCode, String roleName, boolean systemFlag, boolean enabled) {}

  private record RoleResourceRef(String roleCode, String resourceKey) {}
}
