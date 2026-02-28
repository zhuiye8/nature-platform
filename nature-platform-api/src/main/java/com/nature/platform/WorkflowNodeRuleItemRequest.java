/**
 * @input Slot-role constraints from admin node-rule editor form
 * @output WorkflowNodeRuleItemRequest payload for writing node-rule items
 * @position Workflow rule write contract for assignment slot configuration
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class WorkflowNodeRuleItemRequest {
  @NotBlank
  private String slotKey;

  @NotBlank
  private String slotLabel;

  @NotBlank
  private String roleCode;

  @NotNull
  private Boolean requiredFlag;

  @NotNull
  @Min(0)
  private Integer minCount;

  @NotNull
  @Min(1)
  private Integer maxCount;

  @NotNull
  @Min(0)
  private Integer sortOrder;

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

  public Boolean getRequiredFlag() {
    return requiredFlag;
  }

  public void setRequiredFlag(Boolean requiredFlag) {
    this.requiredFlag = requiredFlag;
  }

  public Integer getMinCount() {
    return minCount;
  }

  public void setMinCount(Integer minCount) {
    this.minCount = minCount;
  }

  public Integer getMaxCount() {
    return maxCount;
  }

  public void setMaxCount(Integer maxCount) {
    this.maxCount = maxCount;
  }

  public Integer getSortOrder() {
    return sortOrder;
  }

  public void setSortOrder(Integer sortOrder) {
    this.sortOrder = sortOrder;
  }
}
