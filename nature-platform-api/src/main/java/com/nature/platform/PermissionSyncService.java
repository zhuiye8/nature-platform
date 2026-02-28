/**
 * @input JdbcTemplate IAM tables, BuiltInPermissionRegistry descriptors, and AdminAuditService logger
 * @output Built-in permission auto-sync with optional text overwrite and default role-permission grants
 * @position IAM synchronization service ensuring permission dictionary can evolve without migration-based data seeding
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PermissionSyncService {
  private static final List<String> WORKFLOW_REVIEWER_ROLES =
      List.of(
          UserAccountService.ROLE_REVIEWER,
          UserAccountService.ROLE_REVIEW_TECH,
          UserAccountService.ROLE_REVIEW_CONTENT_TECH,
          UserAccountService.ROLE_REVIEW_CONTENT_MANAGEMENT,
          UserAccountService.ROLE_REVIEW_CONTENT_NETWORK);

  private static final List<String> WORKFLOW_REVIEWER_PERMISSIONS =
      List.of(
          BusinessPermissionCodes.WORKFLOW_TASK_VIEW,
          BusinessPermissionCodes.WORKFLOW_TASK_APPROVE,
          BusinessPermissionCodes.WORKFLOW_TASK_REJECT);

  private final JdbcTemplate jdbcTemplate;
  private final BuiltInPermissionRegistry builtInPermissionRegistry;
  private final AdminAuditService adminAuditService;

  public PermissionSyncService(
      JdbcTemplate jdbcTemplate,
      BuiltInPermissionRegistry builtInPermissionRegistry,
      AdminAuditService adminAuditService) {
    this.jdbcTemplate = jdbcTemplate;
    this.builtInPermissionRegistry = builtInPermissionRegistry;
    this.adminAuditService = adminAuditService;
  }

  @Transactional
  public PermissionSyncResult syncBuiltInPermissions(boolean overwriteText, String operator) {
    int inserted = 0;
    int updated = 0;
    int superAdminGrantCount = 0;
    int reviewerGrantCount = 0;

    for (BuiltInPermissionSpec spec : builtInPermissionRegistry.listAll()) {
      String permissionCode = normalizePermissionCode(spec.permissionCode());
      Integer existsCount =
          jdbcTemplate.queryForObject(
              "SELECT COUNT(1) FROM iam_permission WHERE permission_code = ?",
              Integer.class,
              permissionCode);
      boolean exists = existsCount != null && existsCount > 0;
      if (!exists) {
        jdbcTemplate.update(
            """
            INSERT INTO iam_permission (
              permission_code, permission_name, category, description, enabled, built_in
            ) VALUES (?, ?, ?, ?, 1, 1)
            """,
            permissionCode,
            normalizeRequired(spec.permissionName()),
            normalizeRequired(spec.category()),
            normalizeOptional(spec.description()));
        inserted++;
      } else if (overwriteText) {
        jdbcTemplate.update(
            """
            UPDATE iam_permission
            SET permission_name = ?, category = ?, description = ?, built_in = 1
            WHERE permission_code = ?
            """,
            normalizeRequired(spec.permissionName()),
            normalizeRequired(spec.category()),
            normalizeOptional(spec.description()),
            permissionCode);
        updated++;
      } else {
        Integer updatedRows =
            jdbcTemplate.update(
                """
                UPDATE iam_permission
                SET built_in = 1
                WHERE permission_code = ? AND built_in = 0
                """,
                permissionCode);
        if (updatedRows != null && updatedRows > 0) {
          updated += updatedRows;
        }
      }

      superAdminGrantCount +=
          jdbcTemplate.update(
              """
              INSERT IGNORE INTO iam_role_permission (role_code, permission_code)
              VALUES (?, ?)
              """,
              UserAccountService.ROLE_SUPER_ADMIN,
              permissionCode);
    }

    for (String roleCode : WORKFLOW_REVIEWER_ROLES) {
      for (String permissionCode : WORKFLOW_REVIEWER_PERMISSIONS) {
        reviewerGrantCount +=
            jdbcTemplate.update(
                """
                INSERT IGNORE INTO iam_role_permission (role_code, permission_code)
                VALUES (?, ?)
                """,
                roleCode,
                permissionCode);
      }
    }

    PermissionSyncResult result =
        new PermissionSyncResult(inserted, updated, superAdminGrantCount, reviewerGrantCount);
    adminAuditService.logAction(
        operator,
        "ADMIN_PERMISSION_SYNC",
        "PERMISSION",
        "BUILT_IN",
        Map.of(
            "inserted", inserted,
            "updated", updated,
            "superAdminGrantCount", superAdminGrantCount,
            "reviewerGrantCount", reviewerGrantCount,
            "overwriteText", overwriteText));
    return result;
  }

  private String normalizePermissionCode(String raw) {
    return normalizeRequired(raw).toLowerCase(Locale.ROOT);
  }

  private String normalizeRequired(String raw) {
    if (raw == null || raw.isBlank()) {
      throw new IllegalArgumentException("permission registry contains blank field");
    }
    return raw.trim();
  }

  private String normalizeOptional(String raw) {
    if (raw == null || raw.isBlank()) {
      return null;
    }
    return raw.trim();
  }

  public record PermissionSyncResult(
      int inserted, int updated, int superAdminGrantCount, int reviewerGrantCount) {}
}
