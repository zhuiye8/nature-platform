/**
 * @input Role metadata and resource-key selections from admin role management forms
 * @output AdminRoleUpsertRequest payload for role create/update with page-level resource assignments
 * @position IAM write contract for role lifecycle and role-resource mapping changes
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.util.ArrayList;
import java.util.List;

public class AdminRoleUpsertRequest {
  @Pattern(regexp = "^ROLE_[A-Z0-9_]+$", message = "roleCode must match ROLE_[A-Z0-9_]+")
  private String roleCode;

  @NotBlank
  private String roleName;

  private String description;

  private Boolean enabled;

  @JsonAlias("permissionCodes")
  private List<String> resourceKeys = new ArrayList<>();

  public String getRoleCode() {
    return roleCode;
  }

  public void setRoleCode(String roleCode) {
    this.roleCode = roleCode;
  }

  public String getRoleName() {
    return roleName;
  }

  public void setRoleName(String roleName) {
    this.roleName = roleName;
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

  public List<String> getResourceKeys() {
    return resourceKeys;
  }

  public void setResourceKeys(List<String> resourceKeys) {
    this.resourceKeys = resourceKeys == null ? new ArrayList<>() : resourceKeys;
  }

  public List<String> getPermissionCodes() {
    return resourceKeys;
  }

  public void setPermissionCodes(List<String> permissionCodes) {
    this.resourceKeys = permissionCodes == null ? new ArrayList<>() : permissionCodes;
  }
}
