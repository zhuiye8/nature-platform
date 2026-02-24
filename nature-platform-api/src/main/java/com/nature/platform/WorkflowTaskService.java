/**
 * @input JdbcTemplate task queries, Flowable task/runtime services, contract/project transitions, and user-role lookup
 * @output Workflow todo query and task action methods for contract/project/quality-review approve-reject operations
 * @position Workflow application service bridging task-center APIs to contract/project/quality review state machines
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.engine.runtime.ProcessInstance;
import org.flowable.task.api.Task;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class WorkflowTaskService {
  private static final String TASK_TYPE_CONTRACT = "CONTRACT";
  private static final String TASK_TYPE_PROJECT = "PROJECT_REGISTER";
  private static final String TASK_TYPE_QUALITY_REVIEW = "QUALITY_REVIEW";
  private static final String TASK_TYPE_REPORT_TECH_REVIEW = "REPORT_TECH_REVIEW";
  private static final String TASK_TYPE_REPORT_CONTENT_REVIEW = "REPORT_CONTENT_REVIEW";
  private static final String TASK_TYPE_REPORT_FINAL_REVIEW = "REPORT_FINAL_REVIEW";

  private final JdbcTemplate jdbcTemplate;
  private final ContractService contractService;
  private final ProjectRegisterService projectRegisterService;
  private final QualityReviewService qualityReviewService;
  private final ReportTechReviewService reportTechReviewService;
  private final ReportContentReviewService reportContentReviewService;
  private final ReportFinalReviewService reportFinalReviewService;
  private final UserAccountService userAccountService;
  private final TaskService taskService;
  private final RuntimeService runtimeService;

  public WorkflowTaskService(
      JdbcTemplate jdbcTemplate,
      ContractService contractService,
      ProjectRegisterService projectRegisterService,
      QualityReviewService qualityReviewService,
      ReportTechReviewService reportTechReviewService,
      ReportContentReviewService reportContentReviewService,
      ReportFinalReviewService reportFinalReviewService,
      UserAccountService userAccountService,
      TaskService taskService,
      RuntimeService runtimeService) {
    this.jdbcTemplate = jdbcTemplate;
    this.contractService = contractService;
    this.projectRegisterService = projectRegisterService;
    this.qualityReviewService = qualityReviewService;
    this.reportTechReviewService = reportTechReviewService;
    this.reportContentReviewService = reportContentReviewService;
    this.reportFinalReviewService = reportFinalReviewService;
    this.userAccountService = userAccountService;
    this.taskService = taskService;
    this.runtimeService = runtimeService;
  }

  public List<WorkflowTaskDto> listTodo(String operator, String type, String keyword) {
    String normalizedType = normalizeTaskType(type);
    if (TASK_TYPE_CONTRACT.equals(normalizedType)) {
      ensureReviewer(operator);
      return listContractTodo(keyword);
    }
    if (TASK_TYPE_PROJECT.equals(normalizedType)) {
      ensureReviewer(operator);
      return listProjectTodo(operator, keyword);
    }
    if (TASK_TYPE_QUALITY_REVIEW.equals(normalizedType)) {
      return listQualityReviewTodo(operator, keyword);
    }
    if (TASK_TYPE_REPORT_TECH_REVIEW.equals(normalizedType)) {
      return listReportTechReviewTodo(operator, keyword);
    }
    if (TASK_TYPE_REPORT_CONTENT_REVIEW.equals(normalizedType)) {
      return listReportContentReviewTodo(operator, keyword);
    }
    if (TASK_TYPE_REPORT_FINAL_REVIEW.equals(normalizedType)) {
      return listReportFinalReviewTodo(operator, keyword);
    }

    List<WorkflowTaskDto> rows = new ArrayList<>();
    if (isReviewer(operator)) {
      rows.addAll(listContractTodo(keyword));
      rows.addAll(listProjectTodo(operator, keyword));
    }
    rows.addAll(listQualityReviewTodo(operator, keyword));
    rows.addAll(listReportTechReviewTodo(operator, keyword));
    rows.addAll(listReportContentReviewTodo(operator, keyword));
    rows.addAll(listReportFinalReviewTodo(operator, keyword));
    rows.sort(
        Comparator.comparing(
                WorkflowTaskDto::getSubmittedAt, Comparator.nullsLast(String::compareTo))
            .reversed());
    return rows;
  }

  @Transactional
  public void approve(String taskId, String operator) {
    if (tryHandleProjectFlowTask(taskId, operator, true, "")) {
      return;
    }
    TaskRef taskRef = parseTaskId(taskId);
    switch (taskRef.type()) {
      case TASK_TYPE_QUALITY_REVIEW -> qualityReviewService.approveTask(taskRef.bizId(), operator);
      case TASK_TYPE_REPORT_TECH_REVIEW -> reportTechReviewService.approveTask(taskRef.bizId(), operator);
      case TASK_TYPE_REPORT_CONTENT_REVIEW ->
          reportContentReviewService.approveTask(taskRef.bizId(), operator);
      case TASK_TYPE_REPORT_FINAL_REVIEW -> reportFinalReviewService.approveTask(taskRef.bizId(), operator);
      case TASK_TYPE_CONTRACT -> {
        ensureReviewer(operator);
        approveContract(taskRef.bizId(), operator);
      }
      case TASK_TYPE_PROJECT -> {
        ensureReviewer(operator);
        approveProject(taskRef.bizId(), operator);
      }
      default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "unsupported task type");
    }
  }

  @Transactional
  public void reject(String taskId, String operator, String remark) {
    if (tryHandleProjectFlowTask(taskId, operator, false, remark == null ? "" : remark)) {
      return;
    }
    TaskRef taskRef = parseTaskId(taskId);
    switch (taskRef.type()) {
      case TASK_TYPE_QUALITY_REVIEW ->
          qualityReviewService.rejectTask(taskRef.bizId(), operator, remark == null ? "" : remark);
      case TASK_TYPE_REPORT_TECH_REVIEW ->
          reportTechReviewService.rejectTask(taskRef.bizId(), operator, remark == null ? "" : remark);
      case TASK_TYPE_REPORT_CONTENT_REVIEW ->
          reportContentReviewService.rejectTask(taskRef.bizId(), operator, remark == null ? "" : remark);
      case TASK_TYPE_REPORT_FINAL_REVIEW ->
          reportFinalReviewService.rejectTask(taskRef.bizId(), operator, remark == null ? "" : remark);
      case TASK_TYPE_CONTRACT -> {
        ensureReviewer(operator);
        rejectContract(taskRef.bizId(), operator, remark);
      }
      case TASK_TYPE_PROJECT -> {
        ensureReviewer(operator);
        rejectProject(taskRef.bizId(), operator, remark);
      }
      default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "unsupported task type");
    }
  }

  TaskRef parseTaskId(String taskId) {
    if (taskId == null || taskId.isBlank() || !taskId.contains(":")) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "taskId format is invalid");
    }
    String[] segments = taskId.split(":", 2);
    String type = segments[0].trim().toUpperCase(Locale.ROOT);
    long bizId;
    try {
      bizId = Long.parseLong(segments[1]);
    } catch (NumberFormatException ex) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "taskId format is invalid");
    }
    if (bizId <= 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "taskId format is invalid");
    }
    return new TaskRef(type, bizId);
  }

  private String normalizeTaskType(String type) {
    if (type == null || type.isBlank()) {
      return "ALL";
    }
    String normalized = type.trim().toUpperCase(Locale.ROOT);
    if (TASK_TYPE_CONTRACT.equals(normalized)
        || TASK_TYPE_PROJECT.equals(normalized)
        || TASK_TYPE_QUALITY_REVIEW.equals(normalized)
        || TASK_TYPE_REPORT_TECH_REVIEW.equals(normalized)
        || TASK_TYPE_REPORT_CONTENT_REVIEW.equals(normalized)
        || TASK_TYPE_REPORT_FINAL_REVIEW.equals(normalized)) {
      return normalized;
    }
    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "unsupported task type");
  }

  private List<WorkflowTaskDto> listContractTodo(String keyword) {
    StringBuilder sql =
        new StringBuilder(
            """
            SELECT c.id biz_id,
                   COALESCE(NULLIF(c.contract_name, ''), c.project_name) biz_title,
                   c.review_status status,
                   c.created_by submitted_by,
                   c.updated_at submitted_at
            FROM contract c
            WHERE c.deleted_flag = 0
              AND c.review_status = 'SUBMITTED'
            """);
    List<Object> args = new ArrayList<>();
    if (keyword != null && !keyword.isBlank()) {
      String like = "%" + keyword.trim() + "%";
      sql.append(
          """
              AND (
                COALESCE(NULLIF(c.contract_name, ''), c.project_name) LIKE ?
                OR c.created_by LIKE ?
                OR CAST(c.id AS CHAR) LIKE ?
              )
          """);
      args.add(like);
      args.add(like);
      args.add(like);
    }
    sql.append(" ORDER BY c.updated_at DESC, c.id DESC");

    return jdbcTemplate.query(
        sql.toString(),
        (rs, rowNum) -> {
          long bizId = rs.getLong("biz_id");
          Timestamp submittedAt = rs.getTimestamp("submitted_at");
          return new WorkflowTaskDto(
              buildTaskId(TASK_TYPE_CONTRACT, bizId),
              TASK_TYPE_CONTRACT,
              bizId,
              rs.getString("biz_title"),
              rs.getString("status"),
              rs.getString("submitted_by"),
              submittedAt == null ? "" : submittedAt.toString(),
              "",
              "",
              "");
        },
        args.toArray());
  }

  private List<WorkflowTaskDto> listProjectTodo(String operator, String keyword) {
    List<Task> flowableTasks =
        taskService
            .createTaskQuery()
            .processDefinitionKey(ProjectRegisterService.PROJECT_REVIEW_WORKFLOW_KEY)
            .active()
            .taskCandidateOrAssigned(operator)
            .includeProcessVariables()
            .orderByTaskCreateTime()
            .desc()
            .list();

    List<WorkflowTaskDto> rows = new ArrayList<>();
    for (Task task : flowableTasks) {
      long projectId = resolveProjectId(task, task.getProcessVariables());
      ProjectTaskContext context = loadProjectTaskContext(projectId).orElse(null);
      if (context == null) {
        continue;
      }
      if (!matchesKeyword(keyword, context.bizTitle(), context.submittedBy(), projectId)) {
        continue;
      }
      String submittedAt = context.submittedAt();
      rows.add(
          new WorkflowTaskDto(
              task.getId(),
              TASK_TYPE_PROJECT,
              projectId,
              context.bizTitle(),
              context.status(),
              context.submittedBy(),
              submittedAt,
              ProjectRegisterService.PROJECT_REVIEW_WORKFLOW_KEY,
              task.getTaskDefinitionKey(),
              task.getProcessInstanceId()));
    }
    return rows;
  }

  private List<WorkflowTaskDto> listQualityReviewTodo(String operator, String keyword) {
    List<QualityReviewService.QualityReviewTodoTask> tasks =
        qualityReviewService.listTodoTasks(operator, keyword);
    List<WorkflowTaskDto> rows = new ArrayList<>();
    for (QualityReviewService.QualityReviewTodoTask item : tasks) {
      rows.add(
          new WorkflowTaskDto(
              buildTaskId(TASK_TYPE_QUALITY_REVIEW, item.taskId()),
              TASK_TYPE_QUALITY_REVIEW,
              item.projectRegisterId(),
              item.applicationName(),
              "SUBMITTED",
              item.appliedBy(),
              item.submittedAt(),
              "QUALITY_REVIEW_MANUAL",
              item.reviewRole(),
              item.processInstanceId()));
    }
    return rows;
  }

  private List<WorkflowTaskDto> listReportTechReviewTodo(String operator, String keyword) {
    List<ReportTechReviewService.ReportTechReviewTodoTask> tasks =
        reportTechReviewService.listTodoTasks(operator, keyword);
    List<WorkflowTaskDto> rows = new ArrayList<>();
    for (ReportTechReviewService.ReportTechReviewTodoTask item : tasks) {
      rows.add(
          new WorkflowTaskDto(
              buildTaskId(TASK_TYPE_REPORT_TECH_REVIEW, item.taskId()),
              TASK_TYPE_REPORT_TECH_REVIEW,
              item.projectRegisterId(),
              item.applicationName(),
              "SUBMITTED",
              item.appliedBy(),
              item.submittedAt(),
              "REPORT_TECH_REVIEW_MANUAL",
              "TECH_REVIEW",
              item.processInstanceId()));
    }
    return rows;
  }

  private List<WorkflowTaskDto> listReportContentReviewTodo(String operator, String keyword) {
    List<ReportContentReviewService.ReportContentTodoTask> tasks =
        reportContentReviewService.listTodoTasks(operator, keyword);
    List<WorkflowTaskDto> rows = new ArrayList<>();
    for (ReportContentReviewService.ReportContentTodoTask item : tasks) {
      rows.add(
          new WorkflowTaskDto(
              buildTaskId(TASK_TYPE_REPORT_CONTENT_REVIEW, item.taskId()),
              TASK_TYPE_REPORT_CONTENT_REVIEW,
              item.projectRegisterId(),
              item.applicationName(),
              "SUBMITTED",
              item.appliedBy(),
              item.submittedAt(),
              "REPORT_CONTENT_REVIEW_MANUAL",
              item.reviewRole(),
              item.processInstanceId()));
    }
    return rows;
  }

  private List<WorkflowTaskDto> listReportFinalReviewTodo(String operator, String keyword) {
    List<ReportFinalReviewService.ReportFinalTodoTask> tasks =
        reportFinalReviewService.listTodoTasks(operator, keyword);
    List<WorkflowTaskDto> rows = new ArrayList<>();
    for (ReportFinalReviewService.ReportFinalTodoTask item : tasks) {
      rows.add(
          new WorkflowTaskDto(
              buildTaskId(TASK_TYPE_REPORT_FINAL_REVIEW, item.taskId()),
              TASK_TYPE_REPORT_FINAL_REVIEW,
              item.projectRegisterId(),
              item.applicationName(),
              "SUBMITTED",
              item.appliedBy(),
              item.submittedAt(),
              "REPORT_FINAL_REVIEW_MANUAL",
              "FINAL_REVIEW",
              item.processInstanceId()));
    }
    return rows;
  }

  private boolean tryHandleProjectFlowTask(
      String taskId, String operator, boolean approved, String rejectRemark) {
    Task task = taskService.createTaskQuery().taskId(taskId).singleResult();
    if (task == null || !isProjectReviewFlowTask(task)) {
      return false;
    }

    ensureProjectTaskPermitted(taskId, operator);
    long projectId = resolveProjectId(task, null);
    if (approved) {
      projectRegisterService.approve(projectId, operator);
      taskService.complete(taskId, Map.of("approved", true, "reviewResult", "APPROVED"));
    } else {
      String safeRemark = rejectRemark == null ? "" : rejectRemark;
      projectRegisterService.reject(projectId, operator, safeRemark);
      taskService.complete(
          taskId,
          Map.of("approved", false, "reviewResult", "REJECTED", "reviewRemark", safeRemark));
    }
    return true;
  }

  private void ensureProjectTaskPermitted(String taskId, String operator) {
    long permitted =
        taskService.createTaskQuery().taskId(taskId).taskCandidateOrAssigned(operator).count();
    if (permitted <= 0) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "current user has no permission for this task");
    }
  }

  private long resolveProjectId(Task task, Map<String, Object> knownVariables) {
    Long projectId = readLongValue(knownVariables == null ? null : knownVariables.get("projectRegisterId"));
    if (projectId == null) {
      projectId = readLongValue(knownVariables == null ? null : knownVariables.get("bizId"));
    }
    if (projectId == null) {
      projectId = readLongValue(runtimeService.getVariable(task.getExecutionId(), "projectRegisterId"));
    }
    if (projectId == null) {
      projectId = readLongValue(runtimeService.getVariable(task.getExecutionId(), "bizId"));
    }
    if (projectId == null) {
      ProcessInstance instance =
          runtimeService.createProcessInstanceQuery().processInstanceId(task.getProcessInstanceId()).singleResult();
      String businessKey = instance == null ? null : instance.getBusinessKey();
      if (businessKey != null && businessKey.contains(":")) {
        String[] segments = businessKey.split(":", 2);
        try {
          projectId = Long.parseLong(segments[1]);
        } catch (NumberFormatException ignored) {
          projectId = null;
        }
      }
    }
    if (projectId == null || projectId <= 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "can not resolve project id from task");
    }
    return projectId;
  }

  private boolean isProjectReviewFlowTask(Task task) {
    ProcessInstance instance =
        runtimeService.createProcessInstanceQuery().processInstanceId(task.getProcessInstanceId()).singleResult();
    return instance != null
        && ProjectRegisterService.PROJECT_REVIEW_WORKFLOW_KEY.equals(instance.getProcessDefinitionKey());
  }

  private Long readLongValue(Object value) {
    if (value == null) {
      return null;
    }
    if (value instanceof Number n) {
      return n.longValue();
    }
    if (value instanceof String s) {
      String normalized = s.trim();
      if (normalized.isEmpty()) {
        return null;
      }
      try {
        return Long.parseLong(normalized);
      } catch (NumberFormatException ignored) {
        return null;
      }
    }
    return null;
  }

  private boolean matchesKeyword(String keyword, String title, String submittedBy, long bizId) {
    if (keyword == null || keyword.isBlank()) {
      return true;
    }
    String needle = keyword.trim().toLowerCase(Locale.ROOT);
    return safeLower(title).contains(needle)
        || safeLower(submittedBy).contains(needle)
        || String.valueOf(bizId).contains(needle);
  }

  private String safeLower(String value) {
    return value == null ? "" : value.toLowerCase(Locale.ROOT);
  }

  private java.util.Optional<ProjectTaskContext> loadProjectTaskContext(long projectId) {
    List<ProjectTaskContext> rows =
        jdbcTemplate.query(
            """
            SELECT p.id biz_id, p.application_name biz_title, p.status status, p.created_by submitted_by, p.updated_at submitted_at
            FROM project_register p
            WHERE p.id = ? AND p.deleted_flag = 0
            """,
            (rs, rowNum) ->
                new ProjectTaskContext(
                    rs.getLong("biz_id"),
                    rs.getString("biz_title"),
                    rs.getString("status"),
                    rs.getString("submitted_by"),
                    String.valueOf(rs.getTimestamp("submitted_at"))),
            projectId);
    return rows.stream().findFirst();
  }

  private void approveContract(long contractId, String operator) {
    ContractRecord contract =
        contractService
            .findById(contractId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "contract not found"));
    ensureSubmitted(contract.getReviewStatus());
    contractService.approve(contractId, operator);
  }

  private void rejectContract(long contractId, String operator, String remark) {
    ContractRecord contract =
        contractService
            .findById(contractId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "contract not found"));
    ensureSubmitted(contract.getReviewStatus());
    contractService.reject(contractId, operator, remark == null ? "" : remark);
  }

  private void approveProject(long projectId, String operator) {
    ProjectRegisterRecord project =
        projectRegisterService
            .findById(projectId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "project register not found"));
    ensureSubmitted(project.getStatus());
    projectRegisterService.approve(projectId, operator);
  }

  private void rejectProject(long projectId, String operator, String remark) {
    ProjectRegisterRecord project =
        projectRegisterService
            .findById(projectId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "project register not found"));
    ensureSubmitted(project.getStatus());
    projectRegisterService.reject(projectId, operator, remark == null ? "" : remark);
  }

  private void ensureSubmitted(String status) {
    if (!"SUBMITTED".equalsIgnoreCase(status)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "only submitted task can be reviewed");
    }
  }

  private void ensureReviewer(String operator) {
    if (!isReviewer(operator)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "current user has no review permission");
    }
  }

  private boolean isReviewer(String operator) {
    return userAccountService.hasAnyRole(
        operator, List.of(UserAccountService.ROLE_SUPER_ADMIN, UserAccountService.ROLE_REVIEWER));
  }

  private String buildTaskId(String type, long bizId) {
    return type + ":" + bizId;
  }

  record TaskRef(String type, long bizId) {}

  private record ProjectTaskContext(
      long bizId, String bizTitle, String status, String submittedBy, String submittedAt) {}
}
