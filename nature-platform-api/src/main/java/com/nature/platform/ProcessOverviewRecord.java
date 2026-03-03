/**
 * @input Aggregated node-stage read models and attachment object keys across project workflow
 * @output ProcessOverviewRecord response model for task-detail aggregate query endpoint
 * @position Project workflow read model unifying node snapshots and attachment filename summaries
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.util.ArrayList;
import java.util.List;

public class ProcessOverviewRecord {
  private long projectRegisterId;
  private String applicationName;
  private String projectStatus;
  private String workflowNode;
  private String workflowStatus;
  private ProjectRegisterRecord projectRegister;
  private PoliceRegisterRecord policeRegister;
  private OnSiteAssessmentRecord onSiteAssessment;
  private ReportTechReviewRecord reportTechReview;
  private ReportContentReviewRecord reportContentReview;
  private ReportCompileAssignmentRecord reportCompileAssignment;
  private ReportCompileSubmissionRecord reportCompileSubmission;
  private ReportFinalReviewRecord reportFinalReview;
  private MaterialArchiveRecord materialArchive;
  private List<AttachmentItem> attachments = new ArrayList<>();

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

  public ProjectRegisterRecord getProjectRegister() {
    return projectRegister;
  }

  public void setProjectRegister(ProjectRegisterRecord projectRegister) {
    this.projectRegister = projectRegister;
  }

  public PoliceRegisterRecord getPoliceRegister() {
    return policeRegister;
  }

  public void setPoliceRegister(PoliceRegisterRecord policeRegister) {
    this.policeRegister = policeRegister;
  }

  public OnSiteAssessmentRecord getOnSiteAssessment() {
    return onSiteAssessment;
  }

  public void setOnSiteAssessment(OnSiteAssessmentRecord onSiteAssessment) {
    this.onSiteAssessment = onSiteAssessment;
  }

  public ReportTechReviewRecord getReportTechReview() {
    return reportTechReview;
  }

  public void setReportTechReview(ReportTechReviewRecord reportTechReview) {
    this.reportTechReview = reportTechReview;
  }

  public ReportContentReviewRecord getReportContentReview() {
    return reportContentReview;
  }

  public void setReportContentReview(ReportContentReviewRecord reportContentReview) {
    this.reportContentReview = reportContentReview;
  }

  public ReportCompileAssignmentRecord getReportCompileAssignment() {
    return reportCompileAssignment;
  }

  public void setReportCompileAssignment(ReportCompileAssignmentRecord reportCompileAssignment) {
    this.reportCompileAssignment = reportCompileAssignment;
  }

  public ReportCompileSubmissionRecord getReportCompileSubmission() {
    return reportCompileSubmission;
  }

  public void setReportCompileSubmission(ReportCompileSubmissionRecord reportCompileSubmission) {
    this.reportCompileSubmission = reportCompileSubmission;
  }

  public ReportFinalReviewRecord getReportFinalReview() {
    return reportFinalReview;
  }

  public void setReportFinalReview(ReportFinalReviewRecord reportFinalReview) {
    this.reportFinalReview = reportFinalReview;
  }

  public MaterialArchiveRecord getMaterialArchive() {
    return materialArchive;
  }

  public void setMaterialArchive(MaterialArchiveRecord materialArchive) {
    this.materialArchive = materialArchive;
  }

  public List<AttachmentItem> getAttachments() {
    return attachments;
  }

  public void setAttachments(List<AttachmentItem> attachments) {
    this.attachments = attachments;
  }

  public static class AttachmentItem {
    private String stage;
    private String field;
    private String objectKey;
    private String fileName;

    public String getStage() {
      return stage;
    }

    public void setStage(String stage) {
      this.stage = stage;
    }

    public String getField() {
      return field;
    }

    public void setField(String field) {
      this.field = field;
    }

    public String getObjectKey() {
      return objectKey;
    }

    public void setObjectKey(String objectKey) {
      this.objectKey = objectKey;
    }

    public String getFileName() {
      return fileName;
    }

    public void setFileName(String fileName) {
      this.fileName = fileName;
    }
  }
}
