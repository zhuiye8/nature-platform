/**
 * @input workflow_node_rule base fields and child WorkflowNodeRuleItemRecord list
 * @output WorkflowNodeRuleRecord DTO for node rule list/detail endpoints
 * @position Workflow governance read model describing assignment rule bundles by node
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.util.ArrayList;
import java.util.List;

public class WorkflowNodeRuleRecord {
  private String nodeKey;
  private String ruleName;
  private boolean enabled;
  private String updatedBy;
  private String updatedAt;
  private List<WorkflowNodeRuleItemRecord> items = new ArrayList<>();

  public String getNodeKey() {
    return nodeKey;
  }

  public void setNodeKey(String nodeKey) {
    this.nodeKey = nodeKey;
  }

  public String getRuleName() {
    return ruleName;
  }

  public void setRuleName(String ruleName) {
    this.ruleName = ruleName;
  }

  public boolean isEnabled() {
    return enabled;
  }

  public void setEnabled(boolean enabled) {
    this.enabled = enabled;
  }

  public String getUpdatedBy() {
    return updatedBy;
  }

  public void setUpdatedBy(String updatedBy) {
    this.updatedBy = updatedBy;
  }

  public String getUpdatedAt() {
    return updatedAt;
  }

  public void setUpdatedAt(String updatedAt) {
    this.updatedAt = updatedAt;
  }

  public List<WorkflowNodeRuleItemRecord> getItems() {
    return items;
  }

  public void setItems(List<WorkflowNodeRuleItemRecord> items) {
    this.items = items == null ? new ArrayList<>() : items;
  }
}
