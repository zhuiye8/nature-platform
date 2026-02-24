/**
 * @input report_compile_assignment rows joined with content-review/project/workflow context
 * @output ReportCompileAssignmentRecord response model for node-13 assignment APIs
 * @position Node-13 read model for compile assignee, version, and submission readiness
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

public class ReportCompileAssignmentRecord {
  private long projectRegisterId;
  private String applicationName;
  private String contentReviewStatus;
  private String onSitePackageObjectKey;
  private String assignee;
  private String status;
  private int versionNo;
  private String submittedAt;
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

  public String getContentReviewStatus() {
    return contentReviewStatus;
  }

  public void setContentReviewStatus(String contentReviewStatus) {
    this.contentReviewStatus = contentReviewStatus;
  }

  public String getOnSitePackageObjectKey() {
    return onSitePackageObjectKey;
  }

  public void setOnSitePackageObjectKey(String onSitePackageObjectKey) {
    this.onSitePackageObjectKey = onSitePackageObjectKey;
  }

  public String getAssignee() {
    return assignee;
  }

  public void setAssignee(String assignee) {
    this.assignee = assignee;
  }

  public String getStatus() {
    return status;
  }

  public void setStatus(String status) {
    this.status = status;
  }

  public int getVersionNo() {
    return versionNo;
  }

  public void setVersionNo(int versionNo) {
    this.versionNo = versionNo;
  }

  public String getSubmittedAt() {
    return submittedAt;
  }

  public void setSubmittedAt(String submittedAt) {
    this.submittedAt = submittedAt;
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
