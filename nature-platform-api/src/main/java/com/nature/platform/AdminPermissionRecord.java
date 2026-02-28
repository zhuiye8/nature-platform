/**
 * @input iam_permission and iam_role_permission projection data including enabled and built-in flags
 * @output AdminPermissionRecord DTO for permission catalog CRUD APIs and role mapping views
 * @position IAM read model for permission metadata consumed by management UI and startup sync
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

public class AdminPermissionRecord {
  private String permissionCode;
  private String permissionName;
  private String category;
  private String description;
  private boolean enabled;
  private boolean builtIn;

  public String getPermissionCode() {
    return permissionCode;
  }

  public void setPermissionCode(String permissionCode) {
    this.permissionCode = permissionCode;
  }

  public String getPermissionName() {
    return permissionName;
  }

  public void setPermissionName(String permissionName) {
    this.permissionName = permissionName;
  }

  public String getCategory() {
    return category;
  }

  public void setCategory(String category) {
    this.category = category;
  }

  public String getDescription() {
    return description;
  }

  public void setDescription(String description) {
    this.description = description;
  }

  public boolean isEnabled() {
    return enabled;
  }

  public void setEnabled(boolean enabled) {
    this.enabled = enabled;
  }

  public boolean isBuiltIn() {
    return builtIn;
  }

  public void setBuiltIn(boolean builtIn) {
    this.builtIn = builtIn;
  }
}
