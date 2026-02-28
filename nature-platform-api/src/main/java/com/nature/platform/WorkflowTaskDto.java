/**
 * @input Workflow task query rows assembled by WorkflowTaskService
 * @output WorkflowTaskDto task-center projection with raw status + unified displayStatus for cross-page rendering
 * @position API-facing workflow read model shared by workflow task list UI
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

public class WorkflowTaskDto {
  private String taskId;
  private String taskType;
  private long bizId;
  private String bizTitle;
  private String status;
  private String displayStatus;
  private String submittedBy;
  private String submittedAt;
  private String processDefinitionKey;
  private String currentNode;
  private String processInstanceId;

  public WorkflowTaskDto(
      String taskId,
      String taskType,
      long bizId,
      String bizTitle,
      String status,
      String displayStatus,
      String submittedBy,
      String submittedAt,
      String processDefinitionKey,
      String currentNode,
      String processInstanceId) {
    this.taskId = taskId;
    this.taskType = taskType;
    this.bizId = bizId;
    this.bizTitle = bizTitle;
    this.status = status;
    this.displayStatus = displayStatus;
    this.submittedBy = submittedBy;
    this.submittedAt = submittedAt;
    this.processDefinitionKey = processDefinitionKey;
    this.currentNode = currentNode;
    this.processInstanceId = processInstanceId;
  }

  public WorkflowTaskDto(
      String taskId,
      String taskType,
      long bizId,
      String bizTitle,
      String status,
      String submittedBy,
      String submittedAt,
      String processDefinitionKey,
      String currentNode,
      String processInstanceId) {
    this(
        taskId,
        taskType,
        bizId,
        bizTitle,
        status,
        status,
        submittedBy,
        submittedAt,
        processDefinitionKey,
        currentNode,
        processInstanceId);
  }

  public String getTaskId() {
    return taskId;
  }

  public String getTaskType() {
    return taskType;
  }

  public long getBizId() {
    return bizId;
  }

  public String getBizTitle() {
    return bizTitle;
  }

  public String getStatus() {
    return status;
  }

  public String getDisplayStatus() {
    return displayStatus;
  }

  public String getSubmittedBy() {
    return submittedBy;
  }

  public String getSubmittedAt() {
    return submittedAt;
  }

  public String getProcessDefinitionKey() {
    return processDefinitionKey;
  }

  public String getCurrentNode() {
    return currentNode;
  }

  public String getProcessInstanceId() {
    return processInstanceId;
  }
}
