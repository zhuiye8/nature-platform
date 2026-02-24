/**
 * @input JdbcTemplate, user lookup, workflow trace helper, and notification service
 * @output Node-11 report technical-review save/submit and task review operations
 * @position Report technical-review domain service bridging quality gateway completion to content-review stage
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
public class ReportTechReviewService {
  public static final String NODE_APPLY = "REPORT_TECH_REVIEW_APPLY";
  public static final String NODE_TASK = "REPORT_TECH_REVIEW_TASK";
  public static final String NEXT_NODE = "REPORT_CONTENT_REVIEW";

  private final JdbcTemplate jdbcTemplate;
  private final UserAccountService userAccountService;
  private final ProjectWorkflowTraceService workflowTraceService;
  private final NotificationService notificationService;

  public ReportTechReviewService(
      JdbcTemplate jdbcTemplate,
      UserAccountService userAccountService,
      ProjectWorkflowTraceService workflowTraceService,
      NotificationService notificationService) {
    this.jdbcTemplate = jdbcTemplate;
    this.userAccountService = userAccountService;
    this.workflowTraceService = workflowTraceService;
    this.notificationService = notificationService;
  }

  public List<ReportTechReviewRecord> list() {
    return jdbcTemplate.query(baseSql() + " ORDER BY p.id DESC", new ReportTechReviewRowMapper());
  }

  public Optional<ReportTechReviewRecord> detail(long projectId) {
    List<ReportTechReviewRecord> rows =
        jdbcTemplate.query(baseSql() + " AND p.id = ?", new ReportTechReviewRowMapper(), projectId);
    return rows.stream().findFirst();
  }

  public List<String> listCandidates() {
    return userAccountService.listEnabledUsernames();
  }

  public List<ReportTechReviewTodoTask> listTodoTasks(String operator, String keyword) {
    boolean admin = isAdmin(operator);
    List<ReportTechReviewTodoTask> rows =
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
            FROM report_tech_review_task t
            JOIN report_tech_review_apply a ON a.id = t.apply_id
            JOIN project_register p ON p.id = t.project_register_id
            LEFT JOIN workflow_instance wi ON wi.biz_type = 'PROJECT_REGISTER' AND wi.biz_id = t.project_register_id
            WHERE t.status = 'PENDING'
              AND a.status = 'SUBMITTED'
              AND (? = 1 OR t.assignee = ?)
            ORDER BY a.submitted_at DESC, t.id DESC
            """,
            (rs, rowNum) ->
                new ReportTechReviewTodoTask(
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
  public ReportTechReviewRecord save(long projectId, ReportTechReviewRequest request, String operator) {
    ensureQualityApproved(projectId);
    String reviewer = loadAssignedTechReviewer(projectId);
    ensureEnabledUser(reviewer);

    List<ApplyRow> applies =
        jdbcTemplate.query(
            """
            SELECT id, status, version_no
            FROM report_tech_review_apply
            WHERE project_register_id = ?
            """,
            (rs, rowNum) -> new ApplyRow(rs.getLong("id"), rs.getString("status"), rs.getInt("version_no")),
            projectId);

    if (applies.isEmpty()) {
      int expected = request.getVersionNo() == null ? 0 : request.getVersionNo();
      if (expected != 0) {
        throw new ResponseStatusException(HttpStatus.CONFLICT, "task already assigned, refresh required");
      }
      jdbcTemplate.update(
          """
          INSERT INTO report_tech_review_apply (
            project_register_id, reviewer, status, remark, version_no, applied_by, submitted_at, finished_at, updated_by
          ) VALUES (?, ?, 'DRAFT', ?, 1, ?, NULL, NULL, ?)
          """,
          projectId,
          reviewer,
          normalizeRemark(request.getRemark()),
          operator,
          operator);
      workflowTraceService.appendAction(projectId, "REPORT_TECH_REVIEW_SAVE", null, "DRAFT", operator, "");
    } else {
      ApplyRow old = applies.get(0);
      int expected = request.getVersionNo() == null ? old.versionNo() : request.getVersionNo();
      int updated =
          jdbcTemplate.update(
              """
              UPDATE report_tech_review_apply
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
          "REPORT_TECH_REVIEW_SAVE",
          "v" + old.versionNo(),
          "v" + (old.versionNo() + 1),
          operator,
          "");
    }

    workflowTraceService.moveNode(projectId, NODE_APPLY, "PENDING", operator);
    return detail(projectId).orElseThrow();
  }

  @Transactional
  public ReportTechReviewRecord submit(long projectId, String operator) {
    ensureQualityApproved(projectId);
    String reviewer = loadAssignedTechReviewer(projectId);
    ensureEnabledUser(reviewer);

    ApplyRow apply = findApply(projectId).orElse(null);
    if (apply == null) {
      jdbcTemplate.update(
          """
          INSERT INTO report_tech_review_apply (
            project_register_id, reviewer, status, remark, version_no, applied_by, submitted_at, finished_at, updated_by
          ) VALUES (?, ?, 'DRAFT', '', 1, ?, NULL, NULL, ?)
          """,
          projectId,
          reviewer,
          operator,
          operator);
      apply = findApply(projectId).orElseThrow();
    } else if (!reviewer.equals(apply.reviewer())) {
      jdbcTemplate.update(
          """
          UPDATE report_tech_review_apply
          SET reviewer = ?, updated_by = ?
          WHERE id = ?
          """,
          reviewer,
          operator,
          apply.id());
      apply = findApply(projectId).orElseThrow();
    }

    if (!"SUBMITTED".equalsIgnoreCase(apply.status())) {
      jdbcTemplate.update(
          """
          UPDATE report_tech_review_apply
          SET status = 'SUBMITTED', submitted_at = NOW(), finished_at = NULL, updated_by = ?
          WHERE id = ?
          """,
          operator,
          apply.id());
      workflowTraceService.appendAction(
          projectId,
          "REPORT_TECH_REVIEW_SUBMIT",
          apply.status(),
          "SUBMITTED",
          operator,
          "");
    }

    jdbcTemplate.update("DELETE FROM report_tech_review_task WHERE apply_id = ?", apply.id());
    jdbcTemplate.update(
        """
        INSERT INTO report_tech_review_task (apply_id, project_register_id, assignee, status)
        VALUES (?, ?, ?, 'PENDING')
        """,
        apply.id(),
        projectId,
        reviewer);

    workflowTraceService.moveNode(projectId, NODE_TASK, "PENDING", operator);

    ProjectRef project = loadProjectRef(projectId);
    notificationService.createForUser(
        reviewer,
        "报告整体技术审核待处理",
        "项目[" + project.applicationName() + "]已进入报告整体技术审核。",
        "REPORT_TECH_REVIEW_ENTER",
        ProjectRegisterService.BIZ_TYPE,
        projectId);

    return detail(projectId).orElseThrow();
  }

  @Transactional
  public void approveTask(long taskId, String operator) {
    TaskContext task = loadTaskContext(taskId);
    ensureTaskPermission(task.assignee(), operator);
    ensureTaskPending(task.status());

    jdbcTemplate.update(
        """
        UPDATE report_tech_review_task
        SET status = 'APPROVED', remark = '', processed_by = ?, processed_at = NOW()
        WHERE id = ?
        """,
        operator,
        taskId);
    jdbcTemplate.update(
        """
        UPDATE report_tech_review_apply
        SET status = 'APPROVED', finished_at = NOW(), updated_by = ?
        WHERE id = ?
        """,
        operator,
        task.applyId());

    workflowTraceService.moveNode(task.projectId(), NEXT_NODE, "PENDING", operator);
    workflowTraceService.appendAction(
        task.projectId(), "REPORT_TECH_REVIEW_APPROVE", "SUBMITTED", "APPROVED", operator, "");

    notificationService.createForUser(
        task.appliedBy(),
        "报告整体技术审核通过",
        "项目[" + task.applicationName() + "]报告整体技术审核已通过。",
        "REPORT_TECH_REVIEW_APPROVED",
        ProjectRegisterService.BIZ_TYPE,
        task.projectId());
  }

  @Transactional
  public void rejectTask(long taskId, String operator, String remark) {
    TaskContext task = loadTaskContext(taskId);
    ensureTaskPermission(task.assignee(), operator);
    ensureTaskPending(task.status());
    String safeRemark = normalizeRemark(remark);

    jdbcTemplate.update(
        """
        UPDATE report_tech_review_task
        SET status = 'REJECTED', remark = ?, processed_by = ?, processed_at = NOW()
        WHERE id = ?
        """,
        safeRemark,
        operator,
        taskId);
    jdbcTemplate.update(
        """
        UPDATE report_tech_review_apply
        SET status = 'REJECTED', finished_at = NOW(), updated_by = ?
        WHERE id = ?
        """,
        operator,
        task.applyId());

    workflowTraceService.moveNode(task.projectId(), NODE_TASK, "REJECTED", operator);
    workflowTraceService.appendAction(
        task.projectId(), "REPORT_TECH_REVIEW_REJECT", "SUBMITTED", "REJECTED", operator, safeRemark);

    notificationService.createForUser(
        task.appliedBy(),
        "报告整体技术审核驳回",
        "项目[" + task.applicationName() + "]报告整体技术审核已驳回。",
        "REPORT_TECH_REVIEW_REJECTED",
        ProjectRegisterService.BIZ_TYPE,
        task.projectId());
  }

  private void ensureQualityApproved(long projectId) {
    List<String> rows =
        jdbcTemplate.query(
            """
            SELECT qa.status
            FROM project_register p
            LEFT JOIN quality_review_apply qa ON qa.project_register_id = p.id
            WHERE p.id = ? AND p.deleted_flag = 0
            """,
            (rs, rowNum) -> rs.getString("status"),
            projectId);
    if (rows.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "project register not found");
    }
    if (!"APPROVED".equalsIgnoreCase(rows.get(0))) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "quality review must be approved first");
    }
  }

  private Optional<ApplyRow> findApply(long projectId) {
    List<ApplyRow> rows =
        jdbcTemplate.query(
            """
            SELECT id, status, reviewer, version_no, applied_by
            FROM report_tech_review_apply
            WHERE project_register_id = ?
            """,
            (rs, rowNum) ->
                new ApplyRow(
                    rs.getLong("id"),
                    rs.getString("status"),
                    rs.getString("reviewer"),
                    rs.getInt("version_no"),
                    rs.getString("applied_by")),
            projectId);
    return rows.stream().findFirst();
  }

  private TaskContext loadTaskContext(long taskId) {
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
            FROM report_tech_review_task t
            JOIN report_tech_review_apply a ON a.id = t.apply_id
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
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "report tech review task not found");
    }
    return rows.get(0);
  }

  private String loadAssignedTechReviewer(long projectId) {
    List<String> rows =
        jdbcTemplate.query(
            "SELECT tech_reviewer FROM workflow_assignment WHERE project_register_id = ?",
            (rs, rowNum) -> rs.getString("tech_reviewer"),
            projectId);
    if (rows.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "review assignment is required before tech review");
    }
    String reviewer = normalizeUser(rows.get(0));
    if (reviewer == null) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "tech reviewer is required before tech review");
    }
    return reviewer;
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
    Set<String> enabled = Set.copyOf(userAccountService.listEnabledUsernames());
    if (!enabled.contains(username)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "assignee user not enabled: " + username);
    }
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

  private boolean isAdmin(String username) {
    return userAccountService.hasRole(username, UserAccountService.ROLE_SUPER_ADMIN);
  }

  private ProjectRef loadProjectRef(long projectId) {
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

  private boolean contains(String value, String needle) {
    return value != null && value.toLowerCase(Locale.ROOT).contains(needle);
  }

  private String stringTimestamp(Timestamp timestamp) {
    return timestamp == null ? null : String.valueOf(timestamp);
  }

  private String baseSql() {
    return """
        SELECT
          p.id project_register_id,
          p.application_name,
          qa.status quality_status,
          osa.package_object_key on_site_package_object_key,
          COALESCE(a.reviewer, wa.tech_reviewer, '') reviewer,
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
        JOIN quality_review_apply qa ON qa.project_register_id = p.id
        LEFT JOIN on_site_assessment osa ON osa.project_register_id = p.id AND osa.status = 'SUBMITTED'
        LEFT JOIN workflow_assignment wa ON wa.project_register_id = p.id
        LEFT JOIN report_tech_review_apply a ON a.project_register_id = p.id
        LEFT JOIN report_tech_review_task t ON t.project_register_id = p.id
        LEFT JOIN workflow_instance wi ON wi.biz_type = 'PROJECT_REGISTER' AND wi.biz_id = p.id
        WHERE p.deleted_flag = 0
          AND qa.status = 'APPROVED'
        """;
  }

  private static class ReportTechReviewRowMapper implements RowMapper<ReportTechReviewRecord> {
    @Override
    public ReportTechReviewRecord mapRow(ResultSet rs, int rowNum) throws SQLException {
      ReportTechReviewRecord record = new ReportTechReviewRecord();
      record.setProjectRegisterId(rs.getLong("project_register_id"));
      record.setApplicationName(rs.getString("application_name"));
      record.setQualityStatus(rs.getString("quality_status"));
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

  public record ReportTechReviewTodoTask(
      long taskId,
      long projectRegisterId,
      String applicationName,
      String appliedBy,
      String submittedAt,
      String assignee,
      String processInstanceId) {}

  private record ApplyRow(long id, String status, String reviewer, int versionNo, String appliedBy) {
    private ApplyRow(long id, String status, int versionNo) {
      this(id, status, null, versionNo, null);
    }
  }

  private record TaskContext(
      long taskId,
      long applyId,
      long projectId,
      String assignee,
      String status,
      String appliedBy,
      String applicationName) {}

  private record ProjectRef(long projectId, String applicationName) {}
}

