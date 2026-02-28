/**
 * @input iam_resource table rows and optional hierarchical children projection
 * @output AdminResourceRecord DTO for resource list/tree APIs and role-resource assignment views
 * @position IAM read model representing page/group resources in admin governance module
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.util.ArrayList;
import java.util.List;

public class AdminResourceRecord {
  private String resourceKey;
  private String resourceName;
  private String resourceType;
  private String parentKey;
  private String routePath;
  private String icon;
  private int sortOrder;
  private boolean enabled;
  private boolean builtIn;
  private String description;
  private List<AdminResourceRecord> children = new ArrayList<>();

  public String getResourceKey() {
    return resourceKey;
  }

  public void setResourceKey(String resourceKey) {
    this.resourceKey = resourceKey;
  }

  public String getResourceName() {
    return resourceName;
  }

  public void setResourceName(String resourceName) {
    this.resourceName = resourceName;
  }

  public String getResourceType() {
    return resourceType;
  }

  public void setResourceType(String resourceType) {
    this.resourceType = resourceType;
  }

  public String getParentKey() {
    return parentKey;
  }

  public void setParentKey(String parentKey) {
    this.parentKey = parentKey;
  }

  public String getRoutePath() {
    return routePath;
  }

  public void setRoutePath(String routePath) {
    this.routePath = routePath;
  }

  public String getIcon() {
    return icon;
  }

  public void setIcon(String icon) {
    this.icon = icon;
  }

  public int getSortOrder() {
    return sortOrder;
  }

  public void setSortOrder(int sortOrder) {
    this.sortOrder = sortOrder;
  }

  public boolean isEnabled() {
    return enabled;
  }

  public void setEnabled(boolean enabled) {
    this.enabled = enabled;
  }

  public boolean isBuiltIn() {
    return builtIn;
  }

  public void setBuiltIn(boolean builtIn) {
    this.builtIn = builtIn;
  }

  public String getDescription() {
    return description;
  }

  public void setDescription(String description) {
    this.description = description;
  }

  public List<AdminResourceRecord> getChildren() {
    return children;
  }

  public void setChildren(List<AdminResourceRecord> children) {
    this.children = children == null ? new ArrayList<>() : children;
  }
}
