/**
 * @input ProcessOverviewService with mocked node-stage services and project register payload
 * @output Unit tests for process overview not-found guard and attachment aggregation behavior
 * @position Process-overview test layer ensuring cross-node snapshot composition remains stable
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class ProcessOverviewServiceTests {
  private final ProjectRegisterService projectRegisterService =
      org.mockito.Mockito.mock(ProjectRegisterService.class);
  private final PoliceRegisterService policeRegisterService =
      org.mockito.Mockito.mock(PoliceRegisterService.class);
  private final OnSiteAssessmentService onSiteAssessmentService =
      org.mockito.Mockito.mock(OnSiteAssessmentService.class);
  private final QualityReviewService qualityReviewService =
      org.mockito.Mockito.mock(QualityReviewService.class);
  private final ReportTechReviewService reportTechReviewService =
      org.mockito.Mockito.mock(ReportTechReviewService.class);
  private final ReportContentReviewService reportContentReviewService =
      org.mockito.Mockito.mock(ReportContentReviewService.class);
  private final ReportCompileService reportCompileService =
      org.mockito.Mockito.mock(ReportCompileService.class);
  private final ReportFinalReviewService reportFinalReviewService =
      org.mockito.Mockito.mock(ReportFinalReviewService.class);
  private final MaterialArchiveService materialArchiveService =
      org.mockito.Mockito.mock(MaterialArchiveService.class);

  private final ProcessOverviewService processOverviewService =
      new ProcessOverviewService(
          projectRegisterService,
          policeRegisterService,
          onSiteAssessmentService,
          qualityReviewService,
          reportTechReviewService,
          reportContentReviewService,
          reportCompileService,
          reportFinalReviewService,
          materialArchiveService);

  @Test
  void shouldReturnNotFoundWhenProjectMissing() {
    when(projectRegisterService.findById(999L)).thenReturn(Optional.empty());

    ResponseStatusException ex =
        assertThrows(ResponseStatusException.class, () -> processOverviewService.load(999L));

    assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
    assertEquals("project register not found", ex.getReason());
  }

  @Test
  void shouldAggregateAttachmentObjectKeysWithFileNames() {
    long projectId = 101L;
    ProjectRegisterRecord projectRegister = new ProjectRegisterRecord();
    projectRegister.setId(projectId);
    projectRegister.setApplicationName("demo");
    projectRegister.setStatus("APPROVED");
    projectRegister.setWorkflowNode("ON_SITE_ASSESSMENT");
    projectRegister.setWorkflowStatus("PENDING");

    ProjectSystemItemRequest systemItem = new ProjectSystemItemRequest();
    systemItem.setFilingCertificateFiles(List.of("project/filing/certificate-a.pdf"));
    systemItem.setFilingFormFiles(List.of("project/forms/form-a.docx"));
    systemItem.setClassificationReportFiles(List.of("project/classification/report-a.docx"));
    projectRegister.setSystemItems(List.of(systemItem));

    OnSiteAssessmentRecord onSite = new OnSiteAssessmentRecord();
    onSite.setPackageObjectKey("onsite/zip/assessment-package.zip");

    ReportCompileSubmissionRecord compileSubmission = new ReportCompileSubmissionRecord();
    compileSubmission.setReportObjectKey("compile/report/final-report.docx");

    MaterialArchiveRecord materialArchive = new MaterialArchiveRecord();
    materialArchive.setReportFiles(List.of("archive/report/report-1.pdf"));
    materialArchive.setFormFiles(List.of("archive/form/form-1.xlsx"));

    when(projectRegisterService.findById(projectId)).thenReturn(Optional.of(projectRegister));
    when(policeRegisterService.detail(projectId)).thenReturn(Optional.empty());
    when(onSiteAssessmentService.detail(projectId)).thenReturn(Optional.of(onSite));
    when(qualityReviewService.detail(projectId)).thenReturn(Optional.empty());
    when(reportTechReviewService.detail(projectId)).thenReturn(Optional.empty());
    when(reportContentReviewService.detail(projectId)).thenReturn(Optional.empty());
    when(reportCompileService.detailAssignment(projectId)).thenReturn(Optional.empty());
    when(reportCompileService.detailSubmission(projectId)).thenReturn(Optional.of(compileSubmission));
    when(reportFinalReviewService.detail(projectId)).thenReturn(Optional.empty());
    when(materialArchiveService.detail(projectId)).thenReturn(Optional.of(materialArchive));

    ProcessOverviewRecord result = processOverviewService.load(projectId);

    assertEquals(projectId, result.getProjectRegisterId());
    assertEquals(7, result.getAttachments().size());
    assertEquals(
        "certificate-a.pdf", result.getAttachments().get(0).getFileName());
    assertEquals(
        "assessment-package.zip", result.getAttachments().get(3).getFileName());
    assertEquals("form-1.xlsx", result.getAttachments().get(6).getFileName());
  }
}
