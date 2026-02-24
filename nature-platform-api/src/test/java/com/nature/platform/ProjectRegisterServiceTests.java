/**
 * @input ProjectRegisterService with mocked JdbcTemplate/Notification and Flowable runtime-task dependencies
 * @output Unit tests for project-register process start, workflow-instance sync, and status writeback trace behavior
 * @position Project registration service test layer guarding Flowable integration and review closure behavior
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.engine.runtime.ProcessInstance;
import org.flowable.engine.runtime.ProcessInstanceQuery;
import org.flowable.task.api.Task;
import org.flowable.task.api.TaskQuery;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class ProjectRegisterServiceTests {
  private final JdbcTemplate jdbcTemplate = org.mockito.Mockito.mock(JdbcTemplate.class);
  private final JsonSupport jsonSupport = org.mockito.Mockito.mock(JsonSupport.class);
  private final NotificationService notificationService = org.mockito.Mockito.mock(NotificationService.class);
  private final UserAccountService userAccountService = org.mockito.Mockito.mock(UserAccountService.class);
  private final RuntimeService runtimeService = org.mockito.Mockito.mock(RuntimeService.class);
  private final TaskService taskService = org.mockito.Mockito.mock(TaskService.class);

  @Test
  void shouldCreateWorkflowInstanceAndTraceOnSubmitReview() {
    ProjectRegisterService service =
        org.mockito.Mockito.spy(
            new ProjectRegisterService(
                jdbcTemplate,
                jsonSupport,
                notificationService,
                userAccountService,
                runtimeService,
                taskService));
    ProjectRegisterRecord project = new ProjectRegisterRecord();
    project.setId(1L);
    project.setStatus("DRAFT");
    project.setCreatedBy("creator");
    project.setApplicationName("creator-系统登记申请-合同A(2026)-2026-02-09");
    org.mockito.Mockito.doReturn(Optional.of(project)).when(service).findById(1L);

    ProcessInstanceQuery processInstanceQuery = org.mockito.Mockito.mock(ProcessInstanceQuery.class);
    when(runtimeService.createProcessInstanceQuery()).thenReturn(processInstanceQuery);
    when(processInstanceQuery.processDefinitionKey(ProjectRegisterService.PROJECT_REVIEW_WORKFLOW_KEY))
        .thenReturn(processInstanceQuery);
    when(processInstanceQuery.processInstanceBusinessKey("PROJECT_REGISTER:1")).thenReturn(processInstanceQuery);
    when(processInstanceQuery.active()).thenReturn(processInstanceQuery);
    when(processInstanceQuery.list()).thenReturn(List.of());

    ProcessInstance processInstance = org.mockito.Mockito.mock(ProcessInstance.class);
    when(processInstance.getProcessInstanceId()).thenReturn("PROC-1");
    when(runtimeService.startProcessInstanceByKey(
            eq(ProjectRegisterService.PROJECT_REVIEW_WORKFLOW_KEY), eq("PROJECT_REGISTER:1"), anyMap()))
        .thenReturn(processInstance);

    TaskQuery taskQuery = org.mockito.Mockito.mock(TaskQuery.class);
    when(taskService.createTaskQuery()).thenReturn(taskQuery);
    when(taskQuery.processInstanceId("PROC-1")).thenReturn(taskQuery);
    when(taskQuery.active()).thenReturn(taskQuery);
    when(taskQuery.orderByTaskCreateTime()).thenReturn(taskQuery);
    when(taskQuery.asc()).thenReturn(taskQuery);
    Task reviewTask = org.mockito.Mockito.mock(Task.class);
    when(reviewTask.getTaskDefinitionKey()).thenReturn("PROJECT_REGISTER_REVIEW");
    when(taskQuery.listPage(0, 1)).thenReturn(List.of(reviewTask));

    when(jdbcTemplate.query(
            contains("FROM workflow_instance"),
            org.mockito.ArgumentMatchers.<RowMapper<Long>>any(),
            eq("PROJECT_REGISTER"),
            eq(1L)))
        .thenReturn(List.of());
    when(jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class)).thenReturn(9L);
    when(userAccountService.listEnabledUsernames()).thenReturn(List.of("admin", "reviewer"));

    service.submitReview(1L, "creator");

    verify(jdbcTemplate).update(contains("UPDATE project_register SET status = 'SUBMITTED'"), eq(1L));
    verify(runtimeService)
        .startProcessInstanceByKey(
            eq(ProjectRegisterService.PROJECT_REVIEW_WORKFLOW_KEY), eq("PROJECT_REGISTER:1"), anyMap());
    verify(jdbcTemplate)
        .update(
            contains("INSERT INTO workflow_instance"),
            eq("PROJECT_REGISTER"),
            eq(1L),
            eq(ProjectRegisterService.PROJECT_REVIEW_WORKFLOW_KEY),
            eq("PROJECT_REGISTER_REVIEW"),
            eq("creator"),
            eq("PROC-1"));
    verify(jdbcTemplate)
        .update(
            contains("INSERT INTO workflow_action_log"),
            eq(9L),
            eq("PROJECT_REGISTER"),
            eq(1L),
            eq("SUBMIT"),
            eq("DRAFT"),
            eq("SUBMITTED"),
            eq("creator"),
            eq(""));

    verify(notificationService)
        .createForUsers(
            eq(List.of("admin", "reviewer")),
            contains("项目登记待审核"),
            contains("已提交审核"),
            eq("PROJECT_REGISTER_SUBMITTED"),
            eq("PROJECT_REGISTER"),
            eq(1L));
  }

  @Test
  void shouldWriteBackApproveStatusAndWorkflowTrace() {
    ProjectRegisterService service =
        org.mockito.Mockito.spy(
            new ProjectRegisterService(
                jdbcTemplate,
                jsonSupport,
                notificationService,
                userAccountService,
                runtimeService,
                taskService));
    ProjectRegisterRecord submitted = new ProjectRegisterRecord();
    submitted.setId(2L);
    submitted.setStatus("SUBMITTED");
    submitted.setCreatedBy("creator");
    submitted.setApplicationName("creator-系统登记申请-合同A(2026)-2026-02-09");
    ProjectRegisterRecord approved = new ProjectRegisterRecord();
    approved.setId(2L);
    approved.setStatus("APPROVED");
    approved.setCreatedBy("creator");
    approved.setApplicationName("creator-系统登记申请-合同A(2026)-2026-02-09");
    org.mockito.Mockito.doReturn(Optional.of(submitted), Optional.of(approved)).when(service).findById(2L);

    when(jdbcTemplate.query(
            contains("FROM workflow_instance"),
            org.mockito.ArgumentMatchers.<RowMapper<Long>>any(),
            eq("PROJECT_REGISTER"),
            eq(2L)))
        .thenReturn(List.of(11L));

    service.approve(2L, "reviewer");

    verify(jdbcTemplate).update(contains("UPDATE project_register SET status = 'APPROVED'"), eq(2L));
    verify(jdbcTemplate).update(contains("UPDATE workflow_instance"), eq("APPROVED"), eq("END"), eq(11L));
    verify(jdbcTemplate)
        .update(
            contains("INSERT INTO workflow_action_log"),
            eq(11L),
            eq("PROJECT_REGISTER"),
            eq(2L),
            eq("APPROVE"),
            eq("SUBMITTED"),
            eq("APPROVED"),
            eq("reviewer"),
            eq(""));

    verify(notificationService)
        .createForUser(
            eq("creator"),
            contains("项目登记审核通过"),
            anyString(),
            eq("PROJECT_REGISTER_APPROVED"),
            eq("PROJECT_REGISTER"),
            eq(2L));
  }
}
