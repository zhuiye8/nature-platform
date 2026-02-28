/**
 * @input Account base fields and role-code list from admin create-user dialog
 * @output AdminUserCreateRequest payload for creating local user accounts
 * @position IAM write contract for initial account provisioning
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.util.ArrayList;
import java.util.List;

public class AdminUserCreateRequest {
  @NotBlank
  @Pattern(regexp = "^[a-zA-Z0-9._-]{3,64}$", message = "username must be 3-64 chars of letters/numbers/._-")
  private String username;

  @NotBlank
  private String displayName;

  @NotBlank
  private String password;

  private Boolean enabled;

  private List<String> roles = new ArrayList<>();

  public String getUsername() {
    return username;
  }

  public void setUsername(String username) {
    this.username = username;
  }

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
