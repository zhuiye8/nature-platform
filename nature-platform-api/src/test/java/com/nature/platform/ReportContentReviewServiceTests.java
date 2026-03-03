/**
 * @input ReportContentReviewService with mocked JdbcTemplate/UserAccount/WorkflowConfig dependencies
 * @output Unit tests for node-rule assignment strict mode and project-manager exclusion behavior
 * @position Report content-review service test layer guarding node-rule-driven reviewer selection regression
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.server.ResponseStatusException;

class ReportContentReviewServiceTests {
  private final JdbcTemplate jdbcTemplate = org.mockito.Mockito.mock(JdbcTemplate.class);
  private final UserAccountService userAccountService = org.mockito.Mockito.mock(UserAccountService.class);
  private final ProjectWorkflowTraceService workflowTraceService =
      org.mockito.Mockito.mock(ProjectWorkflowTraceService.class);
  private final NotificationService notificationService = org.mockito.Mockito.mock(NotificationService.class);
  private final WorkflowConfigService workflowConfigService = org.mockito.Mockito.mock(WorkflowConfigService.class);

  private final ReportContentReviewService service =
      new ReportContentReviewService(
          jdbcTemplate,
          userAccountService,
          workflowTraceService,
          notificationService,
          workflowConfigService);

  @Test
  void shouldFailWhenNodeRuleSlotMissing() {
    when(
            workflowConfigService.listRoleCodesBySlot(
                eq(ReportContentReviewService.NODE_TASK), anyString(), anyList()))
        .thenReturn(List.of());
    when(
            jdbcTemplate.query(
                contains("FROM police_register"),
                org.mockito.ArgumentMatchers.<RowMapper<String>>any(),
                eq(1L)))
        .thenReturn(List.of());

    InvocationTargetException ex =
        assertThrows(InvocationTargetException.class, () -> invokeLoadAssignment(1L));
    assertTrue(ex.getCause() instanceof ResponseStatusException);
    ResponseStatusException response = (ResponseStatusException) ex.getCause();
    assertEquals(HttpStatus.CONFLICT.value(), response.getStatusCode().value());
    assertTrue(response.getReason() != null && response.getReason().contains("节点规则缺少槽位配置"));
  }

  @Test
  void shouldExcludeProjectManagerWhenSelectingReviewers() throws Exception {
    when(
            workflowConfigService.listRoleCodesBySlot(
                eq(ReportContentReviewService.NODE_TASK), anyString(), anyList()))
        .thenAnswer(
            invocation -> {
              String slotKey = invocation.getArgument(1, String.class);
              return switch (slotKey) {
                case "CONTENT_REVIEWER_TECH" -> List.of("ROLE_CONTENT_TECH");
                case "CONTENT_REVIEWER_MANAGEMENT" -> List.of("ROLE_CONTENT_MANAGEMENT");
                case "CONTENT_REVIEWER_NETWORK" -> List.of("ROLE_CONTENT_NETWORK");
                default -> List.of();
              };
            });

    when(userAccountService.listEnabledUsernamesByRoles(eq(List.of("ROLE_CONTENT_TECH"))))
        .thenReturn(List.of("pm", "techUser"));
    when(userAccountService.listEnabledUsernamesByRoles(eq(List.of("ROLE_CONTENT_MANAGEMENT"))))
        .thenReturn(List.of("pm", "managementUser"));
    when(userAccountService.listEnabledUsernamesByRoles(eq(List.of("ROLE_CONTENT_NETWORK"))))
        .thenReturn(List.of("networkUser", "pm"));
    when(
            jdbcTemplate.query(
                contains("FROM police_register"),
                org.mockito.ArgumentMatchers.<RowMapper<String>>any(),
                eq(2L)))
        .thenReturn(List.of("pm"));

    Object assignment = invokeLoadAssignment(2L);

    assertEquals("techUser", assignmentValue(assignment, "reviewerA"));
    assertEquals("managementUser", assignmentValue(assignment, "reviewerB"));
    assertEquals("networkUser", assignmentValue(assignment, "reviewerC"));
  }

  private Object invokeLoadAssignment(long projectId) throws Exception {
    Method method = ReportContentReviewService.class.getDeclaredMethod("loadAssignment", long.class);
    method.setAccessible(true);
    return method.invoke(service, projectId);
  }

  private String assignmentValue(Object assignment, String methodName) throws Exception {
    Method method = assignment.getClass().getDeclaredMethod(methodName);
    method.setAccessible(true);
    return (String) method.invoke(assignment);
  }
}
