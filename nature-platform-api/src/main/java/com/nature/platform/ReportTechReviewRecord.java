/**
 * @input report_tech_review_apply/task and workflow-instance query rows
 * @output ReportTechReviewRecord response model for node-11 list/detail APIs including unified displayStatus
 * @position Node-11 read model for overall technical review stage status and reviewer metadata
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

public class ReportTechReviewRecord {
  private long projectRegisterId;
  private String applicationName;
  private String qualityStatus;
  private String onSitePackageObjectKey;
  private String reviewer;
  private String status;
  private String remark;
  private int versionNo;
  private String appliedBy;
  private String submittedAt;
  private String finishedAt;
  private Long taskId;
  private String taskStatus;
  private String displayStatus;
  private String workflowNode;
  private String workflowStatus;

  public long getProjectRegisterId() {
    return projectRegisterId;
  }

  public void setProjectRegisterId(long projectRegisterId) {
    this.projectRegisterId = projectRegisterId;
  }

  public String getApplicationName() {
    return applicationName;
  }

  public void setApplicationName(String applicationName) {
    this.applicationName = applicationName;
  }

  public String getQualityStatus() {
    return qualityStatus;
  }

  public void setQualityStatus(String qualityStatus) {
    this.qualityStatus = qualityStatus;
  }

  public String getOnSitePackageObjectKey() {
    return onSitePackageObjectKey;
  }

  public void setOnSitePackageObjectKey(String onSitePackageObjectKey) {
    this.onSitePackageObjectKey = onSitePackageObjectKey;
  }

  public String getReviewer() {
    return reviewer;
  }

  public void setReviewer(String reviewer) {
    this.reviewer = reviewer;
  }

  public String getStatus() {
    return status;
  }

  public void setStatus(String status) {
    this.status = status;
  }

  public String getRemark() {
    return remark;
  }

  public void setRemark(String remark) {
    this.remark = remark;
  }

  public int getVersionNo() {
    return versionNo;
  }

  public void setVersionNo(int versionNo) {
    this.versionNo = versionNo;
  }

  public String getAppliedBy() {
    return appliedBy;
  }

  public void setAppliedBy(String appliedBy) {
    this.appliedBy = appliedBy;
  }

  public String getSubmittedAt() {
    return submittedAt;
  }

  public void setSubmittedAt(String submittedAt) {
    this.submittedAt = submittedAt;
  }

  public String getFinishedAt() {
    return finishedAt;
  }

  public void setFinishedAt(String finishedAt) {
    this.finishedAt = finishedAt;
  }

  public Long getTaskId() {
    return taskId;
  }

  public void setTaskId(Long taskId) {
    this.taskId = taskId;
  }

  public String getTaskStatus() {
    return taskStatus;
  }

  public void setTaskStatus(String taskStatus) {
    this.taskStatus = taskStatus;
  }

  public String getDisplayStatus() {
    return displayStatus;
  }

  public void setDisplayStatus(String displayStatus) {
    this.displayStatus = displayStatus;
  }

  public String getWorkflowNode() {
    return workflowNode;
  }

  public void setWorkflowNode(String workflowNode) {
    this.workflowNode = workflowNode;
  }

  public String getWorkflowStatus() {
    return workflowStatus;
  }

  public void setWorkflowStatus(String workflowStatus) {
    this.workflowStatus = workflowStatus;
  }
}
