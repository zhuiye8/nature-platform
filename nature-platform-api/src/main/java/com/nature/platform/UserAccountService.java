/**
 * @input JdbcTemplate with user_account/user_role tables; authentication and notification dependencies
 * @output User lookup, role lookup, and recipient selection methods for auth/rbac/notifications
 * @position Identity persistence service bridging account and role mappings to application logic
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;

@Service
public class UserAccountService {
  public static final String ROLE_USER = "ROLE_USER";
  public static final String ROLE_SUPER_ADMIN = "ROLE_SUPER_ADMIN";
  public static final String ROLE_REVIEWER = "ROLE_REVIEWER";
  public static final String ROLE_REVIEW_TECH = "ROLE_REVIEW_TECH";
  public static final String ROLE_REVIEW_CONTENT_TECH = "ROLE_REVIEW_CONTENT_TECH";
  public static final String ROLE_REVIEW_CONTENT_MANAGEMENT = "ROLE_REVIEW_CONTENT_MANAGEMENT";
  public static final String ROLE_REVIEW_CONTENT_NETWORK = "ROLE_REVIEW_CONTENT_NETWORK";
  @Deprecated public static final String ROLE_REVIEW_CONTENT_A = ROLE_REVIEW_CONTENT_TECH;
  @Deprecated public static final String ROLE_REVIEW_CONTENT_B = ROLE_REVIEW_CONTENT_MANAGEMENT;
  @Deprecated public static final String ROLE_REVIEW_CONTENT_C = ROLE_REVIEW_CONTENT_NETWORK;

  private final JdbcTemplate jdbcTemplate;

  public UserAccountService(JdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
  }

  public Optional<UserAccount> findByUsername(String username) {
    List<UserAccount> rows =
        jdbcTemplate.query(
            """
            SELECT id, username, password_hash, display_name, enabled
            FROM user_account
            WHERE username = ?
            LIMIT 1
            """,
            new UserAccountRowMapper(),
            username);
    return rows.stream().findFirst();
  }

  public List<String> listEnabledUsernames() {
    return jdbcTemplate.queryForList(
        """
        SELECT username
        FROM user_account
        WHERE enabled = 1
        ORDER BY id ASC
        """,
        String.class);
  }

  public List<String> listRoles(String username) {
    if (username == null || username.isBlank()) {
      return List.of(ROLE_USER);
    }
    List<String> rows =
        jdbcTemplate.queryForList(
            """
            SELECT DISTINCT ur.role_code
            FROM user_account u
            JOIN user_role ur ON ur.username = u.username
            WHERE u.enabled = 1
              AND u.username = ?
            ORDER BY ur.role_code ASC
            """,
            String.class,
            username.trim());
    LinkedHashSet<String> roleSet = new LinkedHashSet<>();
    roleSet.add(ROLE_USER);
    roleSet.addAll(rows);
    return new ArrayList<>(roleSet);
  }

  public boolean hasRole(String username, String roleCode) {
    if (roleCode == null || roleCode.isBlank()) {
      return false;
    }
    return listRoles(username).contains(roleCode.trim());
  }

  public boolean hasAnyRole(String username, List<String> roleCodes) {
    if (roleCodes == null || roleCodes.isEmpty()) {
      return false;
    }
    Set<String> roleSet = new LinkedHashSet<>(listRoles(username));
    for (String code : roleCodes) {
      if (code != null && roleSet.contains(code.trim())) {
        return true;
      }
    }
    return false;
  }

  public List<String> listEnabledUsernamesByRoles(List<String> roleCodes) {
    if (roleCodes == null || roleCodes.isEmpty()) {
      return listEnabledUsernames();
    }
    List<String> normalized = roleCodes.stream().filter(code -> code != null && !code.isBlank()).toList();
    if (normalized.isEmpty()) {
      return listEnabledUsernames();
    }
    String placeholders = String.join(",", java.util.Collections.nCopies(normalized.size(), "?"));
    String sql =
        """
        SELECT DISTINCT u.username
        FROM user_account u
        JOIN user_role ur ON ur.username = u.username
        WHERE u.enabled = 1
          AND ur.role_code IN (%s)
        ORDER BY u.username ASC
        """
            .formatted(placeholders);
    return jdbcTemplate.queryForList(sql, String.class, normalized.toArray());
  }

  public record UserAccount(long id, String username, String passwordHash, String displayName, boolean enabled) {}

  private static class UserAccountRowMapper implements RowMapper<UserAccount> {
    @Override
    public UserAccount mapRow(ResultSet rs, int rowNum) throws SQLException {
      return new UserAccount(
          rs.getLong("id"),
          rs.getString("username"),
          rs.getString("password_hash"),
          rs.getString("display_name"),
          rs.getBoolean("enabled"));
    }
  }
}
