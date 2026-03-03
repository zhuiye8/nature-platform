/**
 * @input JdbcTemplate user/role persistence, AdminAuditService logger, and admin user DTO contracts
 * @output User account list/create/update operations with role binding and super-admin safety checks
 * @position IAM application service managing user lifecycle and role assignments
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
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AdminUserService {
  private final JdbcTemplate jdbcTemplate;
  private final AdminAuditService adminAuditService;
  private final AdminDepartmentService adminDepartmentService;

  public AdminUserService(
      JdbcTemplate jdbcTemplate,
      AdminAuditService adminAuditService,
      AdminDepartmentService adminDepartmentService) {
    this.jdbcTemplate = jdbcTemplate;
    this.adminAuditService = adminAuditService;
    this.adminDepartmentService = adminDepartmentService;
  }

  public List<AdminUserRecord> listUsers() {
    List<AdminUserRecord> rows =
        jdbcTemplate.query(
            """
            SELECT u.username, u.display_name, u.enabled, u.source_type, u.dept_id, u.ding_user_id,
                   d.dept_name
            FROM user_account u
            LEFT JOIN iam_department d ON d.id = u.dept_id
            ORDER BY u.id ASC
            """,
            new AdminUserRowMapper());
    bindRoles(rows);
    return rows;
  }

  public AdminUserRecord detail(String username) {
    String normalizedUsername = normalizeUsername(username);
    List<AdminUserRecord> rows =
        jdbcTemplate.query(
            """
            SELECT u.username, u.display_name, u.enabled, u.source_type, u.dept_id, u.ding_user_id,
                   d.dept_name
            FROM user_account u
            LEFT JOIN iam_department d ON d.id = u.dept_id
            WHERE u.username = ?
            """,
            new AdminUserRowMapper(),
            normalizedUsername);
    if (rows.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "user not found");
    }
    bindRoles(rows);
    return rows.get(0);
  }

  @Transactional
  public AdminUserRecord create(AdminUserCreateRequest request, String operator) {
    String username = normalizeUsername(request.getUsername());
    String displayName = normalizeRequired(request.getDisplayName(), "displayName is required");
    String password = normalizeRequired(request.getPassword(), "password is required");
    boolean enabled = request.getEnabled() == null || request.getEnabled();
    Long deptId = normalizeDeptId(request.getDeptId());
    List<String> roleCodes = normalizeRoleCodes(request.getRoles(), true);

    ensureUserNotExists(username);
    ensureRoleCodesExist(roleCodes);
    adminDepartmentService.ensureDepartmentExists(deptId);

    jdbcTemplate.update(
        """
        INSERT INTO user_account (username, password_hash, display_name, enabled, source_type, dept_id)
        VALUES (?, ?, ?, ?, 'LOCAL', ?)
        """,
        username,
        password,
        displayName,
        enabled ? 1 : 0,
        deptId);

    replaceUserRoles(username, roleCodes);
    Map<String, Object> createDetail = new LinkedHashMap<>();
    createDetail.put("displayName", displayName);
    createDetail.put("enabled", enabled);
    createDetail.put("deptId", deptId);
    createDetail.put("roles", roleCodes);
    adminAuditService.logAction(
        operator,
        "ADMIN_USER_CREATE",
        "USER",
        username,
        createDetail);
    return detail(username);
  }

  @Transactional
  public AdminUserRecord update(String username, AdminUserUpdateRequest request, String operator) {
    String normalizedUsername = normalizeUsername(username);
    UserState oldState = loadUserState(normalizedUsername);

    String displayName = normalizeRequired(request.getDisplayName(), "displayName is required");
    String password = normalizeOptional(request.getPassword());
    boolean enabled = request.getEnabled();
    Long deptId = normalizeDeptId(request.getDeptId());
    List<String> roleCodes = normalizeRoleCodes(request.getRoles(), true);
    ensureRoleCodesExist(roleCodes);
    adminDepartmentService.ensureDepartmentExists(deptId);

    ensureSuperAdminStillExists(
        oldState.username(), oldState.enabled(), oldState.roles(), enabled, roleCodes);

    if (password == null) {
      jdbcTemplate.update(
          """
          UPDATE user_account
          SET display_name = ?, enabled = ?, dept_id = ?
          WHERE username = ?
          """,
          displayName,
          enabled ? 1 : 0,
          deptId,
          normalizedUsername);
    } else {
      jdbcTemplate.update(
          """
          UPDATE user_account
          SET display_name = ?, password_hash = ?, enabled = ?, dept_id = ?
          WHERE username = ?
          """,
          displayName,
          password,
          enabled ? 1 : 0,
          deptId,
          normalizedUsername);
    }

    replaceUserRoles(normalizedUsername, roleCodes);
    Map<String, Object> updateDetail = new LinkedHashMap<>();
    updateDetail.put("displayName", displayName);
    updateDetail.put("enabled", enabled);
    updateDetail.put("deptId", deptId);
    updateDetail.put("roles", roleCodes);
    updateDetail.put("passwordUpdated", password != null);
    adminAuditService.logAction(
        operator,
        "ADMIN_USER_UPDATE",
        "USER",
        normalizedUsername,
        updateDetail);
    return detail(normalizedUsername);
  }

  public List<String> listAllRoleCodes() {
    return jdbcTemplate.queryForList(
        """
        SELECT role_code
        FROM iam_role
        ORDER BY role_code ASC
        """,
        String.class);
  }

  private void bindRoles(List<AdminUserRecord> users) {
    if (users == null || users.isEmpty()) {
      return;
    }
    List<String> usernames = users.stream().map(AdminUserRecord::getUsername).toList();
    String placeholders = String.join(",", Collections.nCopies(usernames.size(), "?"));
    String sql =
        """
        SELECT username, role_code
        FROM user_role
        WHERE username IN (%s)
        ORDER BY username ASC, sort_order ASC, role_code ASC
        """
            .formatted(placeholders);

    Map<String, List<String>> roleMap =
        jdbcTemplate.query(sql, (rs, rowNum) -> new UserRoleRef(rs.getString("username"), rs.getString("role_code")), usernames.toArray())
            .stream()
            .collect(
                Collectors.groupingBy(
                    UserRoleRef::username,
                    Collectors.mapping(UserRoleRef::roleCode, Collectors.toList())));

    for (AdminUserRecord user : users) {
      List<String> boundRoles = new ArrayList<>();
      boundRoles.add(UserAccountService.ROLE_USER);
      boundRoles.addAll(roleMap.getOrDefault(user.getUsername(), List.of()));
      user.setRoles(new ArrayList<>(new LinkedHashSet<>(boundRoles)));
    }
  }

  private void ensureSuperAdminStillExists(
      String username,
      boolean oldEnabled,
      List<String> oldRoles,
      boolean newEnabled,
      List<String> newRoles) {
    boolean oldIsEnabledSuperAdmin = oldEnabled && oldRoles.contains(UserAccountService.ROLE_SUPER_ADMIN);
    boolean newIsEnabledSuperAdmin = newEnabled && newRoles.contains(UserAccountService.ROLE_SUPER_ADMIN);
    if (!oldIsEnabledSuperAdmin || newIsEnabledSuperAdmin) {
      return;
    }

    Integer enabledSuperAdminCount =
        jdbcTemplate.queryForObject(
            """
            SELECT COUNT(1)
            FROM user_account u
            JOIN user_role ur ON ur.username = u.username
            WHERE u.enabled = 1
              AND ur.role_code = ?
            """,
            Integer.class,
            UserAccountService.ROLE_SUPER_ADMIN);
    if (enabledSuperAdminCount != null && enabledSuperAdminCount <= 1) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "at least one enabled super admin must remain");
    }
  }

  private void replaceUserRoles(String username, List<String> roleCodes) {
    jdbcTemplate.update("DELETE FROM user_role WHERE username = ?", username);
    for (int i = 0; i < roleCodes.size(); i++) {
      String roleCode = roleCodes.get(i);
      jdbcTemplate.update(
          """
          INSERT INTO user_role (username, role_code, sort_order)
          VALUES (?, ?, ?)
          """,
          username,
          roleCode,
          i * 10);
    }
  }

  private void ensureRoleCodesExist(List<String> roleCodes) {
    if (roleCodes.isEmpty()) {
      return;
    }
    String placeholders = String.join(",", Collections.nCopies(roleCodes.size(), "?"));
    String sql = "SELECT role_code FROM iam_role WHERE role_code IN (%s)".formatted(placeholders);
    Set<String> existing = new LinkedHashSet<>(jdbcTemplate.queryForList(sql, String.class, roleCodes.toArray()));
    List<String> missing = roleCodes.stream().filter(code -> !existing.contains(code)).toList();
    if (!missing.isEmpty()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "unknown role codes: " + String.join(",", missing));
    }
  }

  private void ensureUserNotExists(String username) {
    Integer count =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(1) FROM user_account WHERE username = ?", Integer.class, username);
    if (count != null && count > 0) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "username already exists");
    }
  }

  private UserState loadUserState(String username) {
    List<UserState> rows =
        jdbcTemplate.query(
            """
            SELECT username, enabled
            FROM user_account
            WHERE username = ?
            """,
            (rs, rowNum) ->
                new UserState(
                    rs.getString("username"),
                    rs.getBoolean("enabled"),
                    jdbcTemplate.queryForList(
                        "SELECT role_code FROM user_role WHERE username = ? ORDER BY sort_order ASC, role_code ASC",
                        String.class,
                        username)),
            username);
    if (rows.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "user not found");
    }
    return rows.get(0);
  }

  private List<String> normalizeRoleCodes(List<String> rawCodes, boolean ensureUserRole) {
    LinkedHashSet<String> set = new LinkedHashSet<>();
    if (ensureUserRole) {
      set.add(UserAccountService.ROLE_USER);
    }
    if (rawCodes != null) {
      for (String rawCode : rawCodes) {
        if (rawCode == null || rawCode.isBlank()) {
          continue;
        }
        set.add(rawCode.trim().toUpperCase(Locale.ROOT));
      }
    }
    return new ArrayList<>(set);
  }

  private String normalizeUsername(String rawUsername) {
    String normalized = normalizeRequired(rawUsername, "username is required");
    if (!normalized.matches("^[a-zA-Z0-9._-]{3,64}$")) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "username must be 3-64 chars of letters/numbers/._-");
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

  private Long normalizeDeptId(Long deptId) {
    if (deptId == null || deptId <= 0) {
      return null;
    }
    return deptId;
  }

  private static class AdminUserRowMapper implements RowMapper<AdminUserRecord> {
    @Override
    public AdminUserRecord mapRow(ResultSet rs, int rowNum) throws SQLException {
      AdminUserRecord record = new AdminUserRecord();
      record.setUsername(rs.getString("username"));
      record.setDisplayName(rs.getString("display_name"));
      record.setEnabled(rs.getBoolean("enabled"));
      record.setSourceType(rs.getString("source_type"));
      record.setDeptId(rs.getObject("dept_id", Long.class));
      record.setDeptName(rs.getString("dept_name"));
      record.setDingUserId(rs.getString("ding_user_id"));
      return record;
    }
  }

  private record UserRoleRef(String username, String roleCode) {}

  private record UserState(String username, boolean enabled, List<String> roles) {}
}
