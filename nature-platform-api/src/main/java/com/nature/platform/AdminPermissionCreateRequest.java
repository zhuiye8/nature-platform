/**
 * @input Permission metadata fields submitted by admin permission-create form
 * @output AdminPermissionCreateRequest payload for creating custom permissions
 * @position IAM write contract for admin permission dictionary creation endpoint
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class AdminPermissionCreateRequest {
  @NotBlank
  private String permissionCode;

  @NotBlank
  private String permissionName;

  @NotBlank
  private String category;

  private String description;

  @NotNull
  private Boolean enabled;

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

  public Boolean getEnabled() {
    return enabled;
  }

  public void setEnabled(Boolean enabled) {
    this.enabled = enabled;
  }
}
