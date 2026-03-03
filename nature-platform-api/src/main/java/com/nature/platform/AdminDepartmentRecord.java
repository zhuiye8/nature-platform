/**
 * @input iam_department table rows and parent lookup projection fields
 * @output AdminDepartmentRecord DTO for department list/tree management responses
 * @position IAM organization read model exposing local and DingTalk-synced department metadata
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.util.ArrayList;
import java.util.List;

public class AdminDepartmentRecord {
  private long id;
  private String deptCode;
  private String deptName;
  private Long parentId;
  private String parentName;
  private String sourceType;
  private String dingDeptId;
  private String defaultRoleCode;
  private String defaultRoleName;
  private boolean enabled;
  private int sortOrder;
  private List<AdminDepartmentRecord> children = new ArrayList<>();

  public long getId() {
    return id;
  }

  public void setId(long id) {
    this.id = id;
  }

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

  public String getParentName() {
    return parentName;
  }

  public void setParentName(String parentName) {
    this.parentName = parentName;
  }

  public String getSourceType() {
    return sourceType;
  }

  public void setSourceType(String sourceType) {
    this.sourceType = sourceType;
  }

  public String getDingDeptId() {
    return dingDeptId;
  }

  public void setDingDeptId(String dingDeptId) {
    this.dingDeptId = dingDeptId;
  }

  public String getDefaultRoleCode() {
    return defaultRoleCode;
  }

  public void setDefaultRoleCode(String defaultRoleCode) {
    this.defaultRoleCode = defaultRoleCode;
  }

  public String getDefaultRoleName() {
    return defaultRoleName;
  }

  public void setDefaultRoleName(String defaultRoleName) {
    this.defaultRoleName = defaultRoleName;
  }

  public boolean isEnabled() {
    return enabled;
  }

  public void setEnabled(boolean enabled) {
    this.enabled = enabled;
  }

  public int getSortOrder() {
    return sortOrder;
  }

  public void setSortOrder(int sortOrder) {
    this.sortOrder = sortOrder;
  }

  public List<AdminDepartmentRecord> getChildren() {
    return children;
  }

  public void setChildren(List<AdminDepartmentRecord> children) {
    this.children = children == null ? new ArrayList<>() : children;
  }
}
