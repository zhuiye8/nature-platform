/**
 * @input Role-resource assignment payload from resource tree selector in role management
 * @output AdminRoleResourceAssignRequest request body for replacing role-resource mappings
 * @position IAM write contract for role-level page access authorization governance
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.util.ArrayList;
import java.util.List;

public class AdminRoleResourceAssignRequest {
  private List<String> resourceKeys = new ArrayList<>();

  public List<String> getResourceKeys() {
    return resourceKeys;
  }

  public void setResourceKeys(List<String> resourceKeys) {
    this.resourceKeys = resourceKeys == null ? new ArrayList<>() : resourceKeys;
  }
}
