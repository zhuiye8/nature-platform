/**
 * @input Department create/update form payload from admin UI
 * @output AdminDepartmentSaveRequest contract for local department maintenance APIs
 * @position IAM organization write model used by department management controller
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import jakarta.validation.constraints.NotBlank;

public class AdminDepartmentSaveRequest {
  @NotBlank
  private String deptCode;

  @NotBlank
  private String deptName;

  private Long parentId;

  private Boolean enabled;

  private Integer sortOrder;

  private String defaultRoleCode;

  public String getDeptCode() {
    return deptCode;
  }

  public void setDeptCode(String deptCode) {
    this.deptCode = deptCode;
  }

  public String getDeptName() {
    return deptName;
  }

  public void setDeptName(String deptName) {
    this.deptName = deptName;
  }

  public Long getParentId() {
    return parentId;
  }

  public void setParentId(Long parentId) {
    this.parentId = parentId;
  }

  public Boolean getEnabled() {
    return enabled;
  }

  public void setEnabled(Boolean enabled) {
    this.enabled = enabled;
  }

  public Integer getSortOrder() {
    return sortOrder;
  }

  public void setSortOrder(Integer sortOrder) {
    this.sortOrder = sortOrder;
  }

  public String getDefaultRoleCode() {
    return defaultRoleCode;
  }

  public void setDefaultRoleCode(String defaultRoleCode) {
    this.defaultRoleCode = defaultRoleCode;
  }
}
