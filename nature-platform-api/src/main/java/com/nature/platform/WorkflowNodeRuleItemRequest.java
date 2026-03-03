/**
 * @input Slot-role constraints from admin node-rule editor form
 * @output WorkflowNodeRuleItemRequest payload for writing node-rule items
 * @position Workflow rule write contract for assignment slot configuration
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

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
}
