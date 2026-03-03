/**
 * @input user_account rows and user_role aggregation results
 * @output AdminUserRecord DTO for management user list/detail responses
 * @position IAM user read model exposing account basics and bound role codes
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.util.ArrayList;
import java.util.List;

public class AdminUserRecord {
  private String username;
  private String displayName;
  private boolean enabled;
  private String sourceType;
  private Long deptId;
  private String deptName;
  private String dingUserId;
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

  public boolean isEnabled() {
    return enabled;
  }

  public void setEnabled(boolean enabled) {
    this.enabled = enabled;
  }

  public String getSourceType() {
    return sourceType;
  }

  public void setSourceType(String sourceType) {
    this.sourceType = sourceType;
  }

  public Long getDeptId() {
    return deptId;
  }

  public void setDeptId(Long deptId) {
    this.deptId = deptId;
  }

  public String getDeptName() {
    return deptName;
  }

  public void setDeptName(String deptName) {
    this.deptName = deptName;
  }

  public String getDingUserId() {
    return dingUserId;
  }

  public void setDingUserId(String dingUserId) {
    this.dingUserId = dingUserId;
  }

  public List<String> getRoles() {
    return roles;
  }

  public void setRoles(List<String> roles) {
    this.roles = roles == null ? new ArrayList<>() : roles;
  }
}
