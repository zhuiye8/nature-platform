/**
 * @input Mutable account fields and role-code list from admin edit-user dialog
 * @output AdminUserUpdateRequest payload for updating user profile, state, password, and roles
 * @position IAM write contract for user account maintenance operations
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.ArrayList;
import java.util.List;

public class AdminUserUpdateRequest {
  @NotBlank
  private String displayName;

  private String password;

  @NotNull
  private Boolean enabled;

  private List<String> roles = new ArrayList<>();

  public String getDisplayName() {
    return displayName;
  }

  public void setDisplayName(String displayName) {
    this.displayName = displayName;
  }

  public String getPassword() {
    return password;
  }

  public void setPassword(String password) {
    this.password = password;
  }

  public Boolean getEnabled() {
    return enabled;
  }

  public void setEnabled(Boolean enabled) {
    this.enabled = enabled;
  }

  public List<String> getRoles() {
    return roles;
  }

  public void setRoles(List<String> roles) {
    this.roles = roles == null ? new ArrayList<>() : roles;
  }
}
