/**
 * @input Role data-scope literals used by IAM role settings and runtime data filtering rules
 * @output RoleDataScopeTypes constants with validation helper for SELF/DEPT/DEPT_AND_SUB/CUSTOM/ALL
 * @position Authorization vocabulary layer for role-based data-scope decisions across admin and business services
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.util.Set;

public final class RoleDataScopeTypes {
  public static final String SELF = "SELF";
  public static final String DEPT = "DEPT";
  public static final String DEPT_AND_SUB = "DEPT_AND_SUB";
  public static final String CUSTOM = "CUSTOM";
  public static final String ALL = "ALL";

  private static final Set<String> VALID = Set.of(SELF, DEPT, DEPT_AND_SUB, CUSTOM, ALL);

  private RoleDataScopeTypes() {}

  public static boolean isValid(String value) {
    return value != null && VALID.contains(value);
  }
}
