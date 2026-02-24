/**
 * @input QualityReviewService with mocked JdbcTemplate and dependent node/workflow services
 * @output Unit tests for quality-review optimistic-locking and mandatory-assignment submit gate
 * @position Quality-review test layer covering concurrency and closure guardrails
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.server.ResponseStatusException;

class QualityReviewServiceTests {
  private final JdbcTemplate jdbcTemplate = org.mockito.Mockito.mock(JdbcTemplate.class);
  private final UserAccountService userAccountService = org.mockito.Mockito.mock(UserAccountService.class);
  private final OnSiteAssessmentService onSiteAssessmentService = org.mockito.Mockito.mock(OnSiteAssessmentService.class);
  private final ProjectWorkflowTraceService workflowTraceService =
      org.mockito.Mockito.mock(ProjectWorkflowTraceService.class);
  private final NotificationService notificationService = org.mockito.Mockito.mock(NotificationService.class);

  private final QualityReviewService qualityReviewService =
      new QualityReviewService(
          jdbcTemplate,
          userAccountService,
          onSiteAssessmentService,
          workflowTraceService,
          notificationService);

  @Test
  void shouldRejectAssignmentWhenVersionAlreadyChanged() {
    QualityReviewAssignmentRequest request = new QualityReviewAssignmentRequest();
    request.setTechReviewer("admin");
    request.setContentReviewerA("reviewer");
    request.setContentReviewerB("reviewer");
    request.setContentReviewerC("reviewer");
    request.setVersionNo(1);

    when(jdbcTemplate.query(
            contains("SELECT status"),
            org.mockito.ArgumentMatchers.<RowMapper<String>>any(),
            eq(100L)))
        .thenReturn(List.of("APPROVED"));
    when(userAccountService.hasRole("admin", UserAccountService.ROLE_SUPER_ADMIN)).thenReturn(true);
    when(onSiteAssessmentService.isSubmitted(100L)).thenReturn(true);
    when(userAccountService.listEnabledUsernames()).thenReturn(List.of("admin", "reviewer"));
    when(jdbcTemplate.query(
            contains("FROM workflow_assignment"),
            org.mockito.ArgumentMatchers.<RowMapper<Object>>any(),
            eq(100L)))
        .thenReturn(List.of());

    ResponseStatusException ex =
        assertThrows(
            ResponseStatusException.class,
            () -> qualityReviewService.saveAssignment(100L, request, "admin"));

    assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
    assertEquals("任务已被分配，请刷新", ex.getReason());
  }

  @Test
  void shouldRejectSubmitWhenAssignmentMissing() {
    when(jdbcTemplate.query(
            contains("SELECT status"),
            org.mockito.ArgumentMatchers.<RowMapper<String>>any(),
            eq(200L)))
        .thenReturn(List.of("APPROVED"));
    when(userAccountService.hasRole("admin", UserAccountService.ROLE_SUPER_ADMIN)).thenReturn(true);
    when(onSiteAssessmentService.isSubmitted(200L)).thenReturn(true);
    when(onSiteAssessmentService.loadSubmittedPackageKey(200L)).thenReturn("2026/onsite.zip");
    when(jdbcTemplate.query(
            contains("FROM workflow_assignment"),
            org.mockito.ArgumentMatchers.<RowMapper<Object>>any(),
            eq(200L)))
        .thenReturn(List.of());

    ResponseStatusException ex =
        assertThrows(ResponseStatusException.class, () -> qualityReviewService.submit(200L, "admin"));

    assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
    assertEquals("must assign four reviewers before submit", ex.getReason());
  }
}
