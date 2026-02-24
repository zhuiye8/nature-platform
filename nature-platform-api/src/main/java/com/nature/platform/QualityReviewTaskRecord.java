/**
 * @input quality_review_task query row mappings and role/status metadata
 * @output QualityReviewTaskRecord response model for quality-review task visibility
 * @position Node-10 task-level read model for four-way review execution and tracking
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

public class QualityReviewTaskRecord {
  private long id;
  private String reviewRole;
  private String assignee;
  private String status;
  private String remark;
  private String processedBy;
  private String processedAt;

  public long getId() {
    return id;
  }

  public void setId(long id) {
    this.id = id;
  }

  public String getReviewRole() {
    return reviewRole;
  }

  public void setReviewRole(String reviewRole) {
    this.reviewRole = reviewRole;
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

  public String getRemark() {
    return remark;
  }

  public void setRemark(String remark) {
    this.remark = remark;
  }

  public String getProcessedBy() {
    return processedBy;
  }

  public void setProcessedBy(String processedBy) {
    this.processedBy = processedBy;
  }

  public String getProcessedAt() {
    return processedAt;
  }

  public void setProcessedAt(String processedAt) {
    this.processedAt = processedAt;
  }
}
