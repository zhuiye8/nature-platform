/**
 * @input iam_role base fields and role-to-resource mapping aggregation
 * @output AdminRoleRecord DTO for role list/detail responses with canonical resourceKeys and legacy-compatible permissionCodes aliases
 * @position IAM role read model powering role management UI and page-level RBAC assignment operations
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.ArrayList;
import java.util.List;

public class AdminRoleRecord {
  private String roleCode;
  private String roleName;
  private String description;
  private boolean systemFlag;
  private boolean enabled;
  private String dataScope = RoleDataScopeTypes.SELF;
  private boolean projectViewAll;
  private boolean peerSalesLimited;
  private List<Long> dataScopeDeptIds = new ArrayList<>();
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

  public boolean isSystemFlag() {
    return systemFlag;
  }

  public void setSystemFlag(boolean systemFlag) {
    this.systemFlag = systemFlag;
  }

  public boolean isEnabled() {
    return enabled;
  }

  public void setEnabled(boolean enabled) {
    this.enabled = enabled;
  }

  public String getDataScope() {
    return dataScope;
  }

  public void setDataScope(String dataScope) {
    this.dataScope = dataScope;
  }

  public boolean isProjectViewAll() {
    return projectViewAll;
  }

  public void setProjectViewAll(boolean projectViewAll) {
    this.projectViewAll = projectViewAll;
  }

  public boolean isPeerSalesLimited() {
    return peerSalesLimited;
  }

  public void setPeerSalesLimited(boolean peerSalesLimited) {
    this.peerSalesLimited = peerSalesLimited;
  }

  public List<Long> getDataScopeDeptIds() {
    return dataScopeDeptIds;
  }

  public void setDataScopeDeptIds(List<Long> dataScopeDeptIds) {
    this.dataScopeDeptIds = dataScopeDeptIds == null ? new ArrayList<>() : dataScopeDeptIds;
  }

  public List<String> getResourceKeys() {
    return resourceKeys;
  }

  public void setResourceKeys(List<String> resourceKeys) {
    this.resourceKeys = resourceKeys == null ? new ArrayList<>() : resourceKeys;
  }

  @JsonProperty("permissionCodes")
  public List<String> getPermissionCodes() {
    return resourceKeys;
  }

  @JsonAlias("permissionCodes")
  public void setPermissionCodes(List<String> permissionCodes) {
    this.resourceKeys = permissionCodes == null ? new ArrayList<>() : permissionCodes;
  }
}
