/**
 * @input JdbcTemplate persistence, user/project/on-site services, workflow trace helper, and notifications
 * @output Node-9/10 assignment, submit, task review, and todo-query operations with optimistic locking
 * @position Quality review domain service implementing four-reviewer assignment and approval closure
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class QualityReviewService {
  public static final String NODE_APPLY = "QUALITY_REVIEW_APPLY";
  public static final String NODE_TASK = "QUALITY_REVIEW_TASK";
  public static final String NODE_APPROVED = "QUALITY_REVIEW_APPROVED";
  public static final String NODE_REJECTED = "QUALITY_REVIEW_REJECTED";

  private static final String ROLE_TECH = "TECH";
  private static final String ROLE_CONTENT_TECH = "CONTENT_TECH";
  private static final String ROLE_CONTENT_MANAGEMENT = "CONTENT_MANAGEMENT";
  private static final String ROLE_CONTENT_NETWORK = "CONTENT_NETWORK";

  private final JdbcTemplate jdbcTemplate;
  private final UserAccountService userAccountService;
  private final OnSiteAssessmentService onSiteAssessmentService;
  private final ProjectWorkflowTraceService workflowTraceService;
  private final NotificationService notificationService;

  public QualityReviewService(
      JdbcTemplate jdbcTemplate,
      UserAccountService userAccountService,
      OnSiteAssessmentService onSiteAssessmentService,
      ProjectWorkflowTraceService workflowTraceService,
      NotificationService notificationService) {
    this.jdbcTemplate = jdbcTemplate;
    this.userAccountService = userAccountService;
    this.onSiteAssessmentService = onSiteAssessmentService;
    this.workflowTraceService = workflowTraceService;
    this.notificationService = notificationService;
  }

  public List<QualityReviewRecord> list() {
    List<QualityReviewRecord> rows =
        jdbcTemplate.query(baseSql() + " ORDER BY p.id DESC", new QualityReviewRowMapper());
    loadTasks(rows);
    return rows;
  }

  public Optional<QualityReviewRecord> detail(long projectId) {
    List<QualityReviewRecord> rows =
        jdbcTemplate.query(baseSql() + " AND p.id = ?", new QualityReviewRowMapper(), projectId);
    if (rows.isEmpty()) {
      return Optional.empty();
    }
    loadTasks(rows);
    return rows.stream().findFirst();
  }

  public List<String> listCandidates() {
    return userAccountService.listEnabledUsernames();
  }

  @Transactional
  public QualityReviewRecord saveAssignment(
      long projectId, QualityReviewAssignmentRequest request, String operator) {
    ensureProjectApproved(projectId);
    ensureCanReassign(projectId, operator);
    if (!onSiteAssessmentService.isSubmitted(projectId)) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "on-site assessment must be submitted before assignment");
    }

    String techReviewer = normalizeUser(request.getTechReviewer());
    String reviewerA = normalizeUser(request.getContentReviewerTech());
    String reviewerB = normalizeUser(request.getContentReviewerManagement());
    String reviewerC = normalizeUser(request.getContentReviewerNetwork());
    validateAssignees(techReviewer, reviewerA, reviewerB, reviewerC);

    List<AssignmentRow> existingRows =
        jdbcTemplate.query(
            """
            SELECT project_register_id, tech_reviewer, content_reviewer_a, content_reviewer_b, content_reviewer_c, version_no
            FROM workflow_assignment
            WHERE project_register_id = ?
            """,
            (rs, rowNum) ->
                new AssignmentRow(
                    rs.getLong("project_register_id"),
                    rs.getString("tech_reviewer"),
                    rs.getString("content_reviewer_a"),
                    rs.getString("content_reviewer_b"),
                    rs.getString("content_reviewer_c"),
                    rs.getInt("version_no")),
            projectId);

    if (existingRows.isEmpty()) {
      int expected = request.getVersionNo() == null ? 0 : request.getVersionNo();
      if (expected != 0) {
        throw new ResponseStatusException(HttpStatus.CONFLICT, "任务已被分配，请刷新");
      }
      jdbcTemplate.update(
          """
          INSERT INTO workflow_assignment (
            project_register_id,
            tech_reviewer,
            content_reviewer_a,
            content_reviewer_b,
            content_reviewer_c,
            version_no,
            updated_by
          ) VALUES (?, ?, ?, ?, ?, 1, ?)
          """,
          projectId,
          techReviewer,
          reviewerA,
          reviewerB,
          reviewerC,
          operator);
      workflowTraceService.appendAction(projectId, "QUALITY_ASSIGN_SAVE", null, "ASSIGNED", operator, "");
    } else {
      AssignmentRow old = existingRows.get(0);
      int expected = request.getVersionNo() == null ? old.versionNo() : request.getVersionNo();
      int updated =
          jdbcTemplate.update(
              """
              UPDATE workflow_assignment
              SET tech_reviewer = ?, content_reviewer_a = ?, content_reviewer_b = ?, content_reviewer_c = ?,
                  version_no = version_no + 1, updated_by = ?
              WHERE project_register_id = ? AND version_no = ?
              """,
              techReviewer,
              reviewerA,
              reviewerB,
              reviewerC,
              operator,
              projectId,
              expected);
      if (updated == 0) {
        throw new ResponseStatusException(HttpStatus.CONFLICT, "任务已被分配，请刷新");
      }
      workflowTraceService.appendAction(
          projectId,
          "QUALITY_ASSIGN_SAVE",
          "v" + old.versionNo(),
          "v" + (old.versionNo() + 1),
          operator,
          "");
    }

    workflowTraceService.moveNode(projectId, NODE_APPLY, "PENDING", operator);
    return detail(projectId).orElseThrow();
  }

  @Transactional
  public QualityReviewRecord submit(long projectId, String operator) {
    ensureProjectApproved(projectId);
    ensureCanReassign(projectId, operator);

    if (!onSiteAssessmentService.isSubmitted(projectId)) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "on-site assessment must be submitted before quality review apply");
    }
    String packageKey = onSiteAssessmentService.loadSubmittedPackageKey(projectId);
    if (packageKey == null || packageKey.isBlank()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "zip package is required before quality review apply");
    }

    AssignmentRow assignment = loadAssignment(projectId);
    validateAssignees(
        assignment.techReviewer(),
        assignment.contentReviewerA(),
        assignment.contentReviewerB(),
        assignment.contentReviewerC());

    List<QualityApplyRow> applyRows =
        jdbcTemplate.query(
            """
            SELECT id, status, applied_by
            FROM quality_review_apply
            WHERE project_register_id = ?
            """,
            (rs, rowNum) ->
                new QualityApplyRow(
                    rs.getLong("id"), rs.getString("status"), rs.getString("applied_by")),
            projectId);

    Long applyId;
    String oldStatus;
    if (applyRows.isEmpty()) {
      jdbcTemplate.update(
          """
          INSERT INTO quality_review_apply (
            project_register_id, status, applied_by, submitted_at, finished_at, updated_by
          ) VALUES (?, 'SUBMITTED', ?, NOW(), NULL, ?)
          """,
          projectId,
          operator,
          operator);
      applyId = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
      oldStatus = "DRAFT";
      if (applyId == null || applyId <= 0) {
        throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "quality review apply create failed");
      }
    } else {
      QualityApplyRow apply = applyRows.get(0);
      applyId = apply.id();
      oldStatus = apply.status();
      jdbcTemplate.update(
          """
          UPDATE quality_review_apply
          SET status = 'SUBMITTED', applied_by = ?, submitted_at = NOW(), finished_at = NULL, updated_by = ?
          WHERE id = ?
          """,
          operator,
          operator,
          applyId);
    }

    jdbcTemplate.update("DELETE FROM quality_review_task WHERE quality_apply_id = ?", applyId);
    Map<String, String> roleAssigneeMap = new LinkedHashMap<>();
    roleAssigneeMap.put(ROLE_TECH, assignment.techReviewer());
    roleAssigneeMap.put(ROLE_CONTENT_TECH, assignment.contentReviewerA());
    roleAssigneeMap.put(ROLE_CONTENT_MANAGEMENT, assignment.contentReviewerB());
    roleAssigneeMap.put(ROLE_CONTENT_NETWORK, assignment.contentReviewerC());
    for (Map.Entry<String, String> entry : roleAssigneeMap.entrySet()) {
      jdbcTemplate.update(
          """
          INSERT INTO quality_review_task (
            quality_apply_id, project_register_id, review_role, assignee, status
          ) VALUES (?, ?, ?, ?, 'PENDING')
          """,
          applyId,
          projectId,
          entry.getKey(),
          entry.getValue());
    }

    workflowTraceService.moveNode(projectId, NODE_TASK, "PENDING", operator);
    workflowTraceService.appendAction(
        projectId,
        "QUALITY_REVIEW_APPLY_SUBMIT",
        oldStatus,
        "SUBMITTED",
        operator,
        "");

    ProjectOwner projectOwner = loadProjectOwner(projectId);
    notificationService.createForUsers(
        List.of(
            assignment.techReviewer(),
            assignment.contentReviewerA(),
            assignment.contentReviewerB(),
            assignment.contentReviewerC()),
        "质量审核待处理",
        "项目[" + projectOwner.applicationName() + "]已提交质量审核，请及时处理。",
        "QUALITY_REVIEW_TASK_ENTER",
        ProjectRegisterService.BIZ_TYPE,
        projectId);

    return detail(projectId).orElseThrow();
  }

  public List<QualityReviewTodoTask> listTodoTasks(String operator, String keyword) {
    boolean admin = isAdmin(operator);
    List<QualityReviewTodoTask> rows =
        jdbcTemplate.query(
            """
            SELECT
              t.id,
              t.project_register_id,
              p.application_name,
              qa.applied_by,
              qa.submitted_at,
              t.review_role,
              t.assignee,
              wi.process_instance_id
            FROM quality_review_task t
            JOIN quality_review_apply qa ON qa.id = t.quality_apply_id
            JOIN project_register p ON p.id = t.project_register_id
            LEFT JOIN workflow_instance wi ON wi.biz_type = 'PROJECT_REGISTER' AND wi.biz_id = t.project_register_id
            WHERE t.status = 'PENDING'
              AND qa.status = 'SUBMITTED'
              AND (
                ? = 1
                OR t.assignee = ?
              )
            ORDER BY qa.submitted_at DESC, t.id DESC
            """,
            (rs, rowNum) ->
                new QualityReviewTodoTask(
                    rs.getLong("id"),
                    rs.getLong("project_register_id"),
                    rs.getString("application_name"),
                    rs.getString("applied_by"),
                    String.valueOf(rs.getTimestamp("submitted_at")),
                    rs.getString("review_role"),
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
                    || contains(item.reviewRole(), needle)
                    || String.valueOf(item.projectRegisterId()).contains(needle))
        .toList();
  }

  @Transactional
  public void approveTask(long taskId, String operator) {
    QualityTaskContext context = loadTaskContext(taskId);
    ensureTaskPermission(context, operator);
    ensureTaskPending(context);

    jdbcTemplate.update(
        """
        UPDATE quality_review_task
        SET status = 'APPROVED', remark = '', processed_by = ?, processed_at = NOW()
        WHERE id = ?
        """,
        operator,
        taskId);

    workflowTraceService.appendAction(
        context.projectRegisterId(),
        "QUALITY_REVIEW_" + context.reviewRole() + "_APPROVE",
        "PENDING",
        "APPROVED",
        operator,
        "");

    completeApplyIfAllApproved(context.projectRegisterId(), context.qualityApplyId(), operator);
  }

  @Transactional
  public void rejectTask(long taskId, String operator, String remark) {
    QualityTaskContext context = loadTaskContext(taskId);
    ensureTaskPermission(context, operator);
    ensureTaskPending(context);

    String safeRemark = remark == null ? "" : remark.trim();
    jdbcTemplate.update(
        """
        UPDATE quality_review_task
        SET status = 'REJECTED', remark = ?, processed_by = ?, processed_at = NOW()
        WHERE id = ?
        """,
        safeRemark,
        operator,
        taskId);
    jdbcTemplate.update(
        """
        UPDATE quality_review_task
        SET status = 'CLOSED', remark = '已被其他审核驳回', processed_by = ?, processed_at = NOW()
        WHERE quality_apply_id = ? AND status = 'PENDING' AND id <> ?
        """,
        operator,
        context.qualityApplyId(),
        taskId);
    jdbcTemplate.update(
        """
        UPDATE quality_review_apply
        SET status = 'REJECTED', finished_at = NOW(), updated_by = ?
        WHERE id = ?
        """,
        operator,
        context.qualityApplyId());

    workflowTraceService.moveNode(context.projectRegisterId(), NODE_REJECTED, "REJECTED", operator);
    workflowTraceService.appendAction(
        context.projectRegisterId(),
        "QUALITY_REVIEW_" + context.reviewRole() + "_REJECT",
        "PENDING",
        "REJECTED",
        operator,
        safeRemark);

    notificationService.createForUser(
        context.appliedBy(),
        "质量审核被驳回",
        "项目[" + context.applicationName() + "]质量审核被驳回，备注：" + safeRemark,
        "QUALITY_REVIEW_REJECTED",
        ProjectRegisterService.BIZ_TYPE,
        context.projectRegisterId());
  }

  private void completeApplyIfAllApproved(long projectId, long applyId, String operator) {
    Integer pendingCount =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(1) FROM quality_review_task WHERE quality_apply_id = ? AND status = 'PENDING'",
            Integer.class,
            applyId);
    Integer rejectedCount =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(1) FROM quality_review_task WHERE quality_apply_id = ? AND status = 'REJECTED'",
            Integer.class,
            applyId);
    if ((pendingCount == null ? 0 : pendingCount) > 0 || (rejectedCount == null ? 0 : rejectedCount) > 0) {
      return;
    }

    jdbcTemplate.update(
        """
        UPDATE quality_review_apply
        SET status = 'APPROVED', finished_at = NOW(), updated_by = ?
        WHERE id = ?
        """,
        operator,
        applyId);

    workflowTraceService.moveNode(projectId, NODE_APPROVED, "APPROVED", operator);
    workflowTraceService.appendAction(
        projectId,
        "QUALITY_REVIEW_FINISH",
        "SUBMITTED",
        "APPROVED",
        operator,
        "");

    ProjectOwner projectOwner = loadProjectOwner(projectId);
    notificationService.createForUser(
        projectOwner.createdBy(),
        "质量审核已通过",
        "项目[" + projectOwner.applicationName() + "]质量审核已全部通过。",
        "QUALITY_REVIEW_APPROVED",
        ProjectRegisterService.BIZ_TYPE,
        projectId);
  }

  private void ensureTaskPermission(QualityTaskContext context, String operator) {
    if (isAdmin(operator)) {
      return;
    }
    if (!operator.equals(context.assignee())) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "current user has no permission for this task");
    }
  }

  private void ensureTaskPending(QualityTaskContext context) {
    if (!"PENDING".equalsIgnoreCase(context.status())) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "task already processed");
    }
  }

  private QualityTaskContext loadTaskContext(long taskId) {
    List<QualityTaskContext> rows =
        jdbcTemplate.query(
            """
            SELECT
              t.id,
              t.quality_apply_id,
              t.project_register_id,
              t.review_role,
              t.assignee,
              t.status,
              qa.applied_by,
              p.application_name
            FROM quality_review_task t
            JOIN quality_review_apply qa ON qa.id = t.quality_apply_id
            JOIN project_register p ON p.id = t.project_register_id
            WHERE t.id = ?
            """,
            (rs, rowNum) ->
                new QualityTaskContext(
                    rs.getLong("id"),
                    rs.getLong("quality_apply_id"),
                    rs.getLong("project_register_id"),
                    rs.getString("review_role"),
                    rs.getString("assignee"),
                    rs.getString("status"),
                    rs.getString("applied_by"),
                    rs.getString("application_name")),
            taskId);
    if (rows.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "quality review task not found");
    }
    return rows.get(0);
  }

  private void validateAssignees(String techReviewer, String reviewerA, String reviewerB, String reviewerC) {
    if (techReviewer == null || reviewerA == null || reviewerB == null || reviewerC == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "four reviewers are required");
    }
    Set<String> enabledUsers = new LinkedHashSet<>(userAccountService.listEnabledUsernames());
    for (String username : List.of(techReviewer, reviewerA, reviewerB, reviewerC)) {
      if (!enabledUsers.contains(username)) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "assignee user not enabled: " + username);
      }
    }
  }

  private AssignmentRow loadAssignment(long projectId) {
    List<AssignmentRow> rows =
        jdbcTemplate.query(
            """
            SELECT project_register_id, tech_reviewer, content_reviewer_a, content_reviewer_b, content_reviewer_c, version_no
            FROM workflow_assignment
            WHERE project_register_id = ?
            """,
            (rs, rowNum) ->
                new AssignmentRow(
                    rs.getLong("project_register_id"),
                    rs.getString("tech_reviewer"),
                    rs.getString("content_reviewer_a"),
                    rs.getString("content_reviewer_b"),
                    rs.getString("content_reviewer_c"),
                    rs.getInt("version_no")),
            projectId);
    if (rows.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "must assign four reviewers before submit");
    }
    return rows.get(0);
  }

  private void ensureProjectApproved(long projectId) {
    List<String> rows =
        jdbcTemplate.query(
            """
            SELECT status
            FROM project_register
            WHERE id = ? AND deleted_flag = 0
            """,
            (rs, rowNum) -> rs.getString("status"),
            projectId);
    if (rows.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "project register not found");
    }
    if (!"APPROVED".equalsIgnoreCase(rows.get(0))) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "project register must be approved first");
    }
  }

  private void ensureCanReassign(long projectId, String operator) {
    if (isAdmin(operator)) {
      return;
    }
    ProjectOwner owner = loadProjectOwner(projectId);
    if (operator.equals(owner.createdBy())) {
      return;
    }
    List<String> applyUsers =
        jdbcTemplate.query(
            "SELECT applied_by FROM quality_review_apply WHERE project_register_id = ?",
            (rs, rowNum) -> rs.getString("applied_by"),
            projectId);
    if (!applyUsers.isEmpty() && operator.equals(applyUsers.get(0))) {
      return;
    }
    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "only applicant or admin can reassign");
  }

  private boolean isAdmin(String username) {
    return userAccountService.hasRole(username, UserAccountService.ROLE_SUPER_ADMIN);
  }

  private String normalizeUser(String username) {
    if (username == null) {
      return null;
    }
    String value = username.trim();
    return value.isEmpty() ? null : value;
  }

  private boolean contains(String source, String needle) {
    if (source == null) {
      return false;
    }
    return source.toLowerCase(Locale.ROOT).contains(needle);
  }

  private ProjectOwner loadProjectOwner(long projectId) {
    List<ProjectOwner> rows =
        jdbcTemplate.query(
            """
            SELECT created_by, application_name
            FROM project_register
            WHERE id = ? AND deleted_flag = 0
            """,
            (rs, rowNum) -> new ProjectOwner(rs.getString("created_by"), rs.getString("application_name")),
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
          p.status project_status,
          COALESCE(osa.status, 'DRAFT') on_site_assessment_status,
          osa.package_object_key,
          COALESCE(qa.status, 'DRAFT') quality_status,
          wa.tech_reviewer,
          wa.content_reviewer_a,
          wa.content_reviewer_b,
          wa.content_reviewer_c,
          COALESCE(wa.version_no, 0) assignment_version_no,
          qa.applied_by,
          qa.submitted_at,
          qa.finished_at,
          wi.current_node workflow_node,
          wi.status workflow_status
        FROM project_register p
        LEFT JOIN on_site_assessment osa ON osa.project_register_id = p.id
        LEFT JOIN quality_review_apply qa ON qa.project_register_id = p.id
        LEFT JOIN workflow_assignment wa ON wa.project_register_id = p.id
        LEFT JOIN workflow_instance wi ON wi.biz_type = 'PROJECT_REGISTER' AND wi.biz_id = p.id
        WHERE p.deleted_flag = 0 AND p.status = 'APPROVED'
        """;
  }

  private void loadTasks(List<QualityReviewRecord> rows) {
    if (rows.isEmpty()) {
      return;
    }
    Map<Long, QualityReviewRecord> map = new LinkedHashMap<>();
    List<String> ids = new ArrayList<>();
    for (QualityReviewRecord row : rows) {
      map.put(row.getProjectRegisterId(), row);
      row.setTasks(new ArrayList<>());
      ids.add(String.valueOf(row.getProjectRegisterId()));
    }

    String inSql = String.join(",", ids);
    jdbcTemplate.query(
        """
        SELECT
          t.id,
          t.project_register_id,
          t.review_role,
          t.assignee,
          t.status,
          t.remark,
          t.processed_by,
          t.processed_at
        FROM quality_review_task t
        WHERE t.project_register_id IN (%s)
        ORDER BY t.id ASC
        """
            .formatted(inSql),
        rs -> {
          QualityReviewRecord row = map.get(rs.getLong("project_register_id"));
          if (row == null) {
            return;
          }
          QualityReviewTaskRecord task = new QualityReviewTaskRecord();
          task.setId(rs.getLong("id"));
          task.setReviewRole(rs.getString("review_role"));
          task.setAssignee(rs.getString("assignee"));
          task.setStatus(rs.getString("status"));
          task.setRemark(rs.getString("remark"));
          task.setProcessedBy(rs.getString("processed_by"));
          Timestamp processedAt = rs.getTimestamp("processed_at");
          task.setProcessedAt(processedAt == null ? null : String.valueOf(processedAt));
          row.getTasks().add(task);
        });
  }

  private static class QualityReviewRowMapper implements RowMapper<QualityReviewRecord> {
    @Override
    public QualityReviewRecord mapRow(ResultSet rs, int rowNum) throws SQLException {
      QualityReviewRecord record = new QualityReviewRecord();
      record.setProjectRegisterId(rs.getLong("project_register_id"));
      record.setApplicationName(rs.getString("application_name"));
      record.setProjectStatus(rs.getString("project_status"));
      record.setOnSiteAssessmentStatus(rs.getString("on_site_assessment_status"));
      record.setOnSitePackageObjectKey(rs.getString("package_object_key"));
      record.setStatus(rs.getString("quality_status"));
      record.setTechReviewer(rs.getString("tech_reviewer"));
      record.setContentReviewerA(rs.getString("content_reviewer_a"));
      record.setContentReviewerB(rs.getString("content_reviewer_b"));
      record.setContentReviewerC(rs.getString("content_reviewer_c"));
      record.setAssignmentVersionNo(rs.getInt("assignment_version_no"));
      record.setAppliedBy(rs.getString("applied_by"));
      record.setSubmittedAt(stringTimestamp(rs.getTimestamp("submitted_at")));
      record.setFinishedAt(stringTimestamp(rs.getTimestamp("finished_at")));
      record.setWorkflowNode(rs.getString("workflow_node"));
      record.setWorkflowStatus(rs.getString("workflow_status"));
      return record;
    }

    private String stringTimestamp(Timestamp timestamp) {
      return timestamp == null ? null : String.valueOf(timestamp);
    }
  }

  public record QualityReviewTodoTask(
      long taskId,
      long projectRegisterId,
      String applicationName,
      String appliedBy,
      String submittedAt,
      String reviewRole,
      String assignee,
      String processInstanceId) {}

  private record AssignmentRow(
      long projectRegisterId,
      String techReviewer,
      String contentReviewerA,
      String contentReviewerB,
      String contentReviewerC,
      int versionNo) {}

  private record QualityApplyRow(long id, String status, String appliedBy) {}

  private record ProjectOwner(String createdBy, String applicationName) {}

  private record QualityTaskContext(
      long taskId,
      long qualityApplyId,
      long projectRegisterId,
      String reviewRole,
      String assignee,
      String status,
      String appliedBy,
      String applicationName) {}
}
