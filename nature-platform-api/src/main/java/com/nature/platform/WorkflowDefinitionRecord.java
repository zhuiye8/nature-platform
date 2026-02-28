/**
 * @input workflow_definition_registry row fields
 * @output WorkflowDefinitionRecord DTO for workflow metadata management APIs
 * @position Workflow governance read model exposing configurable node metadata
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

public class WorkflowDefinitionRecord {
  private String nodeKey;
  private String nodeName;
  private int nodeOrder;
  private String stage;
  private boolean enabled;
  private String description;

  public String getNodeKey() {
    return nodeKey;
  }

  public void setNodeKey(String nodeKey) {
    this.nodeKey = nodeKey;
  }

  public String getNodeName() {
    return nodeName;
  }

  public void setNodeName(String nodeName) {
    this.nodeName = nodeName;
  }

  public int getNodeOrder() {
    return nodeOrder;
  }

  public void setNodeOrder(int nodeOrder) {
    this.nodeOrder = nodeOrder;
  }

  public String getStage() {
    return stage;
  }

  public void setStage(String stage) {
    this.stage = stage;
  }

  public boolean isEnabled() {
    return enabled;
  }

  public void setEnabled(boolean enabled) {
    this.enabled = enabled;
  }

  public String getDescription() {
    return description;
  }

  public void setDescription(String description) {
    this.description = description;
  }
}
