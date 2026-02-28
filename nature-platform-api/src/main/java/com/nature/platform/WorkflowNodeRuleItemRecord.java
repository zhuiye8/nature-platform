/**
 * @input workflow_node_rule_item rows grouped by slot/role constraints
 * @output WorkflowNodeRuleItemRecord DTO for node-assignment rule details
 * @position Workflow rule read model used by admin UI and candidate-role resolution
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

public class WorkflowNodeRuleItemRecord {
  private String slotKey;
  private String slotLabel;
  private String roleCode;
  private boolean requiredFlag;
  private int minCount;
  private int maxCount;
  private int sortOrder;

  public String getSlotKey() {
    return slotKey;
  }

  public void setSlotKey(String slotKey) {
    this.slotKey = slotKey;
  }

  public String getSlotLabel() {
    return slotLabel;
  }

  public void setSlotLabel(String slotLabel) {
    this.slotLabel = slotLabel;
  }

  public String getRoleCode() {
    return roleCode;
  }

  public void setRoleCode(String roleCode) {
    this.roleCode = roleCode;
  }

  public boolean isRequiredFlag() {
    return requiredFlag;
  }

  public void setRequiredFlag(boolean requiredFlag) {
    this.requiredFlag = requiredFlag;
  }

  public int getMinCount() {
    return minCount;
  }

  public void setMinCount(int minCount) {
    this.minCount = minCount;
  }

  public int getMaxCount() {
    return maxCount;
  }

  public void setMaxCount(int maxCount) {
    this.maxCount = maxCount;
  }

  public int getSortOrder() {
    return sortOrder;
  }

  public void setSortOrder(int sortOrder) {
    this.sortOrder = sortOrder;
  }
}
