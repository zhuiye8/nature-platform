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
            SELECT role_code, role_name, description, system_flag, enabled, data_scope, project_view_all, peer_sales_limited
            FROM iam_role
            ORDER BY system_flag DESC, role_code ASC
            """,
            new AdminRoleRowMapper());

    if (rows.isEmpty()) {
      return rows;
    }

    Map<String, List<String>> resourceMap = loadRoleResourceMap(rows);
    Map<String, List<Long>> dataScopeDeptMap = loadRoleDataScopeDeptMap(rows);
    for (AdminRoleRecord row : rows) {
      row.setResourceKeys(resourceMap.getOrDefault(row.getRoleCode(), List.of()));
      row.setDataScopeDeptIds(dataScopeDeptMap.getOrDefault(row.getRoleCode(), List.of()));
    }
    return rows;
  }

  public AdminRoleRecord detail(String roleCode) {
    String normalizedRoleCode = normalizeRoleCode(roleCode);
    List<AdminRoleRecord> rows =
        jdbcTemplate.query(
            """
            SELECT role_code, role_name, description, system_flag, enabled, data_scope, project_view_all, peer_sales_limited
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
    row.setDataScopeDeptIds(
        jdbcTemplate.queryForList(
            """
            SELECT dept_id
            FROM iam_role_data_scope_dept
            WHERE role_code = ?
            ORDER BY dept_id ASC
            """,
            Long.class,
            normalizedRoleCode));
    return row;
  }

  @Transactional
  public AdminRoleRecord create(AdminRoleUpsertRequest request, String operator) {
    String roleCode = normalizeRoleCode(request.getRoleCode());
    String roleName = normalizeRequired(request.getRoleName(), "roleName is required");
    String description = normalizeOptional(request.getDescription());
    boolean enabled = request.getEnabled() == null || request.getEnabled();
    String dataScope = normalizeDataScope(request.getDataScope());
    boolean projectViewAll = request.getProjectViewAll() != null && request.getProjectViewAll();
    boolean peerSalesLimited = request.getPeerSalesLimited() != null && request.getPeerSalesLimited();
    List<Long> dataScopeDeptIds =
        RoleDataScopeTypes.CUSTOM.equals(dataScope)
            ? normalizeDeptIds(request.getDataScopeDeptIds())
            : List.of();

    ensureRoleCodeNotExists(roleCode);
    List<String> resources = normalizeResourceKeys(request.getResourceKeys());
    ensureResourceKeysExist(resources);
    ensureDeptIdsExist(dataScopeDeptIds);

    jdbcTemplate.update(
        """
        INSERT INTO iam_role (
          role_code, role_name, description, system_flag, enabled, data_scope, project_view_all, peer_sales_limited
        )
        VALUES (?, ?, ?, 0, ?, ?, ?, ?)
        """,
        roleCode,
        roleName,
        description,
        enabled ? 1 : 0,
        dataScope,
        projectViewAll ? 1 : 0,
        peerSalesLimited ? 1 : 0);

    replaceRoleResources(roleCode, resources);
    replaceRoleDataScopeDepts(roleCode, dataScopeDeptIds);
    adminAuditService.logAction(
        operator,
        "ADMIN_ROLE_CREATE",
        "ROLE",
        roleCode,
        Map.of(
            "roleName", roleName,
            "enabled", enabled,
            "dataScope", dataScope,
            "projectViewAll", projectViewAll,
            "peerSalesLimited", peerSalesLimited,
            "dataScopeDeptIds", dataScopeDeptIds,
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
    String dataScope =
        request.getDataScope() == null
            ? normalizeDataScope(state.dataScope())
            : normalizeDataScope(request.getDataScope());
    boolean projectViewAll =
        request.getProjectViewAll() == null ? state.projectViewAll() : request.getProjectViewAll();
    boolean peerSalesLimited =
        request.getPeerSalesLimited() == null ? state.peerSalesLimited() : request.getPeerSalesLimited();
    List<Long> dataScopeDeptIds =
        RoleDataScopeTypes.CUSTOM.equals(dataScope)
            ? normalizeDeptIds(request.getDataScopeDeptIds())
            : List.of();
    List<String> resources = normalizeResourceKeys(request.getResourceKeys());
    ensureResourceKeysExist(resources);
    ensureDeptIdsExist(dataScopeDeptIds);

    jdbcTemplate.update(
        """
        UPDATE iam_role
        SET role_name = ?, description = ?, enabled = ?, data_scope = ?, project_view_all = ?, peer_sales_limited = ?
        WHERE role_code = ?
        """,
        roleName,
        description,
        enabled ? 1 : 0,
        dataScope,
        projectViewAll ? 1 : 0,
        peerSalesLimited ? 1 : 0,
        normalizedRoleCode);

    replaceRoleResources(normalizedRoleCode, resources);
    replaceRoleDataScopeDepts(normalizedRoleCode, dataScopeDeptIds);
    adminAuditService.logAction(
        operator,
        "ADMIN_ROLE_UPDATE",
        "ROLE",
        normalizedRoleCode,
        Map.of(
            "roleName", roleName,
            "enabled", enabled,
            "dataScope", dataScope,
            "projectViewAll", projectViewAll,
            "peerSalesLimited", peerSalesLimited,
            "dataScopeDeptIds", dataScopeDeptIds,
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

    jdbcTemplate.update("DELETE FROM iam_role_data_scope_dept WHERE role_code = ?", normalizedRoleCode);
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
        ORDER BY sort_order ASC, username ASC
        """,
        String.class,
        normalizedRoleCode);
  }

  public List<AdminRoleUserOptionRecord> listUserOptions() {
    return jdbcTemplate.query(
        """
        SELECT u.username, u.display_name, u.enabled, u.dept_id, d.dept_name
        FROM user_account u
        LEFT JOIN iam_department d ON d.id = u.dept_id
        ORDER BY u.enabled DESC, d.sort_order ASC, d.id ASC, u.display_name ASC, u.username ASC
        """,
        (rs, rowNum) -> {
          AdminRoleUserOptionRecord record = new AdminRoleUserOptionRecord();
          record.setUsername(rs.getString("username"));
          record.setDisplayName(rs.getString("display_name"));
          record.setEnabled(rs.getBoolean("enabled"));
          record.setDeptId(rs.getObject("dept_id", Long.class));
          record.setDeptName(rs.getString("dept_name"));
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
    for (int i = 0; i < normalizedUsernames.size(); i++) {
      String username = normalizedUsernames.get(i);
      jdbcTemplate.update(
          """
          INSERT INTO user_role (username, role_code, sort_order)
          VALUES (?, ?, ?)
          """,
          username,
          normalizedRoleCode,
          i * 10);
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

  private void replaceRoleDataScopeDepts(String roleCode, List<Long> deptIds) {
    jdbcTemplate.update("DELETE FROM iam_role_data_scope_dept WHERE role_code = ?", roleCode);
    for (Long deptId : deptIds) {
      jdbcTemplate.update(
          """
          INSERT INTO iam_role_data_scope_dept (role_code, dept_id)
          VALUES (?, ?)
          """,
          roleCode,
          deptId);
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

  private void ensureDeptIdsExist(List<Long> deptIds) {
    if (deptIds == null || deptIds.isEmpty()) {
      return;
    }
    String placeholders = String.join(",", Collections.nCopies(deptIds.size(), "?"));
    String sql = "SELECT id FROM iam_department WHERE id IN (%s)".formatted(placeholders);
    Set<Long> existing =
        new LinkedHashSet<>(jdbcTemplate.queryForList(sql, Long.class, deptIds.toArray()));
    List<Long> missing = deptIds.stream().filter(deptId -> !existing.contains(deptId)).toList();
    if (!missing.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "unknown department ids: " + missing);
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
            SELECT role_code, role_name, system_flag, enabled, data_scope, project_view_all, peer_sales_limited
            FROM iam_role
            WHERE role_code = ?
            """,
            (rs, rowNum) ->
                new RoleState(
                    rs.getString("role_code"),
                    rs.getString("role_name"),
                    rs.getBoolean("system_flag"),
                    rs.getBoolean("enabled"),
                    rs.getString("data_scope"),
                    rs.getBoolean("project_view_all"),
                    rs.getBoolean("peer_sales_limited")),
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

  private List<Long> normalizeDeptIds(List<Long> deptIds) {
    if (deptIds == null || deptIds.isEmpty()) {
      return List.of();
    }
    LinkedHashSet<Long> set = new LinkedHashSet<>();
    for (Long deptId : deptIds) {
      if (deptId == null || deptId <= 0) {
        continue;
      }
      set.add(deptId);
    }
    return new ArrayList<>(set);
  }

  private String normalizeDataScope(String rawDataScope) {
    String normalized =
        rawDataScope == null || rawDataScope.isBlank()
            ? RoleDataScopeTypes.SELF
            : rawDataScope.trim().toUpperCase(Locale.ROOT);
    if (!RoleDataScopeTypes.isValid(normalized)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "unknown data scope: " + rawDataScope);
    }
    return normalized;
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
      record.setDataScope(rs.getString("data_scope"));
      record.setProjectViewAll(rs.getBoolean("project_view_all"));
      record.setPeerSalesLimited(rs.getBoolean("peer_sales_limited"));
      return record;
    }
  }

  private Map<String, List<Long>> loadRoleDataScopeDeptMap(List<AdminRoleRecord> rows) {
    List<String> roleCodes = rows.stream().map(AdminRoleRecord::getRoleCode).toList();
    if (roleCodes.isEmpty()) {
      return Map.of();
    }
    String placeholders = String.join(",", Collections.nCopies(roleCodes.size(), "?"));
    String sql =
        """
        SELECT role_code, dept_id
        FROM iam_role_data_scope_dept
        WHERE role_code IN (%s)
        ORDER BY role_code ASC, dept_id ASC
        """
            .formatted(placeholders);

    return jdbcTemplate.query(
            sql,
            (rs, rowNum) ->
                new RoleDataScopeDeptRef(rs.getString("role_code"), rs.getLong("dept_id")),
            roleCodes.toArray())
        .stream()
        .collect(
            Collectors.groupingBy(
                RoleDataScopeDeptRef::roleCode,
                Collectors.mapping(RoleDataScopeDeptRef::deptId, Collectors.toList())));
  }

  private record RoleState(
      String roleCode,
      String roleName,
      boolean systemFlag,
      boolean enabled,
      String dataScope,
      boolean projectViewAll,
      boolean peerSalesLimited) {}

  private record RoleResourceRef(String roleCode, String resourceKey) {}

  private record RoleDataScopeDeptRef(String roleCode, Long deptId) {}
}
