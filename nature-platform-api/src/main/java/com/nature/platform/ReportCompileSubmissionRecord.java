/**
 * @input report_compile_submission rows joined with assignment/project/workflow context
 * @output ReportCompileSubmissionRecord response model for node-14 compile and upload stage
 * @position Node-14 read model exposing report upload state and compile assignee ownership
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

public class ReportCompileSubmissionRecord {
  private long projectRegisterId;
  private String applicationName;
  private String assignmentStatus;
  private String onSitePackageObjectKey;
  private String assignee;
  private String reportObjectKey;
  private String reportRemark;
  private String status;
  private String submittedBy;
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

  public String getAssignmentStatus() {
    return assignmentStatus;
  }

  public void setAssignmentStatus(String assignmentStatus) {
    this.assignmentStatus = assignmentStatus;
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

  public String getReportObjectKey() {
    return reportObjectKey;
  }

  public void setReportObjectKey(String reportObjectKey) {
    this.reportObjectKey = reportObjectKey;
  }

  public String getReportRemark() {
    return reportRemark;
  }

  public void setReportRemark(String reportRemark) {
    this.reportRemark = reportRemark;
  }

  public String getStatus() {
    return status;
  }

  public void setStatus(String status) {
    this.status = status;
  }

  public String getSubmittedBy() {
    return submittedBy;
  }

  public void setSubmittedBy(String submittedBy) {
    this.submittedBy = submittedBy;
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
