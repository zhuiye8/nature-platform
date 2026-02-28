/**
 * @input Workflow node metadata fields submitted from admin workflow-definition editor
 * @output WorkflowDefinitionUpsertRequest payload for creating/updating node definitions
 * @position Workflow governance write contract for definition registry maintenance
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class WorkflowDefinitionUpsertRequest {
  @NotBlank
  private String nodeName;

  @NotNull
  private Integer nodeOrder;

  @NotBlank
  private String stage;

  @NotNull
  private Boolean enabled;

  private String description;

  public String getNodeName() {
    return nodeName;
  }

  public void setNodeName(String nodeName) {
    this.nodeName = nodeName;
  }

  public Integer getNodeOrder() {
    return nodeOrder;
  }

  public void setNodeOrder(Integer nodeOrder) {
    this.nodeOrder = nodeOrder;
  }

  public String getStage() {
    return stage;
  }

  public void setStage(String stage) {
    this.stage = stage;
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
