/**
 * @input Rule-level metadata and slot item list from admin workflow-rule editor
 * @output WorkflowNodeRuleUpsertRequest payload for node-rule create/update operations
 * @position Workflow governance write contract for assignment rule maintenance
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.ArrayList;
import java.util.List;

public class WorkflowNodeRuleUpsertRequest {
  @NotBlank
  private String ruleName;

  @NotNull
  private Boolean enabled;

  @Valid
  @NotNull
  private List<WorkflowNodeRuleItemRequest> items = new ArrayList<>();

  public String getRuleName() {
    return ruleName;
  }

  public void setRuleName(String ruleName) {
    this.ruleName = ruleName;
  }

  public Boolean getEnabled() {
    return enabled;
  }

  public void setEnabled(Boolean enabled) {
    this.enabled = enabled;
  }

  public List<WorkflowNodeRuleItemRequest> getItems() {
    return items;
  }

  public void setItems(List<WorkflowNodeRuleItemRequest> items) {
    this.items = items == null ? new ArrayList<>() : items;
  }
}
