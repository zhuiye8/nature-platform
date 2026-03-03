/**
 * @input Node-stage services (project/police/on-site/report/material) and project id
 * @output Aggregated ProcessOverviewRecord snapshot including current workflow state and attachment list
 * @position Read-only application service for review-detail page across the full project lifecycle
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.util.ArrayList;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ProcessOverviewService {
  private final ProjectRegisterService projectRegisterService;
  private final PoliceRegisterService policeRegisterService;
  private final OnSiteAssessmentService onSiteAssessmentService;
  private final ReportTechReviewService reportTechReviewService;
  private final ReportContentReviewService reportContentReviewService;
  private final ReportCompileService reportCompileService;
  private final ReportFinalReviewService reportFinalReviewService;
  private final MaterialArchiveService materialArchiveService;

  public ProcessOverviewService(
      ProjectRegisterService projectRegisterService,
      PoliceRegisterService policeRegisterService,
      OnSiteAssessmentService onSiteAssessmentService,
      ReportTechReviewService reportTechReviewService,
      ReportContentReviewService reportContentReviewService,
      ReportCompileService reportCompileService,
      ReportFinalReviewService reportFinalReviewService,
      MaterialArchiveService materialArchiveService) {
    this.projectRegisterService = projectRegisterService;
    this.policeRegisterService = policeRegisterService;
    this.onSiteAssessmentService = onSiteAssessmentService;
    this.reportTechReviewService = reportTechReviewService;
    this.reportContentReviewService = reportContentReviewService;
    this.reportCompileService = reportCompileService;
    this.reportFinalReviewService = reportFinalReviewService;
    this.materialArchiveService = materialArchiveService;
  }

  public ProcessOverviewRecord load(long projectId) {
    ProjectRegisterRecord projectRegister =
        projectRegisterService
            .findById(projectId)
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "project register not found"));

    ProcessOverviewRecord record = new ProcessOverviewRecord();
    record.setProjectRegisterId(projectRegister.getId());
    record.setApplicationName(projectRegister.getApplicationName());
    record.setProjectStatus(projectRegister.getStatus());
    record.setWorkflowNode(projectRegister.getWorkflowNode());
    record.setWorkflowStatus(projectRegister.getWorkflowStatus());
    record.setProjectRegister(projectRegister);
    record.setPoliceRegister(policeRegisterService.detail(projectId).orElse(null));
    record.setOnSiteAssessment(onSiteAssessmentService.detail(projectId).orElse(null));
    record.setReportTechReview(reportTechReviewService.detail(projectId).orElse(null));
    record.setReportContentReview(reportContentReviewService.detail(projectId).orElse(null));
    record.setReportCompileAssignment(reportCompileService.detailAssignment(projectId).orElse(null));
    record.setReportCompileSubmission(reportCompileService.detailSubmission(projectId).orElse(null));
    record.setReportFinalReview(reportFinalReviewService.detail(projectId).orElse(null));
    record.setMaterialArchive(materialArchiveService.detail(projectId).orElse(null));
    record.setAttachments(collectAttachments(record));
    return record;
  }

  private List<ProcessOverviewRecord.AttachmentItem> collectAttachments(ProcessOverviewRecord record) {
    List<ProcessOverviewRecord.AttachmentItem> rows = new ArrayList<>();
    collectProjectRegisterAttachments(record.getProjectRegister(), rows);
    collectOnSiteAttachments(record.getOnSiteAssessment(), rows);
    collectCompileAttachments(record.getReportCompileSubmission(), rows);
    collectMaterialAttachments(record.getMaterialArchive(), rows);
    return rows;
  }

  private void collectProjectRegisterAttachments(
      ProjectRegisterRecord projectRegister, List<ProcessOverviewRecord.AttachmentItem> collector) {
    if (projectRegister == null || projectRegister.getSystemItems() == null) {
      return;
    }
    int index = 0;
    for (ProjectSystemItemRequest item : projectRegister.getSystemItems()) {
      index++;
      addAttachmentList(collector, "项目登记", "系统明细" + index + "-备案证明", item.getFilingCertificateFiles());
      addAttachmentList(collector, "项目登记", "系统明细" + index + "-备案表", item.getFilingFormFiles());
      addAttachmentList(collector, "项目登记", "系统明细" + index + "-定级报告", item.getClassificationReportFiles());
    }
  }

  private void collectOnSiteAttachments(
      OnSiteAssessmentRecord onSiteAssessment, List<ProcessOverviewRecord.AttachmentItem> collector) {
    if (onSiteAssessment == null) {
      return;
    }
    List<String> evidenceFiles = onSiteAssessment.getEvidenceFiles();
    if (evidenceFiles != null && !evidenceFiles.isEmpty()) {
      addAttachmentList(collector, "现场测评", "测评附件", evidenceFiles);
      return;
    }
    addAttachment(collector, "现场测评", "测评压缩包", onSiteAssessment.getPackageObjectKey());
  }

  private void collectCompileAttachments(
      ReportCompileSubmissionRecord submission, List<ProcessOverviewRecord.AttachmentItem> collector) {
    if (submission == null) {
      return;
    }
    addAttachment(collector, "报告编制", "报告文件", submission.getReportObjectKey());
  }

  private void collectMaterialAttachments(
      MaterialArchiveRecord materialArchive, List<ProcessOverviewRecord.AttachmentItem> collector) {
    if (materialArchive == null) {
      return;
    }
    addAttachmentList(collector, "材料归档", "归档报告文件", materialArchive.getReportFiles());
    addAttachmentList(collector, "材料归档", "归档表单文件", materialArchive.getFormFiles());
  }

  private void addAttachmentList(
      List<ProcessOverviewRecord.AttachmentItem> collector,
      String stage,
      String field,
      List<String> objectKeys) {
    if (objectKeys == null || objectKeys.isEmpty()) {
      return;
    }
    for (String objectKey : objectKeys) {
      addAttachment(collector, stage, field, objectKey);
    }
  }

  private void addAttachment(
      List<ProcessOverviewRecord.AttachmentItem> collector,
      String stage,
      String field,
      String objectKey) {
    if (objectKey == null || objectKey.isBlank()) {
      return;
    }
    String normalizedKey = objectKey.trim();
    ProcessOverviewRecord.AttachmentItem row = new ProcessOverviewRecord.AttachmentItem();
    row.setStage(stage);
    row.setField(field);
    row.setObjectKey(normalizedKey);
    row.setFileName(resolveFileName(normalizedKey));
    collector.add(row);
  }

  private String resolveFileName(String objectKey) {
    int slashIndex = Math.max(objectKey.lastIndexOf('/'), objectKey.lastIndexOf('\\'));
    if (slashIndex < 0 || slashIndex == objectKey.length() - 1) {
      return objectKey;
    }
    return objectKey.substring(slashIndex + 1);
  }
}

