/**
 * @input WorkflowTaskService with mocked JdbcTemplate/Flowable and contract/project domain dependencies
 * @output Unit tests for workflow task permission checks, contract/project review guards, and task-id fallback rules
 * @position Workflow task service test layer preventing review-action regression
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Map;
import java.util.Optional;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.engine.runtime.ProcessInstance;
import org.flowable.engine.runtime.ProcessInstanceQuery;
import org.flowable.task.api.Task;
import org.flowable.task.api.TaskQuery;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

class WorkflowTaskServiceTests {
  private final JdbcTemplate jdbcTemplate = org.mockito.Mockito.mock(JdbcTemplate.class);
  private final ContractService contractService = org.mockito.Mockito.mock(ContractService.class);
  private final ProjectRegisterService projectRegisterService =
      org.mockito.Mockito.mock(ProjectRegisterService.class);
  private final ReportTechReviewService reportTechReviewService =
      org.mockito.Mockito.mock(ReportTechReviewService.class);
  private final ReportContentReviewService reportContentReviewService =
      org.mockito.Mockito.mock(ReportContentReviewService.class);
  private final ReportFinalReviewService reportFinalReviewService =
      org.mockito.Mockito.mock(ReportFinalReviewService.class);
  private final UserAccountService userAccountService = org.mockito.Mockito.mock(UserAccountService.class);
  private final TaskService taskService = org.mockito.Mockito.mock(TaskService.class);
  private final RuntimeService runtimeService = org.mockito.Mockito.mock(RuntimeService.class);
  private final WorkflowTaskService workflowTaskService =
      new WorkflowTaskService(
          jdbcTemplate,
          contractService,
          projectRegisterService,
          reportTechReviewService,
          reportContentReviewService,
          reportFinalReviewService,
          userAccountService,
          taskService,
          runtimeService);

  @Test
  void shouldRejectApproveForNonReviewer() {
    mockNoFlowableTask("CONTRACT:1");
    ResponseStatusException ex =
        assertThrows(
            ResponseStatusException.class,
            () -> workflowTaskService.approve("CONTRACT:1", "normal-user"));

    assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
  }

  @Test
  void shouldRejectListTodoForNonReviewer() {
    ResponseStatusException ex =
        assertThrows(
            ResponseStatusException.class,
            () -> workflowTaskService.listTodo("normal-user", "CONTRACT", null));

    assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
  }

  @Test
  void shouldRejectApproveWhenContractNotSubmitted() {
    when(userAccountService.hasAnyRole(eq("admin"), anyList())).thenReturn(true);
    mockNoFlowableTask("CONTRACT:1");
    ContractRecord contract = new ContractRecord();
    contract.setId(1L);
    contract.setReviewStatus("DRAFT");
    when(contractService.findById(1L)).thenReturn(Optional.of(contract));

    ResponseStatusException ex =
        assertThrows(
            ResponseStatusException.class, () -> workflowTaskService.approve("CONTRACT:1", "admin"));

    assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
    verify(contractService, never()).approve(1L, "admin");
  }

  @Test
  void shouldCallRejectWhenContractTaskSubmitted() {
    when(userAccountService.hasAnyRole(eq("reviewer"), anyList())).thenReturn(true);
    mockNoFlowableTask("CONTRACT:2");
    ContractRecord contract = new ContractRecord();
    contract.setId(2L);
    contract.setReviewStatus("SUBMITTED");
    when(contractService.findById(2L)).thenReturn(Optional.of(contract));

    workflowTaskService.reject("CONTRACT:2", "reviewer", "need fix");

    verify(contractService).reject(2L, "reviewer", "need fix");
  }

  @Test
  void shouldCallApproveWhenFlowableProjectTaskSubmitted() {
    Task task = org.mockito.Mockito.mock(Task.class);
    when(task.getExecutionId()).thenReturn("EXEC-1");
    when(task.getProcessInstanceId()).thenReturn("PROC-1");
    mockFlowableTask("1001", task, 1L);
    when(runtimeService.getVariable("EXEC-1", "projectRegisterId")).thenReturn(3L);

    ProjectRegisterRecord project = new ProjectRegisterRecord();
    project.setId(3L);
    project.setStatus("SUBMITTED");
    when(projectRegisterService.findById(3L)).thenReturn(Optional.of(project));

    workflowTaskService.approve("1001", "admin");

    verify(projectRegisterService).approve(3L, "admin");
    verify(taskService).complete(eq("1001"), eq(Map.of("approved", true, "reviewResult", "APPROVED")));
  }

  @Test
  void shouldRejectFlowableProjectTaskWhenNoPermission() {
    Task task = org.mockito.Mockito.mock(Task.class);
    when(task.getExecutionId()).thenReturn("EXEC-2");
    when(task.getProcessInstanceId()).thenReturn("PROC-2");
    mockFlowableTask("1002", task, 0L);

    ResponseStatusException ex =
        assertThrows(
            ResponseStatusException.class,
            () -> workflowTaskService.reject("1002", "reviewer", "remark"));

    assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    verify(projectRegisterService, never()).reject(org.mockito.ArgumentMatchers.anyLong(), anyString(), anyString());
    verify(taskService, never()).complete(contains("1002"), org.mockito.ArgumentMatchers.<Map<String, Object>>any());
  }

  @Test
  void shouldRejectInvalidTaskId() {
    mockNoFlowableTask("bad-task-id");
    ResponseStatusException ex =
        assertThrows(
            ResponseStatusException.class, () -> workflowTaskService.reject("bad-task-id", "admin", ""));

    assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
    verify(contractService, never()).findById(org.mockito.ArgumentMatchers.anyLong());
    verify(contractService, never()).reject(org.mockito.ArgumentMatchers.anyLong(), anyString(), anyString());
    verify(projectRegisterService, never()).findById(org.mockito.ArgumentMatchers.anyLong());
  }

  @Test
  void shouldLoadContractReviewDetailForReviewer() {
    when(userAccountService.hasAnyRole(eq("reviewer"), anyList())).thenReturn(true);
    ContractRecord contract = new ContractRecord();
    contract.setId(6L);
    contract.setReviewStatus("SUBMITTED");
    when(contractService.findById(6L)).thenReturn(Optional.of(contract));

    ContractRecord actual = workflowTaskService.loadContractReviewDetail(6L, "reviewer");

    assertSame(contract, actual);
  }

  private void mockNoFlowableTask(String taskId) {
    TaskQuery query = org.mockito.Mockito.mock(TaskQuery.class);
    when(taskService.createTaskQuery()).thenReturn(query);
    when(query.taskId(taskId)).thenReturn(query);
    when(query.singleResult()).thenReturn(null);
  }

  private void mockFlowableTask(String taskId, Task task, long permissionCount) {
    ProcessInstanceQuery processInstanceQuery = org.mockito.Mockito.mock(ProcessInstanceQuery.class);
    ProcessInstance processInstance = org.mockito.Mockito.mock(ProcessInstance.class);
    when(runtimeService.createProcessInstanceQuery()).thenReturn(processInstanceQuery);
    when(processInstanceQuery.processInstanceId(org.mockito.ArgumentMatchers.anyString()))
        .thenReturn(processInstanceQuery);
    when(processInstanceQuery.singleResult()).thenReturn(processInstance);
    when(processInstance.getProcessDefinitionKey())
        .thenReturn(ProjectRegisterService.PROJECT_REVIEW_WORKFLOW_KEY);

    TaskQuery query = org.mockito.Mockito.mock(TaskQuery.class);
    when(taskService.createTaskQuery()).thenReturn(query);
    when(query.taskId(taskId)).thenReturn(query);
    when(query.singleResult()).thenReturn(task);
    when(query.taskCandidateOrAssigned(anyString())).thenReturn(query);
    when(query.count()).thenReturn(permissionCount);
  }
}
