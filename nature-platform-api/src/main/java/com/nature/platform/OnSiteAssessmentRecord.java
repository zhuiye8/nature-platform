/**
 * @input On-site assessment table rows joined with project/workflow summary fields
 * @output OnSiteAssessmentRecord response model for node-8 list/detail APIs with evidence-file and rectification context
 * @position Node-8 read model exposing on-site evidence attachments, workflow transition status, and latest review-rectification hints
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.util.ArrayList;
import java.util.List;

public class OnSiteAssessmentRecord {
  private Long id;
  private long projectRegisterId;
  private String applicationName;
  private String projectStatus;
  private String status;
  private String packageObjectKey;
  private List<String> evidenceFiles = new ArrayList<>();
  private String techReviewer;
  private String contentReviewerA;
  private String contentReviewerB;
  private String contentReviewerC;
  private int assignmentVersionNo;
  private String assessmentDetail;
  private String assessmentRemark;
  private String createdBy;
  private String updatedBy;
  private String createdAt;
  private String updatedAt;
  private String workflowNode;
  private String workflowStatus;
  private String rectificationNode;
  private String rectificationRemark;
  private String rectificationAt;

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

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

  public String getStatus() {
    return status;
  }

  public void setStatus(String status) {
    this.status = status;
  }

  public String getPackageObjectKey() {
    return packageObjectKey;
  }

  public void setPackageObjectKey(String packageObjectKey) {
    this.packageObjectKey = packageObjectKey;
  }

  public List<String> getEvidenceFiles() {
    return evidenceFiles;
  }

  public void setEvidenceFiles(List<String> evidenceFiles) {
    this.evidenceFiles = evidenceFiles == null ? new ArrayList<>() : evidenceFiles;
  }

  public String getAssessmentDetail() {
    return assessmentDetail;
  }

  public void setAssessmentDetail(String assessmentDetail) {
    this.assessmentDetail = assessmentDetail;
  }

  public String getAssessmentRemark() {
    return assessmentRemark;
  }

  public void setAssessmentRemark(String assessmentRemark) {
    this.assessmentRemark = assessmentRemark;
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

  public String getContentReviewerTech() {
    return contentReviewerA;
  }

  public void setContentReviewerTech(String contentReviewerTech) {
    this.contentReviewerA = contentReviewerTech;
  }

  public String getContentReviewerManagement() {
    return contentReviewerB;
  }

  public void setContentReviewerManagement(String contentReviewerManagement) {
    this.contentReviewerB = contentReviewerManagement;
  }

  public String getContentReviewerNetwork() {
    return contentReviewerC;
  }

  public void setContentReviewerNetwork(String contentReviewerNetwork) {
    this.contentReviewerC = contentReviewerNetwork;
  }

  public int getAssignmentVersionNo() {
    return assignmentVersionNo;
  }

  public void setAssignmentVersionNo(int assignmentVersionNo) {
    this.assignmentVersionNo = assignmentVersionNo;
  }

  public String getCreatedBy() {
    return createdBy;
  }

  public void setCreatedBy(String createdBy) {
    this.createdBy = createdBy;
  }

  public String getUpdatedBy() {
    return updatedBy;
  }

  public void setUpdatedBy(String updatedBy) {
    this.updatedBy = updatedBy;
  }

  public String getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(String createdAt) {
    this.createdAt = createdAt;
  }

  public String getUpdatedAt() {
    return updatedAt;
  }

  public void setUpdatedAt(String updatedAt) {
    this.updatedAt = updatedAt;
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

  public String getRectificationNode() {
    return rectificationNode;
  }

  public void setRectificationNode(String rectificationNode) {
    this.rectificationNode = rectificationNode;
  }

  public String getRectificationRemark() {
    return rectificationRemark;
  }

  public void setRectificationRemark(String rectificationRemark) {
    this.rectificationRemark = rectificationRemark;
  }

  public String getRectificationAt() {
    return rectificationAt;
  }

  public void setRectificationAt(String rectificationAt) {
    this.rectificationAt = rectificationAt;
  }
}
