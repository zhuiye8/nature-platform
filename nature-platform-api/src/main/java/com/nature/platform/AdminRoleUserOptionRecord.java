/**
 * @input user_account table rows used as assignment candidates in role management
 * @output AdminRoleUserOptionRecord read model for role-user transfer selector
 * @position IAM UI-facing DTO that exposes username, display name, and enabled status
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

public class AdminRoleUserOptionRecord {
  private String username;
  private String displayName;
  private boolean enabled;

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

  public boolean isEnabled() {
    return enabled;
  }

  public void setEnabled(boolean enabled) {
    this.enabled = enabled;
  }
}
