/**
 * @input JdbcTemplate, user-account service, workflow trace helper, notifications, and compile-stage data
 * @output Node-15 final-review save/auto-submit and task approve/reject operations with unified displayStatus projection
 * @position Report final-review service bridging compile submission completion to material archive stage
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ReportFinalReviewService {
  public static final String NODE_TASK = "REPORT_FINAL_REVIEW_TASK";
  public static final String NEXT_NODE = "MATERIAL_ARCHIVE";

  private final JdbcTemplate jdbcTemplate;
  private final UserAccountService userAccountService;
  private final ProjectWorkflowTraceService workflowTraceService;
  private final NotificationService notificationService;

  public ReportFinalReviewService(
      JdbcTemplate jdbcTemplate,
      UserAccountService userAccountService,
      ProjectWorkflowTraceService workflowTraceService,
      NotificationService notificationService) {
    this.jdbcTemplate = jdbcTemplate;
    this.userAccountService = userAccountService;
    this.workflowTraceService = workflowTraceService;
    this.notificationService = notificationService;
  }

  public List<ReportFinalReviewRecord> list() {
    List<ReportFinalReviewRecord> rows =
        jdbcTemplate.query(baseSql() + " ORDER BY p.id DESC", new ReportFinalReviewRowMapper());
    rows.forEach(this::applyDisplayStatus);
    return rows;
  }

  public Optional<ReportFinalReviewRecord> detail(long projectId) {
    List<ReportFinalReviewRecord> rows =
        jdbcTemplate.query(baseSql() + " AND p.id = ?", new ReportFinalReviewRowMapper(), projectId);
    Optional<ReportFinalReviewRecord> first = rows.stream().findFirst();
    first.ifPresent(this::applyDisplayStatus);
    return first;
  }

  public List<String> listCandidates() {
    return userAccountService.listEnabledUsernames();
  }

  public List<ReportFinalTodoTask> listTodoTasks(String operator, String keyword) {
    boolean admin = isAdmin(operator);
    List<ReportFinalTodoTask> rows =
        jdbcTemplate.query(
            """
            SELECT
              t.id,
              t.project_register_id,
              p.application_name,
              a.applied_by,
              a.submitted_at,
              t.assignee,
              wi.process_instance_id
            FROM report_final_review_task t
            JOIN report_final_review_apply a ON a.id = t.apply_id
            JOIN project_register p ON p.id = t.project_register_id
            LEFT JOIN workflow_instance wi ON wi.biz_type = 'PROJECT_REGISTER' AND wi.biz_id = t.project_register_id
            WHERE t.status = 'PENDING'
              AND a.status = 'SUBMITTED'
              AND (? = 1 OR t.assignee = ?)
            ORDER BY a.submitted_at DESC, t.id DESC
            """,
            (rs, rowNum) ->
                new ReportFinalTodoTask(
                    rs.getLong("id"),
                    rs.getLong("project_register_id"),
                    rs.getString("application_name"),
                    rs.getString("applied_by"),
                    stringTimestamp(rs.getTimestamp("submitted_at")),
                    rs.getString("assignee"),
                    rs.getString("process_instance_id")),
            admin ? 1 : 0,
            operator);

    if (keyword == null || keyword.isBlank()) {
      return rows;
    }
    String needle = keyword.trim().toLowerCase(Locale.ROOT);
    return rows.stream()
        .filter(
            item ->
                contains(item.applicationName(), needle)
                    || contains(item.appliedBy(), needle)
                    || contains(item.assignee(), needle)
                    || String.valueOf(item.projectRegisterId()).contains(needle))
        .toList();
  }

  @Transactional
  public ReportFinalReviewRecord save(long projectId, ReportFinalReviewRequest request, String operator) {
    ensureCompileSubmitted(projectId);
    String reviewer = normalizeUser(request.getReviewer());
    ensureEnabledUser(reviewer);

    List<ApplyRow> applies =
        jdbcTemplate.query(
            """
            SELECT id, status, version_no
            FROM report_final_review_apply
            WHERE project_register_id = ?
            """,
            (rs, rowNum) ->
                new ApplyRow(
                    rs.getLong("id"), rs.getString("status"), rs.getInt("version_no"), null, null),
            projectId);

    if (applies.isEmpty()) {
      int expected = request.getVersionNo() == null ? 0 : request.getVersionNo();
      if (expected != 0) {
        throw new ResponseStatusException(HttpStatus.CONFLICT, "task already assigned, refresh required");
      }
      jdbcTemplate.update(
          """
          INSERT INTO report_final_review_apply (
            project_register_id, reviewer, status, remark, version_no, applied_by, submitted_at, finished_at, updated_by
          ) VALUES (?, ?, 'DRAFT', ?, 1, ?, NULL, NULL, ?)
          """,
          projectId,
          reviewer,
          normalizeRemark(request.getRemark()),
          operator,
          operator);
      workflowTraceService.appendAction(projectId, "REPORT_FINAL_REVIEW_SAVE", null, "DRAFT", operator, "");
    } else {
      ApplyRow old = applies.get(0);
      int expected = request.getVersionNo() == null ? old.versionNo() : request.getVersionNo();
      int updated =
          jdbcTemplate.update(
              """
              UPDATE report_final_review_apply
              SET reviewer = ?, remark = ?,
                  status = CASE WHEN status = 'SUBMITTED' THEN 'SUBMITTED' ELSE 'DRAFT' END,
                  version_no = version_no + 1,
                  updated_by = ?
              WHERE id = ? AND version_no = ?
              """,
              reviewer,
              normalizeRemark(request.getRemark()),
              operator,
              old.id(),
              expected);
      if (updated == 0) {
        throw new ResponseStatusException(HttpStatus.CONFLICT, "task already assigned, refresh required");
      }
      workflowTraceService.appendAction(
          projectId,
          "REPORT_FINAL_REVIEW_SAVE",
          "v" + old.versionNo(),
          "v" + (old.versionNo() + 1),
          operator,
          "");
    }

    // 配置保存后自动提交并刷新最终审核待办，收口手工提交入口。
    return submit(projectId, operator);
  }

  @Transactional
  public ReportFinalReviewRecord submit(long projectId, String operator) {
    ensureCompileSubmitted(projectId);
    ApplyRow apply = loadApply(projectId);
    if (apply.reviewer() == null || apply.reviewer().isBlank()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "reviewer is required before submit");
    }

    if (!"SUBMITTED".equalsIgnoreCase(apply.status())) {
      jdbcTemplate.update(
          """
          UPDATE report_final_review_apply
          SET status = 'SUBMITTED', submitted_at = NOW(), finished_at = NULL, updated_by = ?
          WHERE id = ?
          """,
          operator,
          apply.id());
      workflowTraceService.appendAction(
          projectId,
          "REPORT_FINAL_REVIEW_SUBMIT",
          apply.status(),
          "SUBMITTED",
          operator,
          "");
    }

    jdbcTemplate.update("DELETE FROM report_final_review_task WHERE apply_id = ?", apply.id());
    jdbcTemplate.update(
        """
        INSERT INTO report_final_review_task (apply_id, project_register_id, assignee, status)
        VALUES (?, ?, ?, 'PENDING')
        """,
        apply.id(),
        projectId,
        apply.reviewer());

    workflowTraceService.moveNode(projectId, NODE_TASK, "PENDING", operator);

    ProjectRef project = loadProject(projectId);
    notificationService.createForUser(
        apply.reviewer(),
        "报告审核待处理",
        "项目[" + project.applicationName() + "]已进入报告审核阶段。",
        "REPORT_FINAL_REVIEW_ENTER",
        ProjectRegisterService.BIZ_TYPE,
        projectId);

    return detail(projectId).orElseThrow();
  }

  @Transactional
  public void approveTask(long taskId, String operator) {
    TaskContext task = loadTask(taskId);
    ensureTaskPermission(task.assignee(), operator);
    ensureTaskPending(task.status());

    jdbcTemplate.update(
        """
        UPDATE report_final_review_task
        SET status = 'APPROVED', remark = '', processed_by = ?, processed_at = NOW()
        WHERE id = ?
        """,
        operator,
        taskId);
    jdbcTemplate.update(
        """
        UPDATE report_final_review_apply
        SET status = 'APPROVED', finished_at = NOW(), updated_by = ?
        WHERE id = ?
        """,
        operator,
        task.applyId());

    workflowTraceService.moveNode(task.projectId(), NEXT_NODE, "PENDING", operator);
    workflowTraceService.appendAction(
        task.projectId(), "REPORT_FINAL_REVIEW_APPROVE", "SUBMITTED", "APPROVED", operator, "");

    notificationService.createForUser(
        task.appliedBy(),
        "报告审核通过",
        "项目[" + task.applicationName() + "]报告审核已通过，请进行材料归档。",
        "REPORT_FINAL_REVIEW_APPROVED",
        ProjectRegisterService.BIZ_TYPE,
        task.projectId());
  }

  @Transactional
  public void rejectTask(long taskId, String operator, String remark) {
    TaskContext task = loadTask(taskId);
    ensureTaskPermission(task.assignee(), operator);
    ensureTaskPending(task.status());
    String safeRemark = normalizeRemark(remark);

    jdbcTemplate.update(
        """
        UPDATE report_final_review_task
        SET status = 'REJECTED', remark = ?, processed_by = ?, processed_at = NOW()
        WHERE id = ?
        """,
        safeRemark,
        operator,
        taskId);
    jdbcTemplate.update(
        """
        UPDATE report_final_review_apply
        SET status = 'REJECTED', finished_at = NOW(), updated_by = ?
        WHERE id = ?
        """,
        operator,
        task.applyId());

    workflowTraceService.moveNode(task.projectId(), NODE_TASK, "REJECTED", operator);
    workflowTraceService.appendAction(
        task.projectId(), "REPORT_FINAL_REVIEW_REJECT", "SUBMITTED", "REJECTED", operator, safeRemark);

    notificationService.createForUser(
        task.appliedBy(),
        "报告审核驳回",
        "项目[" + task.applicationName() + "]报告审核已驳回。",
        "REPORT_FINAL_REVIEW_REJECTED",
        ProjectRegisterService.BIZ_TYPE,
        task.projectId());

    String compileAssignee = loadCompileAssignee(task.projectId());
    if (compileAssignee != null && !compileAssignee.isBlank()) {
      notificationService.createForUser(
          compileAssignee,
          "报告需重新编制",
          "项目[" + task.applicationName() + "]报告审核驳回，请调整后重新提交。",
          "REPORT_COMPILE_REWORK_REQUIRED",
          ProjectRegisterService.BIZ_TYPE,
          task.projectId());
    }
  }

  private void ensureCompileSubmitted(long projectId) {
    List<CompileRow> rows =
        jdbcTemplate.query(
            """
            SELECT status, report_object_key
            FROM report_compile_submission
            WHERE project_register_id = ?
            """,
            (rs, rowNum) -> new CompileRow(rs.getString("status"), rs.getString("report_object_key")),
            projectId);
    if (rows.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "report compile submission is required first");
    }
    CompileRow compile = rows.get(0);
    if (!"SUBMITTED".equalsIgnoreCase(compile.status())) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "report compile submission must be submitted first");
    }
    if (compile.reportObjectKey() == null || compile.reportObjectKey().isBlank()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "report object key is required before final review");
    }
  }

  private ApplyRow loadApply(long projectId) {
    List<ApplyRow> rows =
        jdbcTemplate.query(
            """
            SELECT id, status, reviewer, version_no, applied_by
            FROM report_final_review_apply
            WHERE project_register_id = ?
            """,
            (rs, rowNum) ->
                new ApplyRow(
                    rs.getLong("id"),
                    rs.getString("status"),
                    rs.getInt("version_no"),
                    rs.getString("reviewer"),
                    rs.getString("applied_by")),
            projectId);
    if (rows.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "report final review draft is required");
    }
    return rows.get(0);
  }

  private TaskContext loadTask(long taskId) {
    List<TaskContext> rows =
        jdbcTemplate.query(
            """
            SELECT
              t.id,
              t.apply_id,
              t.project_register_id,
              t.assignee,
              t.status,
              a.applied_by,
              p.application_name
            FROM report_final_review_task t
            JOIN report_final_review_apply a ON a.id = t.apply_id
            JOIN project_register p ON p.id = t.project_register_id
            WHERE t.id = ?
            """,
            (rs, rowNum) ->
                new TaskContext(
                    rs.getLong("id"),
                    rs.getLong("apply_id"),
                    rs.getLong("project_register_id"),
                    rs.getString("assignee"),
                    rs.getString("status"),
                    rs.getString("applied_by"),
                    rs.getString("application_name")),
            taskId);
    if (rows.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "report final review task not found");
    }
    return rows.get(0);
  }

  private String loadCompileAssignee(long projectId) {
    List<String> rows =
        jdbcTemplate.query(
            "SELECT assignee FROM report_compile_assignment WHERE project_register_id = ?",
            (rs, rowNum) -> rs.getString("assignee"),
            projectId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private void ensureTaskPermission(String assignee, String operator) {
    if (isAdmin(operator)) {
      return;
    }
    if (!operator.equals(assignee)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "current user has no permission for this task");
    }
  }

  private void ensureTaskPending(String status) {
    if (!"PENDING".equalsIgnoreCase(status)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "task already processed");
    }
  }

  private void ensureEnabledUser(String username) {
    Set<String> users = Set.copyOf(userAccountService.listEnabledUsernames());
    if (!users.contains(username)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "assignee user not enabled: " + username);
    }
  }

  private boolean isAdmin(String username) {
    return userAccountService.hasRole(username, UserAccountService.ROLE_SUPER_ADMIN);
  }

  private boolean contains(String value, String needle) {
    return value != null && value.toLowerCase(Locale.ROOT).contains(needle);
  }

  private String normalizeUser(String username) {
    if (username == null) {
      return null;
    }
    String value = username.trim();
    return value.isEmpty() ? null : value;
  }

  private String normalizeRemark(String value) {
    if (value == null) {
      return "";
    }
    return value.trim();
  }

  private void applyDisplayStatus(ReportFinalReviewRecord row) {
    String taskStatus = normalizeStatus(row.getTaskStatus());
    if (taskStatus != null) {
      row.setDisplayStatus(taskStatus);
      return;
    }
    if (NODE_TASK.equalsIgnoreCase(row.getWorkflowNode())
        && "PENDING".equalsIgnoreCase(row.getWorkflowStatus())) {
      row.setDisplayStatus("PENDING");
      return;
    }
    row.setDisplayStatus(normalizeApplyStatus(row.getStatus()));
  }

  private String normalizeApplyStatus(String status) {
    String normalized = normalizeStatus(status);
    if (normalized == null) {
      return "DRAFT";
    }
    if ("SUBMITTED".equals(normalized)) {
      return "PENDING";
    }
    return normalized;
  }

  private String normalizeStatus(String status) {
    if (status == null || status.isBlank()) {
      return null;
    }
    return status.trim().toUpperCase(Locale.ROOT);
  }

  private String stringTimestamp(Timestamp timestamp) {
    return timestamp == null ? null : String.valueOf(timestamp);
  }

  private ProjectRef loadProject(long projectId) {
    List<ProjectRef> rows =
        jdbcTemplate.query(
            "SELECT id, application_name FROM project_register WHERE id = ? AND deleted_flag = 0",
            (rs, rowNum) -> new ProjectRef(rs.getLong("id"), rs.getString("application_name")),
            projectId);
    if (rows.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "project register not found");
    }
    return rows.get(0);
  }

  private String baseSql() {
    return """
        SELECT
          p.id project_register_id,
          p.application_name,
          c.status compile_status,
          osa.package_object_key on_site_package_object_key,
          COALESCE(a.reviewer, '') reviewer,
          COALESCE(a.status, 'DRAFT') status,
          a.remark,
          COALESCE(a.version_no, 0) version_no,
          a.applied_by,
          a.submitted_at,
          a.finished_at,
          t.id task_id,
          t.status task_status,
          wi.current_node workflow_node,
          wi.status workflow_status
        FROM project_register p
        JOIN report_compile_submission c ON c.project_register_id = p.id
        LEFT JOIN on_site_assessment osa ON osa.project_register_id = p.id AND osa.status = 'SUBMITTED'
        LEFT JOIN report_final_review_apply a ON a.project_register_id = p.id
        LEFT JOIN report_final_review_task t ON t.project_register_id = p.id
        LEFT JOIN workflow_instance wi ON wi.biz_type = 'PROJECT_REGISTER' AND wi.biz_id = p.id
        WHERE p.deleted_flag = 0
          AND c.status = 'SUBMITTED'
        """;
  }

  private static class ReportFinalReviewRowMapper implements RowMapper<ReportFinalReviewRecord> {
    @Override
    public ReportFinalReviewRecord mapRow(ResultSet rs, int rowNum) throws SQLException {
      ReportFinalReviewRecord record = new ReportFinalReviewRecord();
      record.setProjectRegisterId(rs.getLong("project_register_id"));
      record.setApplicationName(rs.getString("application_name"));
      record.setCompileStatus(rs.getString("compile_status"));
      record.setOnSitePackageObjectKey(rs.getString("on_site_package_object_key"));
      record.setReviewer(rs.getString("reviewer"));
      record.setStatus(rs.getString("status"));
      record.setRemark(rs.getString("remark"));
      record.setVersionNo(rs.getInt("version_no"));
      record.setAppliedBy(rs.getString("applied_by"));
      record.setSubmittedAt(stringTimestamp(rs.getTimestamp("submitted_at")));
      record.setFinishedAt(stringTimestamp(rs.getTimestamp("finished_at")));
      Long taskId = rs.getLong("task_id");
      if (rs.wasNull()) {
        taskId = null;
      }
      record.setTaskId(taskId);
      record.setTaskStatus(rs.getString("task_status"));
      record.setWorkflowNode(rs.getString("workflow_node"));
      record.setWorkflowStatus(rs.getString("workflow_status"));
      return record;
    }

    private String stringTimestamp(Timestamp timestamp) {
      return timestamp == null ? null : String.valueOf(timestamp);
    }
  }

  public record ReportFinalTodoTask(
      long taskId,
      long projectRegisterId,
      String applicationName,
      String appliedBy,
      String submittedAt,
      String assignee,
      String processInstanceId) {}

  private record CompileRow(String status, String reportObjectKey) {}

  private record ApplyRow(long id, String status, int versionNo, String reviewer, String appliedBy) {}

  private record TaskContext(
      long id,
      long applyId,
      long projectId,
      String assignee,
      String status,
      String appliedBy,
      String applicationName) {}

  private record ProjectRef(long id, String applicationName) {}
}

