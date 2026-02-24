/**
 * @input report_content_review_apply/task with workflow and project assignment joins
 * @output ReportContentReviewRecord response model for node-12 list/detail APIs
 * @position Node-12 read model aggregating A/B/C reviewers and multi-task review outcomes
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.util.ArrayList;
import java.util.List;

public class ReportContentReviewRecord {
  private long projectRegisterId;
  private String applicationName;
  private String techReviewStatus;
  private String onSitePackageObjectKey;
  private String reviewerA;
  private String reviewerB;
  private String reviewerC;
  private String status;
  private String appliedBy;
  private String submittedAt;
  private String finishedAt;
  private String workflowNode;
  private String workflowStatus;
  private List<ReportContentReviewTaskRecord> tasks = new ArrayList<>();

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

  public String getTechReviewStatus() {
    return techReviewStatus;
  }

  public void setTechReviewStatus(String techReviewStatus) {
    this.techReviewStatus = techReviewStatus;
  }

  public String getOnSitePackageObjectKey() {
    return onSitePackageObjectKey;
  }

  public void setOnSitePackageObjectKey(String onSitePackageObjectKey) {
    this.onSitePackageObjectKey = onSitePackageObjectKey;
  }

  public String getReviewerA() {
    return reviewerA;
  }

  public void setReviewerA(String reviewerA) {
    this.reviewerA = reviewerA;
  }

  public String getReviewerB() {
    return reviewerB;
  }

  public void setReviewerB(String reviewerB) {
    this.reviewerB = reviewerB;
  }

  public String getReviewerC() {
    return reviewerC;
  }

  public void setReviewerC(String reviewerC) {
    this.reviewerC = reviewerC;
  }

  public String getStatus() {
    return status;
  }

  public void setStatus(String status) {
    this.status = status;
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

  public List<ReportContentReviewTaskRecord> getTasks() {
    return tasks;
  }

  public void setTasks(List<ReportContentReviewTaskRecord> tasks) {
    this.tasks = tasks;
  }
}
