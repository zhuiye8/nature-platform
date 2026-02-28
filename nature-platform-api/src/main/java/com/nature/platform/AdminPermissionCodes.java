/**
 * @input Admin-module permission semantics for IAM/workflow/audit operations
 * @output AdminPermissionCodes resource:action constants shared by access checks, seed data, and controller guards
 * @position Authorization vocabulary layer for management APIs
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

public final class AdminPermissionCodes {
  public static final String USER_MANAGE = "user:manage";
  public static final String ROLE_MANAGE = "role:manage";
  public static final String PERMISSION_VIEW = "permission:view";
  public static final String WORKFLOW_MANAGE = "workflow:manage";
  public static final String NODE_RULE_MANAGE = "workflow-node-rule:manage";
  public static final String AUDIT_VIEW = "audit:view";

  private AdminPermissionCodes() {}
}
