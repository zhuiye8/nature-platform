/**
 * @input UserAccountService role queries, PermissionResourceResolver mapping, and JdbcTemplate role-resource lookups
 * @output requirePermission()/requireResource() guards with listResources()/listPermissions() aggregation for profile bootstrap
 * @position Authorization service that normalizes legacy permission checks onto page-level resource RBAC mappings
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AdminAccessService {
  private final UserAccountService userAccountService;
  private final JdbcTemplate jdbcTemplate;

  public AdminAccessService(UserAccountService userAccountService, JdbcTemplate jdbcTemplate) {
    this.userAccountService = userAccountService;
    this.jdbcTemplate = jdbcTemplate;
  }

  public void requirePermission(String username, String permissionCode) {
    String resolvedResourceKey = PermissionResourceResolver.resolveToResourceKey(permissionCode);
    if (!hasResource(username, resolvedResourceKey)) {
      throw new ResponseStatusException(
          HttpStatus.FORBIDDEN, "current user has no permission: " + permissionCode);
    }
  }

  public boolean hasPermission(String username, String permissionCode) {
    String resolvedResourceKey = PermissionResourceResolver.resolveToResourceKey(permissionCode);
    return hasResource(username, resolvedResourceKey);
  }

  public void requireResource(String username, String resourceKey) {
    if (!hasResource(username, resourceKey)) {
      throw new ResponseStatusException(
          HttpStatus.FORBIDDEN, "current user has no resource: " + resourceKey);
    }
  }

  public boolean hasResource(String username, String resourceKey) {
    if (resourceKey == null || resourceKey.isBlank()) {
      return false;
    }
    String normalizedResourceKey = resourceKey.trim().toLowerCase(Locale.ROOT);
    if (userAccountService.hasRole(username, UserAccountService.ROLE_SUPER_ADMIN)) {
      return true;
    }

    Set<String> roles = new LinkedHashSet<>(userAccountService.listRoles(username));
    roles.removeIf(item -> item == null || item.isBlank());
    if (roles.isEmpty()) {
      return false;
    }

    List<String> normalizedRoles = new ArrayList<>(roles);
    String placeholders = String.join(",", Collections.nCopies(normalizedRoles.size(), "?"));
    String sql =
        """
        SELECT COUNT(1)
        FROM iam_role_resource rr
        JOIN iam_resource r ON r.resource_key = rr.resource_key
        WHERE rr.resource_key = ?
          AND rr.role_code IN (%s)
          AND r.enabled = 1
        """
            .formatted(placeholders);

    List<Object> params = new ArrayList<>();
    params.add(normalizedResourceKey);
    params.addAll(normalizedRoles);
    Integer count = jdbcTemplate.queryForObject(sql, Integer.class, params.toArray());
    return count != null && count > 0;
  }

  public List<String> listPermissions(String username) {
    return listResources(username);
  }

  public List<String> listResources(String username) {
    if (userAccountService.hasRole(username, UserAccountService.ROLE_SUPER_ADMIN)) {
      return jdbcTemplate.queryForList(
          """
          SELECT resource_key
          FROM iam_resource
          WHERE enabled = 1
          ORDER BY sort_order ASC, resource_key ASC
          """,
          String.class);
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
        SELECT DISTINCT rr.resource_key
        FROM iam_role_resource rr
        JOIN iam_resource r ON r.resource_key = rr.resource_key
        WHERE rr.role_code IN (%s)
          AND r.enabled = 1
        ORDER BY rr.resource_key ASC
        """
            .formatted(placeholders);
    return jdbcTemplate.queryForList(sql, String.class, normalizedRoles.toArray());
  }
}
