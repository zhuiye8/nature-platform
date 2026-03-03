/**
 * @input JdbcTemplate role/department/user mappings and UserAccountService role helper
 * @output Data-scope profile resolution and creator-based list filtering for business-domain query services
 * @position Authorization data-range service implementing role data-scope and project-view-all visibility policy
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Function;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class UserDataScopeService {
  private final JdbcTemplate jdbcTemplate;
  private final UserAccountService userAccountService;

  public UserDataScopeService(JdbcTemplate jdbcTemplate, UserAccountService userAccountService) {
    this.jdbcTemplate = jdbcTemplate;
    this.userAccountService = userAccountService;
  }

  public <T> List<T> filterByCreator(
      String username,
      List<T> rows,
      Function<T, String> creatorExtractor,
      boolean allowProjectViewAllRole) {
    if (!StringUtils.hasText(username) || rows == null || rows.isEmpty()) {
      return rows == null ? List.of() : rows;
    }
    DataScopeProfile profile = resolveProfile(username);
    if (profile.allowAll() || (allowProjectViewAllRole && profile.projectViewAll())) {
      return rows;
    }

    Set<String> allowedCreators = new LinkedHashSet<>();
    allowedCreators.add(username);
    if (!profile.allowedDeptIds().isEmpty()) {
      allowedCreators.addAll(loadEnabledUsernamesByDeptIds(profile.allowedDeptIds()));
    }

    if (allowedCreators.isEmpty()) {
      return List.of();
    }

    List<T> filtered = new ArrayList<>();
    for (T row : rows) {
      String creator = creatorExtractor.apply(row);
      if (creator != null && allowedCreators.contains(creator)) {
        filtered.add(row);
      }
    }
    return filtered;
  }

  public boolean canAccessByCreator(
      String username, String creator, boolean allowProjectViewAllRole) {
    if (!StringUtils.hasText(username) || !StringUtils.hasText(creator)) {
      return false;
    }
    if (username.equals(creator)) {
      return true;
    }
    DataScopeProfile profile = resolveProfile(username);
    if (profile.allowAll() || (allowProjectViewAllRole && profile.projectViewAll())) {
      return true;
    }
    if (profile.allowedDeptIds().isEmpty()) {
      return false;
    }
    return loadEnabledUsernamesByDeptIds(profile.allowedDeptIds()).contains(creator);
  }

  public DataScopeProfile resolveProfile(String username) {
    if (!StringUtils.hasText(username)) {
      return new DataScopeProfile(false, false, Set.of());
    }
    if (userAccountService.hasRole(username, UserAccountService.ROLE_SUPER_ADMIN)) {
      return new DataScopeProfile(true, true, Set.of());
    }

    List<RoleScopeRow> roleScopes = loadRoleScopes(username);
    if (roleScopes.isEmpty()) {
      return new DataScopeProfile(false, false, Set.of());
    }

    boolean projectViewAll = roleScopes.stream().anyMatch(RoleScopeRow::projectViewAll);
    boolean allowAll = roleScopes.stream().anyMatch(row -> RoleDataScopeTypes.ALL.equals(row.dataScope()));
    if (allowAll) {
      return new DataScopeProfile(true, projectViewAll, Set.of());
    }

    Long selfDeptId = loadUserDeptId(username);
    Set<Long> allowedDeptIds = new LinkedHashSet<>();
    for (RoleScopeRow row : roleScopes) {
      String scope = row.dataScope();
      if (RoleDataScopeTypes.DEPT.equals(scope)) {
        if (selfDeptId != null && selfDeptId > 0) {
          allowedDeptIds.add(selfDeptId);
        }
      } else if (RoleDataScopeTypes.DEPT_AND_SUB.equals(scope)) {
        if (selfDeptId != null && selfDeptId > 0) {
          allowedDeptIds.add(selfDeptId);
          allowedDeptIds.addAll(loadDescendantDeptIds(Set.of(selfDeptId)));
        }
      } else if (RoleDataScopeTypes.CUSTOM.equals(scope)) {
        allowedDeptIds.addAll(loadCustomDeptIdsByRole(row.roleCode()));
      }
    }

    return new DataScopeProfile(false, projectViewAll, allowedDeptIds);
  }

  private List<RoleScopeRow> loadRoleScopes(String username) {
    return jdbcTemplate.query(
        """
        SELECT DISTINCT r.role_code, r.data_scope, r.project_view_all
        FROM iam_role r
        JOIN user_role ur ON ur.role_code = r.role_code
        WHERE ur.username = ?
          AND r.enabled = 1
        """,
        (rs, rowNum) ->
            new RoleScopeRow(
                rs.getString("role_code"),
                normalizeDataScope(rs.getString("data_scope")),
                rs.getBoolean("project_view_all")),
        username);
  }

  private String normalizeDataScope(String raw) {
    if (!StringUtils.hasText(raw)) {
      return RoleDataScopeTypes.SELF;
    }
    String normalized = raw.trim().toUpperCase();
    return RoleDataScopeTypes.isValid(normalized) ? normalized : RoleDataScopeTypes.SELF;
  }

  private Long loadUserDeptId(String username) {
    List<Long> rows =
        jdbcTemplate.query(
            "SELECT dept_id FROM user_account WHERE username = ? LIMIT 1",
            (rs, rowNum) -> {
              long value = rs.getLong("dept_id");
              return rs.wasNull() ? null : value;
            },
            username);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private Set<Long> loadCustomDeptIdsByRole(String roleCode) {
    if (!StringUtils.hasText(roleCode)) {
      return Set.of();
    }
    return new LinkedHashSet<>(
        jdbcTemplate.queryForList(
            "SELECT dept_id FROM iam_role_data_scope_dept WHERE role_code = ?",
            Long.class,
            roleCode));
  }

  private Set<Long> loadDescendantDeptIds(Set<Long> seedDeptIds) {
    if (seedDeptIds == null || seedDeptIds.isEmpty()) {
      return Set.of();
    }
    Set<Long> visited = new LinkedHashSet<>();
    List<Long> frontier = new ArrayList<>(seedDeptIds);
    while (!frontier.isEmpty()) {
      String placeholders = String.join(",", Collections.nCopies(frontier.size(), "?"));
      String sql =
          "SELECT id FROM iam_department WHERE parent_id IN (%s)".formatted(placeholders);
      List<Long> next = jdbcTemplate.queryForList(sql, Long.class, frontier.toArray());
      frontier = new ArrayList<>();
      for (Long deptId : next) {
        if (deptId != null && visited.add(deptId)) {
          frontier.add(deptId);
        }
      }
    }
    return visited;
  }

  private Set<String> loadEnabledUsernamesByDeptIds(Set<Long> deptIds) {
    if (deptIds == null || deptIds.isEmpty()) {
      return Set.of();
    }
    String placeholders = String.join(",", Collections.nCopies(deptIds.size(), "?"));
    String sql =
        """
        SELECT username
        FROM user_account
        WHERE enabled = 1
          AND dept_id IN (%s)
        """
            .formatted(placeholders);
    return new LinkedHashSet<>(jdbcTemplate.queryForList(sql, String.class, deptIds.toArray()));
  }

  public record DataScopeProfile(boolean allowAll, boolean projectViewAll, Set<Long> allowedDeptIds) {}

  private record RoleScopeRow(String roleCode, String dataScope, boolean projectViewAll) {}
}
