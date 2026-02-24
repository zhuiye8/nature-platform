/**
 * @input project_register, on_site_assessment, workflow_assignment, quality_review_apply/task aggregation data
 * @output QualityReviewRecord response model for node-9/10 list and detail APIs
 * @position Combined quality-review read model exposing assignment/version/package/task execution status
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.util.ArrayList;
import java.util.List;

public class QualityReviewRecord {
  private long projectRegisterId;
  private String applicationName;
  private String projectStatus;
  private String onSiteAssessmentStatus;
  private String onSitePackageObjectKey;
  private String status;
  private String techReviewer;
  private String contentReviewerA;
  private String contentReviewerB;
  private String contentReviewerC;
  private int assignmentVersionNo;
  private String appliedBy;
  private String submittedAt;
  private String finishedAt;
  private String workflowNode;
  private String workflowStatus;
  private List<QualityReviewTaskRecord> tasks = new ArrayList<>();

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

  public String getProjectStatus() {
    return projectStatus;
  }

  public void setProjectStatus(String projectStatus) {
    this.projectStatus = projectStatus;
  }

  public String getOnSiteAssessmentStatus() {
    return onSiteAssessmentStatus;
  }

  public void setOnSiteAssessmentStatus(String onSiteAssessmentStatus) {
    this.onSiteAssessmentStatus = onSiteAssessmentStatus;
  }

  public String getOnSitePackageObjectKey() {
    return onSitePackageObjectKey;
  }

  public void setOnSitePackageObjectKey(String onSitePackageObjectKey) {
    this.onSitePackageObjectKey = onSitePackageObjectKey;
  }

  public String getStatus() {
    return status;
  }

  public void setStatus(String status) {
    this.status = status;
  }

  public String getTechReviewer() {
    return techReviewer;
  }

  public void setTechReviewer(String techReviewer) {
    this.techReviewer = techReviewer;
  }

  public String getContentReviewerA() {
    return contentReviewerA;
  }

  public void setContentReviewerA(String contentReviewerA) {
    this.contentReviewerA = contentReviewerA;
  }

  public String getContentReviewerB() {
    return contentReviewerB;
  }

  public void setContentReviewerB(String contentReviewerB) {
    this.contentReviewerB = contentReviewerB;
  }

  public String getContentReviewerC() {
    return contentReviewerC;
  }

  public void setContentReviewerC(String contentReviewerC) {
    this.contentReviewerC = contentReviewerC;
  }

  public int getAssignmentVersionNo() {
    return assignmentVersionNo;
  }

  public void setAssignmentVersionNo(int assignmentVersionNo) {
    this.assignmentVersionNo = assignmentVersionNo;
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

  public List<QualityReviewTaskRecord> getTasks() {
    return tasks;
  }

  public void setTasks(List<QualityReviewTaskRecord> tasks) {
    this.tasks = tasks;
  }
}
