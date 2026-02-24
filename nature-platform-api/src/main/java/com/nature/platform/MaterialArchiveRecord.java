/**
 * @input material_archive rows joined with final-review/project/workflow status fields
 * @output MaterialArchiveRecord response model for node-16 material archive APIs
 * @position Node-16 read model for report/form archive package and submit completion state
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.util.ArrayList;
import java.util.List;

public class MaterialArchiveRecord {
  private long projectRegisterId;
  private String applicationName;
  private String finalReviewStatus;
  private String onSitePackageObjectKey;
  private List<String> reportFiles = new ArrayList<>();
  private List<String> formFiles = new ArrayList<>();
  private String remark;
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

  public String getFinalReviewStatus() {
    return finalReviewStatus;
  }

  public void setFinalReviewStatus(String finalReviewStatus) {
    this.finalReviewStatus = finalReviewStatus;
  }

  public String getOnSitePackageObjectKey() {
    return onSitePackageObjectKey;
  }

  public void setOnSitePackageObjectKey(String onSitePackageObjectKey) {
    this.onSitePackageObjectKey = onSitePackageObjectKey;
  }

  public List<String> getReportFiles() {
    return reportFiles;
  }

  public void setReportFiles(List<String> reportFiles) {
    this.reportFiles = reportFiles;
  }

  public List<String> getFormFiles() {
    return formFiles;
  }

  public void setFormFiles(List<String> formFiles) {
    this.formFiles = formFiles;
  }

  public String getRemark() {
    return remark;
  }

  public void setRemark(String remark) {
    this.remark = remark;
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
