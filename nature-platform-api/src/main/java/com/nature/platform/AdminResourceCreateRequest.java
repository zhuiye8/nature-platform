/**
 * @input Resource metadata payload from admin resource-management create form
 * @output AdminResourceCreateRequest contract for creating IAM resource nodes
 * @position IAM write contract layer for admin-driven resource catalog expansion
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public class AdminResourceCreateRequest {
  @NotBlank
  @Pattern(
      regexp = "^(group|page)\\.[a-z0-9][a-z0-9.-]{1,126}$",
      message = "resourceKey must start with group. or page.")
  private String resourceKey;

  @NotBlank private String resourceName;

  @NotBlank
  @Pattern(regexp = "^(GROUP|PAGE)$", message = "resourceType must be GROUP or PAGE")
  private String resourceType;

  private String parentKey;
  private String routePath;
  private String icon;
  private Integer sortOrder;
  private Boolean enabled;
  private String description;

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

  public Integer getSortOrder() {
    return sortOrder;
  }

  public void setSortOrder(Integer sortOrder) {
    this.sortOrder = sortOrder;
  }

  public Boolean getEnabled() {
    return enabled;
  }

  public void setEnabled(Boolean enabled) {
    this.enabled = enabled;
  }

  public String getDescription() {
    return description;
  }

  public void setDescription(String description) {
    this.description = description;
  }
}
