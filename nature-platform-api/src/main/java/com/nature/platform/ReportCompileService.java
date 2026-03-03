/**
 * @input JdbcTemplate, user-account, workflow trace, notification, and project context data
 * @output Node-13 assignment and node-14 report compile upload save/submit operations with node-rule assigned final-review auto task sync
 * @position Report compile workflow service bridging content-review completion to final-review task stage
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ReportCompileService {
  public static final String NODE_ASSIGN = "REPORT_COMPILE_ASSIGN";
  public static final String NODE_UPLOAD = "REPORT_COMPILE_UPLOAD";

  private final JdbcTemplate jdbcTemplate;
  private final UserAccountService userAccountService;
  private final ProjectWorkflowTraceService workflowTraceService;
  private final NotificationService notificationService;
  private final ReportFinalReviewService reportFinalReviewService;

  public ReportCompileService(
      JdbcTemplate jdbcTemplate,
      UserAccountService userAccountService,
      ProjectWorkflowTraceService workflowTraceService,
      NotificationService notificationService,
      ReportFinalReviewService reportFinalReviewService) {
    this.jdbcTemplate = jdbcTemplate;
    this.userAccountService = userAccountService;
    this.workflowTraceService = workflowTraceService;
    this.notificationService = notificationService;
    this.reportFinalReviewService = reportFinalReviewService;
  }

  public List<ReportCompileAssignmentRecord> listAssignments() {
    return jdbcTemplate.query(assignmentSql() + " ORDER BY p.id DESC", new AssignmentRowMapper());
  }

  public Optional<ReportCompileAssignmentRecord> detailAssignment(long projectId) {
    List<ReportCompileAssignmentRecord> rows =
        jdbcTemplate.query(assignmentSql() + " AND p.id = ?", new AssignmentRowMapper(), projectId);
    return rows.stream().findFirst();
  }

  public List<ReportCompileSubmissionRecord> listSubmissions() {
    return jdbcTemplate.query(submissionSql() + " ORDER BY p.id DESC", new SubmissionRowMapper());
  }

  public Optional<ReportCompileSubmissionRecord> detailSubmission(long projectId) {
    List<ReportCompileSubmissionRecord> rows =
        jdbcTemplate.query(submissionSql() + " AND p.id = ?", new SubmissionRowMapper(), projectId);
    return rows.stream().findFirst();
  }

  public List<String> listCandidates() {
    return userAccountService.listEnabledUsernames();
  }

  @Transactional
  public ReportCompileAssignmentRecord saveAssignment(
      long projectId, ReportCompileAssignmentRequest request, String operator) {
    ensureContentReviewApproved(projectId);
    String assignee = normalizeUser(request.getAssignee());
    if (assignee == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "assignee is required");
    }
    ensureEnabledUser(assignee);

    List<AssignmentRow> rows =
        jdbcTemplate.query(
            """
            SELECT id, assignee, status, version_no
            FROM report_compile_assignment
            WHERE project_register_id = ?
            """,
            (rs, rowNum) ->
                new AssignmentRow(
                    rs.getLong("id"),
                    rs.getString("assignee"),
                    rs.getString("status"),
                    rs.getInt("version_no")),
            projectId);

    if (rows.isEmpty()) {
      int expected = request.getVersionNo() == null ? 0 : request.getVersionNo();
      if (expected != 0) {
        throw new ResponseStatusException(HttpStatus.CONFLICT, "task already assigned, refresh required");
      }
      jdbcTemplate.update(
          """
          INSERT INTO report_compile_assignment (
            project_register_id, assignee, status, version_no, submitted_at, updated_by
          ) VALUES (?, ?, 'DRAFT', 1, NULL, ?)
          """,
          projectId,
          assignee,
          operator);
      workflowTraceService.appendAction(projectId, "REPORT_COMPILE_ASSIGN_SAVE", null, "DRAFT", operator, "");
    } else {
      AssignmentRow old = rows.get(0);
      int expected = request.getVersionNo() == null ? old.versionNo() : request.getVersionNo();
      int updated =
          jdbcTemplate.update(
              """
              UPDATE report_compile_assignment
              SET assignee = ?,
                  status = CASE WHEN status = 'SUBMITTED' THEN 'SUBMITTED' ELSE 'DRAFT' END,
                  version_no = version_no + 1,
                  updated_by = ?
              WHERE id = ? AND version_no = ?
              """,
              assignee,
              operator,
              old.id(),
              expected);
      if (updated == 0) {
        throw new ResponseStatusException(HttpStatus.CONFLICT, "task already assigned, refresh required");
      }
      workflowTraceService.appendAction(
          projectId,
          "REPORT_COMPILE_ASSIGN_SAVE",
          "v" + old.versionNo(),
          "v" + (old.versionNo() + 1),
          operator,
          "");
    }

    workflowTraceService.moveNode(projectId, NODE_ASSIGN, "PENDING", operator);
    return detailAssignment(projectId).orElseThrow();
  }

  @Transactional
  public ReportCompileAssignmentRecord submitAssignment(long projectId, String operator) {
    ensureContentReviewApproved(projectId);
    AssignmentRow assignment = loadAssignment(projectId);
    if (assignment.assignee() == null || assignment.assignee().isBlank()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "assignee is required before submit");
    }

    if (!"SUBMITTED".equalsIgnoreCase(assignment.status())) {
      jdbcTemplate.update(
          """
          UPDATE report_compile_assignment
          SET status = 'SUBMITTED', submitted_at = NOW(), updated_by = ?
          WHERE id = ?
          """,
          operator,
          assignment.id());
      workflowTraceService.appendAction(
          projectId,
          "REPORT_COMPILE_ASSIGN_SUBMIT",
          assignment.status(),
          "SUBMITTED",
          operator,
          "");
    }

    workflowTraceService.moveNode(projectId, NODE_UPLOAD, "PENDING", operator);

    ProjectRef project = loadProject(projectId);
    notificationService.createForUser(
        assignment.assignee(),
        "报告编制任务待处理",
        "项目[" + project.applicationName() + "]已分配报告编制任务。",
        "REPORT_COMPILE_ASSIGN_ENTER",
        ProjectRegisterService.BIZ_TYPE,
        projectId);

    return detailAssignment(projectId).orElseThrow();
  }

  @Transactional
  public ReportCompileSubmissionRecord saveSubmission(
      long projectId, ReportCompileSubmissionRequest request, String operator) {
    ensureAssignmentSubmitted(projectId);
    ensureCompilePermission(projectId, operator);

    String objectKey = normalizeText(request.getReportObjectKey());
    String remark = normalizeText(request.getReportRemark());

    List<SubmissionRow> rows =
        jdbcTemplate.query(
            """
            SELECT id, status, report_object_key
            FROM report_compile_submission
            WHERE project_register_id = ?
            """,
            (rs, rowNum) ->
                new SubmissionRow(rs.getLong("id"), rs.getString("status"), rs.getString("report_object_key")),
            projectId);

    if (rows.isEmpty()) {
      jdbcTemplate.update(
          """
          INSERT INTO report_compile_submission (
            project_register_id, report_object_key, report_remark, status, submitted_by, submitted_at, finished_at, updated_by
          ) VALUES (?, ?, ?, 'DRAFT', NULL, NULL, NULL, ?)
          """,
          projectId,
          objectKey,
          remark,
          operator);
      workflowTraceService.appendAction(projectId, "REPORT_COMPILE_UPLOAD_SAVE", null, "DRAFT", operator, "");
    } else {
      SubmissionRow old = rows.get(0);
      jdbcTemplate.update(
          """
          UPDATE report_compile_submission
          SET report_object_key = ?, report_remark = ?,
              status = CASE WHEN status = 'SUBMITTED' THEN 'SUBMITTED' ELSE 'DRAFT' END,
              updated_by = ?
          WHERE id = ?
          """,
          objectKey,
          remark,
          operator,
          old.id());
      workflowTraceService.appendAction(
          projectId, "REPORT_COMPILE_UPLOAD_SAVE", old.status(), "DRAFT", operator, "");
    }

    workflowTraceService.moveNode(projectId, NODE_UPLOAD, "PENDING", operator);
    return detailSubmission(projectId).orElseThrow();
  }

  @Transactional
  public ReportCompileSubmissionRecord submitSubmission(long projectId, String operator) {
    ensureAssignmentSubmitted(projectId);
    ensureCompilePermission(projectId, operator);

    SubmissionRow submission = loadSubmission(projectId);
    if (submission.reportObjectKey() == null || submission.reportObjectKey().isBlank()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "report object key is required before submit");
    }

    if (!"SUBMITTED".equalsIgnoreCase(submission.status())) {
      jdbcTemplate.update(
          """
          UPDATE report_compile_submission
          SET status = 'SUBMITTED', submitted_by = ?, submitted_at = NOW(), finished_at = NOW(), updated_by = ?
          WHERE id = ?
          """,
          operator,
          operator,
          submission.id());
      workflowTraceService.appendAction(
          projectId,
          "REPORT_COMPILE_UPLOAD_SUBMIT",
          submission.status(),
          "SUBMITTED",
          operator,
          "");
    }
    // 根据最终审核节点安插规则自动创建待办任务，不再依赖页面手工分配。
    reportFinalReviewService.submit(projectId, operator);

    return detailSubmission(projectId).orElseThrow();
  }

  public String loadCompileAssignee(long projectId) {
    List<String> rows =
        jdbcTemplate.query(
            "SELECT assignee FROM report_compile_assignment WHERE project_register_id = ?",
            (rs, rowNum) -> rs.getString("assignee"),
            projectId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private void ensureContentReviewApproved(long projectId) {
    List<String> rows =
        jdbcTemplate.query(
            """
            SELECT a.status
            FROM project_register p
            LEFT JOIN report_content_review_apply a ON a.project_register_id = p.id
            WHERE p.id = ? AND p.deleted_flag = 0
            """,
            (rs, rowNum) -> rs.getString("status"),
            projectId);
    if (rows.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "project register not found");
    }
    if (!"APPROVED".equalsIgnoreCase(rows.get(0))) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "report content review must be approved first");
    }
  }

  private void ensureAssignmentSubmitted(long projectId) {
    AssignmentRow row = loadAssignment(projectId);
    if (!"SUBMITTED".equalsIgnoreCase(row.status())) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "compile assignment must be submitted first");
    }
  }

  private AssignmentRow loadAssignment(long projectId) {
    List<AssignmentRow> rows =
        jdbcTemplate.query(
            """
            SELECT id, assignee, status, version_no
            FROM report_compile_assignment
            WHERE project_register_id = ?
            """,
            (rs, rowNum) ->
                new AssignmentRow(
                    rs.getLong("id"),
                    rs.getString("assignee"),
                    rs.getString("status"),
                    rs.getInt("version_no")),
            projectId);
    if (rows.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "compile assignment draft is required");
    }
    return rows.get(0);
  }

  private SubmissionRow loadSubmission(long projectId) {
    List<SubmissionRow> rows =
        jdbcTemplate.query(
            """
            SELECT id, status, report_object_key
            FROM report_compile_submission
            WHERE project_register_id = ?
            """,
            (rs, rowNum) ->
                new SubmissionRow(rs.getLong("id"), rs.getString("status"), rs.getString("report_object_key")),
            projectId);
    if (rows.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "compile submission draft is required");
    }
    return rows.get(0);
  }

  private void ensureCompilePermission(long projectId, String operator) {
    if (isAdmin(operator)) {
      return;
    }
    String assignee = loadCompileAssignee(projectId);
    if (assignee == null || !assignee.equals(operator)) {
      throw new ResponseStatusException(
          HttpStatus.FORBIDDEN, "only assignee can edit/submit compile report");
    }
  }

  private void ensureEnabledUser(String username) {
    Set<String> users = Set.copyOf(userAccountService.listEnabledUsernames());
    if (!users.contains(username)) {
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

  private String normalizeText(String value) {
    if (value == null) {
      return null;
    }
    String normalized = value.trim();
    return normalized.isEmpty() ? null : normalized;
  }

  private boolean isAdmin(String username) {
    return userAccountService.hasRole(username, UserAccountService.ROLE_SUPER_ADMIN);
  }

  private String assignmentSql() {
    return """
        SELECT
          p.id project_register_id,
          p.application_name,
          c.status content_review_status,
          osa.package_object_key on_site_package_object_key,
          a.assignee,
          COALESCE(a.status, 'DRAFT') status,
          COALESCE(a.version_no, 0) version_no,
          a.submitted_at,
          wi.current_node workflow_node,
          wi.status workflow_status
        FROM project_register p
        JOIN report_content_review_apply c ON c.project_register_id = p.id
        LEFT JOIN on_site_assessment osa ON osa.project_register_id = p.id AND osa.status = 'SUBMITTED'
        LEFT JOIN report_compile_assignment a ON a.project_register_id = p.id
        LEFT JOIN workflow_instance wi ON wi.biz_type = 'PROJECT_REGISTER' AND wi.biz_id = p.id
        WHERE p.deleted_flag = 0
          AND c.status = 'APPROVED'
        """;
  }

  private String submissionSql() {
    return """
        SELECT
          p.id project_register_id,
          p.application_name,
          COALESCE(a.status, 'DRAFT') assignment_status,
          osa.package_object_key on_site_package_object_key,
          a.assignee,
          s.report_object_key,
          s.report_remark,
          COALESCE(s.status, 'DRAFT') status,
          s.submitted_by,
          s.submitted_at,
          wi.current_node workflow_node,
          wi.status workflow_status
        FROM project_register p
        JOIN report_compile_assignment a ON a.project_register_id = p.id
        LEFT JOIN on_site_assessment osa ON osa.project_register_id = p.id AND osa.status = 'SUBMITTED'
        LEFT JOIN report_compile_submission s ON s.project_register_id = p.id
        LEFT JOIN workflow_instance wi ON wi.biz_type = 'PROJECT_REGISTER' AND wi.biz_id = p.id
        WHERE p.deleted_flag = 0
          AND a.status = 'SUBMITTED'
        """;
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

  private static class AssignmentRowMapper implements RowMapper<ReportCompileAssignmentRecord> {
    @Override
    public ReportCompileAssignmentRecord mapRow(ResultSet rs, int rowNum) throws SQLException {
      ReportCompileAssignmentRecord record = new ReportCompileAssignmentRecord();
      record.setProjectRegisterId(rs.getLong("project_register_id"));
      record.setApplicationName(rs.getString("application_name"));
      record.setContentReviewStatus(rs.getString("content_review_status"));
      record.setOnSitePackageObjectKey(rs.getString("on_site_package_object_key"));
      record.setAssignee(rs.getString("assignee"));
      record.setStatus(rs.getString("status"));
      record.setVersionNo(rs.getInt("version_no"));
      record.setSubmittedAt(stringTimestamp(rs.getTimestamp("submitted_at")));
      record.setWorkflowNode(rs.getString("workflow_node"));
      record.setWorkflowStatus(rs.getString("workflow_status"));
      return record;
    }

    private String stringTimestamp(Timestamp timestamp) {
      return timestamp == null ? null : String.valueOf(timestamp);
    }
  }

  private static class SubmissionRowMapper implements RowMapper<ReportCompileSubmissionRecord> {
    @Override
    public ReportCompileSubmissionRecord mapRow(ResultSet rs, int rowNum) throws SQLException {
      ReportCompileSubmissionRecord record = new ReportCompileSubmissionRecord();
      record.setProjectRegisterId(rs.getLong("project_register_id"));
      record.setApplicationName(rs.getString("application_name"));
      record.setAssignmentStatus(rs.getString("assignment_status"));
      record.setOnSitePackageObjectKey(rs.getString("on_site_package_object_key"));
      record.setAssignee(rs.getString("assignee"));
      record.setReportObjectKey(rs.getString("report_object_key"));
      record.setReportRemark(rs.getString("report_remark"));
      record.setStatus(rs.getString("status"));
      record.setSubmittedBy(rs.getString("submitted_by"));
      record.setSubmittedAt(stringTimestamp(rs.getTimestamp("submitted_at")));
      record.setWorkflowNode(rs.getString("workflow_node"));
      record.setWorkflowStatus(rs.getString("workflow_status"));
      return record;
    }

    private String stringTimestamp(Timestamp timestamp) {
      return timestamp == null ? null : String.valueOf(timestamp);
    }
  }

  private record AssignmentRow(long id, String assignee, String status, int versionNo) {}

  private record SubmissionRow(long id, String status, String reportObjectKey) {}

  private record ProjectRef(long id, String applicationName) {}
}

