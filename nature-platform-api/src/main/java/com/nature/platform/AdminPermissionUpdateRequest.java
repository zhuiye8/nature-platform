/**
 * @input Permission metadata fields submitted by admin permission-edit form
 * @output AdminPermissionUpdateRequest payload for updating permission dictionary metadata
 * @position IAM write contract for admin permission update endpoint
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class AdminPermissionUpdateRequest {
  @NotBlank
  private String permissionName;

  @NotBlank
  private String category;

  private String description;

  @NotNull
  private Boolean enabled;

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
