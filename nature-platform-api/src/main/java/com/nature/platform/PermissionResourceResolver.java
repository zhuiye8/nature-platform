/**
 * @input Legacy permission codes from controllers/routes and canonical page resource key constants
 * @output resolveToResourceKey() mapper converting legacy action-level permissions to page-level RBAC resources
 * @position Compatibility adapter enabling phased migration from permission-code checks to resource-key checks
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.util.Locale;
import java.util.Map;

public final class PermissionResourceResolver {
  private static final Map<String, String> EXACT_MAP =
      Map.ofEntries(
          Map.entry(AdminPermissionCodes.USER_MANAGE, ResourceKeys.PAGE_ADMIN_USERS),
          Map.entry(AdminPermissionCodes.ROLE_MANAGE, ResourceKeys.PAGE_ADMIN_ROLES),
          Map.entry(AdminPermissionCodes.PERMISSION_VIEW, ResourceKeys.PAGE_ADMIN_RESOURCES),
          Map.entry(AdminPermissionCodes.WORKFLOW_MANAGE, ResourceKeys.PAGE_ADMIN_WORKFLOW),
          Map.entry(AdminPermissionCodes.NODE_RULE_MANAGE, ResourceKeys.PAGE_ADMIN_WORKFLOW),
          Map.entry(AdminPermissionCodes.AUDIT_VIEW, ResourceKeys.PAGE_ADMIN_AUDIT_LOGS),
          Map.entry(BusinessPermissionCodes.WORKFLOW_TASK_VIEW, ResourceKeys.PAGE_WORKFLOW),
          Map.entry(BusinessPermissionCodes.WORKFLOW_TASK_APPROVE, ResourceKeys.PAGE_WORKFLOW),
          Map.entry(BusinessPermissionCodes.WORKFLOW_TASK_REJECT, ResourceKeys.PAGE_WORKFLOW));

  private PermissionResourceResolver() {}

  public static String resolveToResourceKey(String permissionOrResourceCode) {
    if (permissionOrResourceCode == null || permissionOrResourceCode.isBlank()) {
      return "";
    }
    String normalized = permissionOrResourceCode.trim().toLowerCase(Locale.ROOT);
    if ("page.contracts".equals(normalized)) {
      return ResourceKeys.PAGE_CONTRACT_SUBMISSIONS;
    }
    if (normalized.startsWith("page.") || normalized.startsWith("group.")) {
      return normalized;
    }
    String exactMatch = EXACT_MAP.get(normalized);
    if (exactMatch != null) {
      return exactMatch;
    }
    if (normalized.startsWith("customer:")) {
      return ResourceKeys.PAGE_CUSTOMERS;
    }
    if (normalized.startsWith("contract:")) {
      if (BusinessPermissionCodes.CONTRACT_ARCHIVE.equals(normalized)) {
        return ResourceKeys.PAGE_CONTRACT_ARCHIVES;
      }
      return ResourceKeys.PAGE_CONTRACT_SUBMISSIONS;
    }
    if (normalized.startsWith("project-register:")) {
      return ResourceKeys.PAGE_PROJECT_REGISTERS;
    }
    if (normalized.startsWith("police-register:")) {
      return ResourceKeys.PAGE_POLICE_REGISTERS;
    }
    if (normalized.startsWith("on-site-assessment:")) {
      return ResourceKeys.PAGE_ON_SITE_ASSESSMENTS;
    }
    if (normalized.startsWith("quality-review:")) {
      return ResourceKeys.PAGE_QUALITY_REVIEWS;
    }
    if (normalized.startsWith("report-tech-review:")) {
      return ResourceKeys.PAGE_REPORT_TECH_REVIEWS;
    }
    if (normalized.startsWith("report-content-review:")) {
      return ResourceKeys.PAGE_REPORT_CONTENT_REVIEWS;
    }
    if (normalized.startsWith("report-compile-assignment:")) {
      return ResourceKeys.PAGE_REPORT_COMPILE_ASSIGNMENTS;
    }
    if (normalized.startsWith("report-compile-submission:")) {
      return ResourceKeys.PAGE_REPORT_COMPILE_SUBMISSIONS;
    }
    if (normalized.startsWith("report-final-review:")) {
      return ResourceKeys.PAGE_REPORT_FINAL_REVIEWS;
    }
    if (normalized.startsWith("material-archive:")) {
      return ResourceKeys.PAGE_MATERIAL_ARCHIVES;
    }
    return normalized;
  }
}
