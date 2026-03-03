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
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

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
            SELECT id, username, password_hash, display_name, enabled, dept_id, must_change_password, source_type, ding_user_id, ding_union_id
            FROM user_account
            WHERE username = ?
            LIMIT 1
            """,
            new UserAccountRowMapper(),
            username);
    return rows.stream().findFirst();
  }

  public Optional<UserAccount> findByDingUnionId(String dingUnionId) {
    if (!StringUtils.hasText(dingUnionId)) {
      return Optional.empty();
    }
    List<UserAccount> rows =
        jdbcTemplate.query(
            """
            SELECT id, username, password_hash, display_name, enabled, dept_id, must_change_password, source_type, ding_user_id, ding_union_id
            FROM user_account
            WHERE ding_union_id = ?
            LIMIT 1
            """,
            new UserAccountRowMapper(),
            dingUnionId.trim());
    return rows.stream().findFirst();
  }

  public Optional<UserAccount> findByDingUserId(String dingUserId) {
    if (!StringUtils.hasText(dingUserId)) {
      return Optional.empty();
    }
    List<UserAccount> rows =
        jdbcTemplate.query(
            """
            SELECT id, username, password_hash, display_name, enabled, dept_id, must_change_password, source_type, ding_user_id, ding_union_id
            FROM user_account
            WHERE ding_user_id = ?
            LIMIT 1
            """,
            new UserAccountRowMapper(),
            dingUserId.trim());
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
            SELECT ur.role_code
            FROM user_account u
            JOIN user_role ur ON ur.username = u.username
            WHERE u.enabled = 1
              AND u.username = ?
            ORDER BY ur.sort_order ASC, ur.role_code ASC
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
    List<String> normalized =
        roleCodes.stream()
            .filter(code -> code != null && !code.isBlank())
            .map(code -> code.trim())
            .toList();
    if (normalized.isEmpty()) {
      return listEnabledUsernames();
    }
    String placeholders = String.join(",", java.util.Collections.nCopies(normalized.size(), "?"));
    String sql =
        """
        SELECT u.username
        FROM user_account u
        JOIN user_role ur ON ur.username = u.username
        WHERE u.enabled = 1
          AND ur.role_code IN (%s)
        GROUP BY u.username
        ORDER BY MIN(ur.sort_order) ASC, u.username ASC
        """
            .formatted(placeholders);
    return jdbcTemplate.queryForList(sql, String.class, normalized.toArray());
  }

  @Transactional
  public UserAccount upsertByDingTalk(DingTalkIdentity identity) {
    String dingUserId = normalizeOptional(identity.dingUserId());
    String dingUnionId = normalizeOptional(identity.dingUnionId());
    String displayName =
        StringUtils.hasText(identity.displayName())
            ? identity.displayName().trim()
            : (StringUtils.hasText(dingUserId) ? dingUserId : "钉钉用户");
    Long deptId = normalizeDeptId(identity.deptId());

    Optional<UserAccount> existing = Optional.empty();
    if (StringUtils.hasText(dingUnionId)) {
      existing = findByDingUnionId(dingUnionId);
    }
    if (existing.isEmpty() && StringUtils.hasText(dingUserId)) {
      existing = findByDingUserId(dingUserId);
    }

    if (existing.isPresent()) {
      UserAccount account = existing.get();
      jdbcTemplate.update(
          """
          UPDATE user_account
          SET display_name = ?,
              enabled = 1,
              source_type = 'DINGTALK',
              dept_id = ?,
              ding_user_id = ?,
              ding_union_id = ?,
              last_sync_at = NOW()
          WHERE id = ?
          """,
          displayName,
          deptId,
          dingUserId,
          dingUnionId,
          account.id());
      return findByUsername(account.username()).orElse(account);
    }

    String username = generateDingUsername(dingUserId, dingUnionId);
    String tempPassword = "TEMP_" + UUID.randomUUID().toString().replace("-", "");
    jdbcTemplate.update(
        """
        INSERT INTO user_account (
          username, password_hash, display_name, enabled, source_type, dept_id,
          ding_user_id, ding_union_id, last_sync_at, must_change_password
        ) VALUES (?, ?, ?, 1, 'DINGTALK', ?, ?, ?, NOW(), 1)
        """,
        username,
        tempPassword,
        displayName,
        deptId,
        dingUserId,
        dingUnionId);
    bindFirstLoginRoles(username, deptId);
    return findByUsername(username)
        .orElseThrow(() -> new IllegalStateException("dingtalk user create failed"));
  }

  public void updatePassword(String username, String newPassword) {
    if (!StringUtils.hasText(username) || !StringUtils.hasText(newPassword)) {
      throw new IllegalArgumentException("username and newPassword are required");
    }
    int updated =
        jdbcTemplate.update(
            """
            UPDATE user_account
            SET password_hash = ?, must_change_password = 0
            WHERE username = ?
            """,
            newPassword.trim(),
            username.trim());
    if (updated <= 0) {
      throw new IllegalArgumentException("user not found");
    }
  }

  private void bindFirstLoginRoles(String username, Long deptId) {
    List<String> roleCodes = new ArrayList<>();
    roleCodes.add(ROLE_USER);
    String departmentRole = loadDepartmentDefaultRole(deptId);
    if (StringUtils.hasText(departmentRole)) {
      roleCodes.add(departmentRole);
    }
    List<String> normalized = new ArrayList<>(new LinkedHashSet<>(roleCodes));
    for (int i = 0; i < normalized.size(); i++) {
      jdbcTemplate.update(
          """
          INSERT IGNORE INTO user_role (username, role_code, sort_order)
          VALUES (?, ?, ?)
          """,
          username,
          normalized.get(i),
          i * 10);
    }
  }

  private String loadDepartmentDefaultRole(Long deptId) {
    if (deptId == null || deptId <= 0) {
      return null;
    }
    List<String> rows =
        jdbcTemplate.queryForList(
            """
            SELECT d.default_role_code
            FROM iam_department d
            JOIN iam_role r ON r.role_code = d.default_role_code
            WHERE d.id = ?
              AND d.default_role_code IS NOT NULL
              AND d.default_role_code <> ''
              AND r.enabled = 1
            LIMIT 1
            """,
            String.class,
            deptId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private String generateDingUsername(String dingUserId, String dingUnionId) {
    List<String> candidates = new ArrayList<>();
    if (StringUtils.hasText(dingUserId)) {
      candidates.add("dd_" + normalizeUsernameToken(dingUserId));
    }
    if (StringUtils.hasText(dingUnionId)) {
      candidates.add("dd_" + normalizeUsernameToken(dingUnionId));
    }
    candidates.add("dd_user");

    for (String candidate : candidates) {
      String normalized = trimUsername(candidate);
      if (normalized.length() < 3) {
        continue;
      }
      if (!usernameExists(normalized)) {
        return normalized;
      }
      for (int i = 1; i <= 999; i++) {
        String withSeq = trimUsername(normalized + "_" + i);
        if (!usernameExists(withSeq)) {
          return withSeq;
        }
      }
    }
    throw new IllegalStateException("unable to generate username for dingtalk user");
  }

  private boolean usernameExists(String username) {
    Integer count =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(1) FROM user_account WHERE username = ?",
            Integer.class,
            username);
    return count != null && count > 0;
  }

  private String normalizeUsernameToken(String raw) {
    if (!StringUtils.hasText(raw)) {
      return "";
    }
    return raw.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9._-]", "_");
  }

  private String trimUsername(String raw) {
    if (raw.length() <= 64) {
      return raw;
    }
    return raw.substring(0, 64);
  }

  private Long normalizeDeptId(Long deptId) {
    if (deptId == null || deptId <= 0) {
      return null;
    }
    return deptId;
  }

  private String normalizeOptional(String raw) {
    if (!StringUtils.hasText(raw)) {
      return null;
    }
    return raw.trim();
  }

  public record UserAccount(
      long id,
      String username,
      String passwordHash,
      String displayName,
      boolean enabled,
      Long deptId,
      boolean mustChangePassword,
      String sourceType,
      String dingUserId,
      String dingUnionId) {}

  public record DingTalkIdentity(
      String dingUserId, String dingUnionId, String displayName, Long deptId) {}

  private static class UserAccountRowMapper implements RowMapper<UserAccount> {
    @Override
    public UserAccount mapRow(ResultSet rs, int rowNum) throws SQLException {
      return new UserAccount(
          rs.getLong("id"),
          rs.getString("username"),
          rs.getString("password_hash"),
          rs.getString("display_name"),
          rs.getBoolean("enabled"),
          rs.getObject("dept_id", Long.class),
          rs.getBoolean("must_change_password"),
          rs.getString("source_type"),
          rs.getString("ding_user_id"),
          rs.getString("ding_union_id"));
    }
  }
}
