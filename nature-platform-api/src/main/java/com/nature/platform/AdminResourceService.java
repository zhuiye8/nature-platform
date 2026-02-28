/**
 * @input JdbcTemplate iam_resource/iam_role_resource persistence, AdminAuditService logging, and UserAccountService role context
 * @output Resource catalog CRUD, role-resource assignment, and user-scoped menu tree query capabilities
 * @position IAM application service implementing page-level RBAC resource governance and menu projection
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
public class AdminResourceService {
  private final JdbcTemplate jdbcTemplate;
  private final AdminAuditService adminAuditService;
  private final UserAccountService userAccountService;

  public AdminResourceService(
      JdbcTemplate jdbcTemplate,
      AdminAuditService adminAuditService,
      UserAccountService userAccountService) {
    this.jdbcTemplate = jdbcTemplate;
    this.adminAuditService = adminAuditService;
    this.userAccountService = userAccountService;
  }

  public List<AdminResourceRecord> listResources(String keyword, String resourceType, Boolean enabled) {
    StringBuilder sql =
        new StringBuilder(
            """
            SELECT resource_key, resource_name, resource_type, parent_key, route_path, icon, sort_order, enabled, built_in, description
            FROM iam_resource
            WHERE 1 = 1
            """);
    List<Object> args = new ArrayList<>();
    if (resourceType != null && !resourceType.isBlank()) {
      sql.append(" AND resource_type = ? ");
      args.add(resourceType.trim().toUpperCase(Locale.ROOT));
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
             resource_key LIKE ?
             OR resource_name LIKE ?
             OR description LIKE ?
           )
          """);
      args.add(like);
      args.add(like);
      args.add(like);
    }
    sql.append(" ORDER BY sort_order ASC, resource_key ASC ");
    return jdbcTemplate.query(sql.toString(), new AdminResourceRowMapper(), args.toArray());
  }

  public List<AdminResourceRecord> listResourceTreeAll(boolean enabledOnly) {
    String sql =
        """
        SELECT resource_key, resource_name, resource_type, parent_key, route_path, icon, sort_order, enabled, built_in, description
        FROM iam_resource
        WHERE (? = 0 OR enabled = 1)
        ORDER BY sort_order ASC, resource_key ASC
        """;
    List<AdminResourceRecord> rows =
        jdbcTemplate.query(sql, new AdminResourceRowMapper(), enabledOnly ? 1 : 0);
    return buildTree(rows);
  }

  public List<AdminResourceRecord> listResourceTreeForUser(String username) {
    if (userAccountService.hasRole(username, UserAccountService.ROLE_SUPER_ADMIN)) {
      return listResourceTreeAll(true);
    }

    Set<String> roles = new LinkedHashSet<>(userAccountService.listRoles(username));
    roles.removeIf(item -> item == null || item.isBlank());
    if (roles.isEmpty()) {
      return List.of();
    }

    List<String> normalizedRoles = new ArrayList<>(roles);
    String placeholders = String.join(",", Collections.nCopies(normalizedRoles.size(), "?"));
    String sql =
        """
        SELECT resource_key, resource_name, resource_type, parent_key, route_path, icon, sort_order, enabled, built_in, description
        FROM iam_resource
        WHERE resource_key IN (
          SELECT DISTINCT rr.resource_key
          FROM iam_role_resource rr
          WHERE rr.role_code IN (%s)
        )
          AND enabled = 1
        ORDER BY sort_order ASC, resource_key ASC
        """
            .formatted(placeholders);
    List<AdminResourceRecord> assignedRows =
        jdbcTemplate.query(sql, new AdminResourceRowMapper(), normalizedRoles.toArray());

    if (assignedRows.isEmpty()) {
      return List.of();
    }

    Map<String, AdminResourceRecord> expanded = new LinkedHashMap<>();
    for (AdminResourceRecord row : assignedRows) {
      expanded.put(row.getResourceKey(), row);
    }

    Set<String> missingParentKeys = new LinkedHashSet<>();
    for (AdminResourceRecord row : assignedRows) {
      if (row.getParentKey() != null && !expanded.containsKey(row.getParentKey())) {
        missingParentKeys.add(row.getParentKey());
      }
    }
    if (!missingParentKeys.isEmpty()) {
      expanded.putAll(loadResourcesByKeys(missingParentKeys));
    }

    return buildTree(new ArrayList<>(expanded.values()));
  }

  @Transactional
  public AdminResourceRecord create(AdminResourceCreateRequest request, String operator) {
    String resourceKey = normalizeResourceKey(request.getResourceKey());
    String resourceName = normalizeRequired(request.getResourceName(), "resourceName is required");
    String resourceType = normalizeResourceType(request.getResourceType());
    String parentKey = normalizeOptionalKey(request.getParentKey());
    String routePath = normalizeOptional(request.getRoutePath());
    String icon = normalizeOptional(request.getIcon());
    int sortOrder = request.getSortOrder() == null ? 0 : request.getSortOrder();
    boolean enabled = request.getEnabled() == null || request.getEnabled();
    String description = normalizeOptional(request.getDescription());

    ensureResourceNotExists(resourceKey);
    ensureParentValid(resourceType, parentKey);
    ensureRoutePathValid(resourceType, routePath);

    jdbcTemplate.update(
        """
        INSERT INTO iam_resource (
          resource_key, resource_name, resource_type, parent_key, route_path, icon, sort_order, enabled, built_in, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
        """,
        resourceKey,
        resourceName,
        resourceType,
        parentKey,
        routePath,
        icon,
        sortOrder,
        enabled ? 1 : 0,
        description);
    adminAuditService.logAction(
        operator,
        "ADMIN_RESOURCE_CREATE",
        "RESOURCE",
        resourceKey,
        Map.of(
            "resourceType", resourceType,
            "parentKey", parentKey == null ? "" : parentKey,
            "routePath", routePath == null ? "" : routePath));
    return detail(resourceKey);
  }

  @Transactional
  public AdminResourceRecord update(
      String resourceKey, AdminResourceUpdateRequest request, String operator) {
    ResourceState state = loadResourceState(resourceKey);
    String resourceName = normalizeRequired(request.getResourceName(), "resourceName is required");
    String resourceType = normalizeResourceType(request.getResourceType());
    String parentKey = normalizeOptionalKey(request.getParentKey());
    String routePath = normalizeOptional(request.getRoutePath());
    String icon = normalizeOptional(request.getIcon());
    int sortOrder = request.getSortOrder() == null ? state.sortOrder() : request.getSortOrder();
    boolean enabled = request.getEnabled() == null ? state.enabled() : request.getEnabled();
    String description = normalizeOptional(request.getDescription());

    ensureParentValid(resourceType, parentKey);
    ensureRoutePathValid(resourceType, routePath);
    if (state.builtIn()
        && !state.resourceType().equals(resourceType)
        && (state.routePath() != null || routePath != null)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "built-in resource type can not be changed");
    }

    jdbcTemplate.update(
        """
        UPDATE iam_resource
        SET resource_name = ?, resource_type = ?, parent_key = ?, route_path = ?, icon = ?, sort_order = ?, enabled = ?, description = ?
        WHERE resource_key = ?
        """,
        resourceName,
        resourceType,
        parentKey,
        routePath,
        icon,
        sortOrder,
        enabled ? 1 : 0,
        description,
        state.resourceKey());

    adminAuditService.logAction(
        operator,
        "ADMIN_RESOURCE_UPDATE",
        "RESOURCE",
        state.resourceKey(),
        Map.of(
            "resourceType", resourceType,
            "parentKey", parentKey == null ? "" : parentKey,
            "enabled", enabled));
    return detail(state.resourceKey());
  }

  @Transactional
  public void delete(String resourceKey, String operator) {
    ResourceState state = loadResourceState(resourceKey);
    if (state.builtIn()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "built-in resource can not be deleted");
    }

    Integer childCount =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(1) FROM iam_resource WHERE parent_key = ?",
            Integer.class,
            state.resourceKey());
    if (childCount != null && childCount > 0) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "resource has child nodes");
    }

    Integer roleBindingCount =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(1) FROM iam_role_resource WHERE resource_key = ?",
            Integer.class,
            state.resourceKey());
    if (roleBindingCount != null && roleBindingCount > 0) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "resource is still assigned to roles");
    }

    jdbcTemplate.update("DELETE FROM iam_resource WHERE resource_key = ?", state.resourceKey());
    adminAuditService.logAction(
        operator,
        "ADMIN_RESOURCE_DELETE",
        "RESOURCE",
        state.resourceKey(),
        Map.of("resourceName", state.resourceName()));
  }

  public List<String> listRoleResourceKeys(String roleCode) {
    String normalizedRoleCode = normalizeRoleCode(roleCode);
    ensureRoleExists(normalizedRoleCode);
    return jdbcTemplate.queryForList(
        """
        SELECT resource_key
        FROM iam_role_resource
        WHERE role_code = ?
        ORDER BY resource_key ASC
        """,
        String.class,
        normalizedRoleCode);
  }

  @Transactional
  public List<String> replaceRoleResourceKeys(
      String roleCode, List<String> rawResourceKeys, String operator) {
    String normalizedRoleCode = normalizeRoleCode(roleCode);
    ensureRoleExists(normalizedRoleCode);
    List<String> resourceKeys = normalizeResourceKeys(rawResourceKeys);
    ensureResourceKeysExist(resourceKeys);

    jdbcTemplate.update("DELETE FROM iam_role_resource WHERE role_code = ?", normalizedRoleCode);
    for (String resourceKey : resourceKeys) {
      jdbcTemplate.update(
          """
          INSERT INTO iam_role_resource (role_code, resource_key)
          VALUES (?, ?)
          """,
          normalizedRoleCode,
          resourceKey);
    }

    adminAuditService.logAction(
        operator,
        "ADMIN_ROLE_RESOURCE_ASSIGN",
        "ROLE",
        normalizedRoleCode,
        Map.of(
            "resourceCount", resourceKeys.size(),
            "resourceKeys", resourceKeys));
    return listRoleResourceKeys(normalizedRoleCode);
  }

  public AdminResourceRecord detail(String resourceKey) {
    ResourceState state = loadResourceState(resourceKey);
    AdminResourceRecord record = new AdminResourceRecord();
    record.setResourceKey(state.resourceKey());
    record.setResourceName(state.resourceName());
    record.setResourceType(state.resourceType());
    record.setParentKey(state.parentKey());
    record.setRoutePath(state.routePath());
    record.setIcon(state.icon());
    record.setSortOrder(state.sortOrder());
    record.setEnabled(state.enabled());
    record.setBuiltIn(state.builtIn());
    record.setDescription(state.description());
    return record;
  }

  private Map<String, AdminResourceRecord> loadResourcesByKeys(Set<String> resourceKeys) {
    if (resourceKeys == null || resourceKeys.isEmpty()) {
      return Map.of();
    }
    List<String> keys = new ArrayList<>(resourceKeys);
    String placeholders = String.join(",", Collections.nCopies(keys.size(), "?"));
    String sql =
        """
        SELECT resource_key, resource_name, resource_type, parent_key, route_path, icon, sort_order, enabled, built_in, description
        FROM iam_resource
        WHERE resource_key IN (%s)
        ORDER BY sort_order ASC, resource_key ASC
        """
            .formatted(placeholders);
    return jdbcTemplate.query(sql, new AdminResourceRowMapper(), keys.toArray()).stream()
        .collect(LinkedHashMap::new, (map, row) -> map.put(row.getResourceKey(), row), Map::putAll);
  }

  private List<AdminResourceRecord> buildTree(List<AdminResourceRecord> rows) {
    if (rows == null || rows.isEmpty()) {
      return List.of();
    }
    Map<String, AdminResourceRecord> map = new LinkedHashMap<>();
    for (AdminResourceRecord row : rows) {
      row.setChildren(new ArrayList<>());
      map.put(row.getResourceKey(), row);
    }
    List<AdminResourceRecord> roots = new ArrayList<>();
    for (AdminResourceRecord row : rows) {
      String parentKey = row.getParentKey();
      if (parentKey != null && map.containsKey(parentKey)) {
        map.get(parentKey).getChildren().add(row);
      } else {
        roots.add(row);
      }
    }
    return roots;
  }

  private void ensureResourceNotExists(String resourceKey) {
    Integer count =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(1) FROM iam_resource WHERE resource_key = ?", Integer.class, resourceKey);
    if (count != null && count > 0) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "resource already exists");
    }
  }

  private void ensureParentValid(String resourceType, String parentKey) {
    if ("GROUP".equals(resourceType) && parentKey != null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "group resource can not set parentKey");
    }
    if (parentKey == null || parentKey.isBlank()) {
      return;
    }
    List<String> types =
        jdbcTemplate.queryForList(
            "SELECT resource_type FROM iam_resource WHERE resource_key = ?",
            String.class,
            parentKey);
    if (types.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "parent resource not found");
    }
    if ("PAGE".equals(resourceType) && !"GROUP".equals(types.get(0))) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "page resource parent must be group type");
    }
  }

  private void ensureRoutePathValid(String resourceType, String routePath) {
    if ("PAGE".equals(resourceType) && (routePath == null || routePath.isBlank())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "page resource routePath is required");
    }
    if ("GROUP".equals(resourceType) && routePath != null && !routePath.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "group resource routePath must be empty");
    }
  }

  private void ensureRoleExists(String roleCode) {
    Integer count =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(1) FROM iam_role WHERE role_code = ?",
            Integer.class,
            roleCode);
    if (count == null || count <= 0) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "role not found");
    }
  }

  private void ensureResourceKeysExist(List<String> resourceKeys) {
    if (resourceKeys == null || resourceKeys.isEmpty()) {
      return;
    }
    String placeholders = String.join(",", Collections.nCopies(resourceKeys.size(), "?"));
    String sql = "SELECT resource_key FROM iam_resource WHERE resource_key IN (%s)".formatted(placeholders);
    Set<String> existing =
        new LinkedHashSet<>(jdbcTemplate.queryForList(sql, String.class, resourceKeys.toArray()));
    List<String> missing = resourceKeys.stream().filter(key -> !existing.contains(key)).toList();
    if (!missing.isEmpty()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "unknown resource keys: " + String.join(",", missing));
    }
  }

  private ResourceState loadResourceState(String resourceKey) {
    String normalizedResourceKey = normalizeResourceKey(resourceKey);
    List<ResourceState> rows =
        jdbcTemplate.query(
            """
            SELECT resource_key, resource_name, resource_type, parent_key, route_path, icon, sort_order, enabled, built_in, description
            FROM iam_resource
            WHERE resource_key = ?
            """,
            (rs, rowNum) ->
                new ResourceState(
                    rs.getString("resource_key"),
                    rs.getString("resource_name"),
                    rs.getString("resource_type"),
                    rs.getString("parent_key"),
                    rs.getString("route_path"),
                    rs.getString("icon"),
                    rs.getInt("sort_order"),
                    rs.getBoolean("enabled"),
                    rs.getBoolean("built_in"),
                    rs.getString("description")),
            normalizedResourceKey);
    if (rows.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "resource not found");
    }
    return rows.get(0);
  }

  private List<String> normalizeResourceKeys(List<String> rawResourceKeys) {
    if (rawResourceKeys == null || rawResourceKeys.isEmpty()) {
      return List.of();
    }
    LinkedHashSet<String> set = new LinkedHashSet<>();
    for (String raw : rawResourceKeys) {
      if (raw == null || raw.isBlank()) {
        continue;
      }
      set.add(normalizeResourceKey(raw));
    }
    return new ArrayList<>(set);
  }

  private String normalizeRoleCode(String rawRoleCode) {
    String roleCode = normalizeRequired(rawRoleCode, "roleCode is required");
    String upper = roleCode.toUpperCase(Locale.ROOT);
    if (!upper.startsWith("ROLE_")) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "roleCode must start with ROLE_");
    }
    return upper;
  }

  private String normalizeResourceType(String rawResourceType) {
    String resourceType = normalizeRequired(rawResourceType, "resourceType is required");
    String normalized = resourceType.toUpperCase(Locale.ROOT);
    if (!"GROUP".equals(normalized) && !"PAGE".equals(normalized)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "resourceType must be GROUP or PAGE");
    }
    return normalized;
  }

  private String normalizeResourceKey(String rawResourceKey) {
    String resourceKey = normalizeRequired(rawResourceKey, "resourceKey is required");
    String normalized = resourceKey.toLowerCase(Locale.ROOT);
    if (!normalized.matches("^(group|page)\\.[a-z0-9][a-z0-9.-]{1,126}$")) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "resourceKey must match (group|page).xxx format");
    }
    return normalized;
  }

  private String normalizeOptionalKey(String rawKey) {
    if (rawKey == null || rawKey.isBlank()) {
      return null;
    }
    return rawKey.trim().toLowerCase(Locale.ROOT);
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

  private static class AdminResourceRowMapper implements RowMapper<AdminResourceRecord> {
    @Override
    public AdminResourceRecord mapRow(ResultSet rs, int rowNum) throws SQLException {
      AdminResourceRecord record = new AdminResourceRecord();
      record.setResourceKey(rs.getString("resource_key"));
      record.setResourceName(rs.getString("resource_name"));
      record.setResourceType(rs.getString("resource_type"));
      record.setParentKey(rs.getString("parent_key"));
      record.setRoutePath(rs.getString("route_path"));
      record.setIcon(rs.getString("icon"));
      record.setSortOrder(rs.getInt("sort_order"));
      record.setEnabled(rs.getBoolean("enabled"));
      record.setBuiltIn(rs.getBoolean("built_in"));
      record.setDescription(rs.getString("description"));
      return record;
    }
  }

  private record ResourceState(
      String resourceKey,
      String resourceName,
      String resourceType,
      String parentKey,
      String routePath,
      String icon,
      int sortOrder,
      boolean enabled,
      boolean builtIn,
      String description) {}
}
