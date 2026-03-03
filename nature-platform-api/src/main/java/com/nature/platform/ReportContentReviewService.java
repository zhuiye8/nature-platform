/**
 * @input JdbcTemplate, user-account/workflow-config services, workflow trace helper, and notifications
 * @output Node-12 content-review submit with node-rule assignee selection (excluding police-register project manager) plus task approve/reject operations
 * @position Report content-review service bridging technical-review completion to compile-assignment stage with strict node-rule assignment
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ReportContentReviewService {
  public static final String NODE_TASK = "REPORT_CONTENT_REVIEW_TASK";
  public static final String NEXT_NODE = "REPORT_COMPILE_ASSIGN";

  private static final String SLOT_CONTENT_REVIEWER_TECH = "CONTENT_REVIEWER_TECH";
  private static final String SLOT_CONTENT_REVIEWER_MANAGEMENT = "CONTENT_REVIEWER_MANAGEMENT";
  private static final String SLOT_CONTENT_REVIEWER_NETWORK = "CONTENT_REVIEWER_NETWORK";
  private static final String SLOT_CONTENT_REVIEWER_A = "CONTENT_REVIEWER_A";
  private static final String SLOT_CONTENT_REVIEWER_B = "CONTENT_REVIEWER_B";
  private static final String SLOT_CONTENT_REVIEWER_C = "CONTENT_REVIEWER_C";

  private static final String ROLE_TECH = "CONTENT_TECH";
  private static final String ROLE_MANAGEMENT = "CONTENT_MANAGEMENT";
  private static final String ROLE_NETWORK = "CONTENT_NETWORK";

  private final JdbcTemplate jdbcTemplate;
  private final UserAccountService userAccountService;
  private final ProjectWorkflowTraceService workflowTraceService;
  private final NotificationService notificationService;
  private final WorkflowConfigService workflowConfigService;

  public ReportContentReviewService(
      JdbcTemplate jdbcTemplate,
      UserAccountService userAccountService,
      ProjectWorkflowTraceService workflowTraceService,
      NotificationService notificationService,
      WorkflowConfigService workflowConfigService) {
    this.jdbcTemplate = jdbcTemplate;
    this.userAccountService = userAccountService;
    this.workflowTraceService = workflowTraceService;
    this.notificationService = notificationService;
    this.workflowConfigService = workflowConfigService;
  }

  public List<ReportContentReviewRecord> list() {
    List<ReportContentReviewRecord> rows =
        jdbcTemplate.query(baseSql() + " ORDER BY p.id DESC", new ReportContentReviewRowMapper());
    loadTasks(rows);
    rows.forEach(this::applyDisplayStatus);
    return rows;
  }

  public java.util.Optional<ReportContentReviewRecord> detail(long projectId) {
    List<ReportContentReviewRecord> rows =
        jdbcTemplate.query(baseSql() + " AND p.id = ?", new ReportContentReviewRowMapper(), projectId);
    if (rows.isEmpty()) {
      return java.util.Optional.empty();
    }
    loadTasks(rows);
    java.util.Optional<ReportContentReviewRecord> first = rows.stream().findFirst();
    first.ifPresent(this::applyDisplayStatus);
    return first;
  }

  public List<ReportContentTodoTask> listTodoTasks(String operator, String keyword) {
    boolean admin = isAdmin(operator);
    List<ReportContentTodoTask> rows =
        jdbcTemplate.query(
            """
            SELECT
              t.id,
              t.project_register_id,
              p.application_name,
              a.applied_by,
              a.submitted_at,
              t.review_role,
              t.assignee,
              wi.process_instance_id
            FROM report_content_review_task t
            JOIN report_content_review_apply a ON a.id = t.apply_id
            JOIN project_register p ON p.id = t.project_register_id
            LEFT JOIN workflow_instance wi ON wi.biz_type = 'PROJECT_REGISTER' AND wi.biz_id = t.project_register_id
            WHERE t.status = 'PENDING'
              AND a.status = 'SUBMITTED'
              AND (? = 1 OR t.assignee = ?)
            ORDER BY a.submitted_at DESC, t.id DESC
            """,
            (rs, rowNum) ->
                new ReportContentTodoTask(
                    rs.getLong("id"),
                    rs.getLong("project_register_id"),
                    rs.getString("application_name"),
                    rs.getString("applied_by"),
                    stringTimestamp(rs.getTimestamp("submitted_at")),
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
                    || contains(item.assignee(), needle)
                    || String.valueOf(item.projectRegisterId()).contains(needle))
        .toList();
  }

  @Transactional
  public ReportContentReviewRecord submit(long projectId, String operator) {
    ensureTechReviewApproved(projectId);
    Assignment reviewers = loadAssignment(projectId);
    ensureEnabledUsers(reviewers);

    List<ApplyRow> applies =
        jdbcTemplate.query(
            """
            SELECT id, status, applied_by
            FROM report_content_review_apply
            WHERE project_register_id = ?
            """,
            (rs, rowNum) -> new ApplyRow(rs.getLong("id"), rs.getString("status"), rs.getString("applied_by")),
            projectId);

    long applyId;
    String oldStatus;
    if (applies.isEmpty()) {
      jdbcTemplate.update(
          """
          INSERT INTO report_content_review_apply (
            project_register_id, status, applied_by, submitted_at, finished_at, updated_by
          ) VALUES (?, 'SUBMITTED', ?, NOW(), NULL, ?)
          """,
          projectId,
          operator,
          operator);
      Long id = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
      if (id == null || id <= 0) {
        throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "content review apply create failed");
      }
      applyId = id;
      oldStatus = "DRAFT";
    } else {
      ApplyRow apply = applies.get(0);
      applyId = apply.id();
      oldStatus = apply.status();
      jdbcTemplate.update(
          """
          UPDATE report_content_review_apply
          SET status = 'SUBMITTED', applied_by = ?, submitted_at = NOW(), finished_at = NULL, updated_by = ?
          WHERE id = ?
          """,
          operator,
          operator,
          applyId);
    }

    jdbcTemplate.update("DELETE FROM report_content_review_task WHERE apply_id = ?", applyId);
    Map<String, String> taskMap = new LinkedHashMap<>();
    taskMap.put(ROLE_TECH, reviewers.reviewerA());
    taskMap.put(ROLE_MANAGEMENT, reviewers.reviewerB());
    taskMap.put(ROLE_NETWORK, reviewers.reviewerC());
    for (Map.Entry<String, String> item : taskMap.entrySet()) {
      jdbcTemplate.update(
          """
          INSERT INTO report_content_review_task (
            apply_id, project_register_id, review_role, assignee, status
          ) VALUES (?, ?, ?, ?, 'PENDING')
          """,
          applyId,
          projectId,
          item.getKey(),
          item.getValue());
    }

    workflowTraceService.moveNode(projectId, NODE_TASK, "PENDING", operator);
    workflowTraceService.appendAction(
        projectId, "REPORT_CONTENT_REVIEW_SUBMIT", oldStatus, "SUBMITTED", operator, "");

    ProjectRef project = loadProjectRef(projectId);
    notificationService.createForUsers(
        List.of(reviewers.reviewerA(), reviewers.reviewerB(), reviewers.reviewerC()),
        "内容审核待处理",
        "项目[" + project.applicationName() + "]已进入报告内容审核阶段。",
        "REPORT_CONTENT_REVIEW_ENTER",
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
        UPDATE report_content_review_task
        SET status = 'APPROVED', remark = '', processed_by = ?, processed_at = NOW()
        WHERE id = ?
        """,
        operator,
        taskId);

    workflowTraceService.appendAction(
        task.projectId(),
        "REPORT_CONTENT_REVIEW_" + task.reviewRole() + "_APPROVE",
        "PENDING",
        "APPROVED",
        operator,
        "");
    completeIfAllApproved(task.projectId(), task.applyId(), operator, task.appliedBy(), task.applicationName());
  }

  @Transactional
  public void rejectTask(long taskId, String operator, String remark) {
    TaskContext task = loadTask(taskId);
    ensureTaskPermission(task.assignee(), operator);
    ensureTaskPending(task.status());
    String safeRemark = normalizeRemark(remark);

    jdbcTemplate.update(
        """
        UPDATE report_content_review_task
        SET status = 'REJECTED', remark = ?, processed_by = ?, processed_at = NOW()
        WHERE id = ?
        """,
        safeRemark,
        operator,
        taskId);
    jdbcTemplate.update(
        """
        UPDATE report_content_review_task
        SET status = 'CLOSED', remark = 'closed by reject', processed_by = ?, processed_at = NOW()
        WHERE apply_id = ? AND status = 'PENDING' AND id <> ?
        """,
        operator,
        task.applyId(),
        taskId);
    jdbcTemplate.update(
        """
        UPDATE report_content_review_apply
        SET status = 'REJECTED', finished_at = NOW(), updated_by = ?
        WHERE id = ?
        """,
        operator,
        task.applyId());

    workflowTraceService.moveNode(task.projectId(), NODE_TASK, "REJECTED", operator);
    workflowTraceService.appendAction(
        task.projectId(),
        "REPORT_CONTENT_REVIEW_" + task.reviewRole() + "_REJECT",
        "PENDING",
        "REJECTED",
        operator,
        safeRemark);

    notificationService.createForUser(
        task.appliedBy(),
        "内容审核驳回",
        "项目[" + task.applicationName() + "]报告内容审核已驳回。",
        "REPORT_CONTENT_REVIEW_REJECTED",
        ProjectRegisterService.BIZ_TYPE,
        task.projectId());
  }

  private void completeIfAllApproved(
      long projectId, long applyId, String operator, String appliedBy, String applicationName) {
    Integer pending =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(1) FROM report_content_review_task WHERE apply_id = ? AND status = 'PENDING'",
            Integer.class,
            applyId);
    Integer rejected =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(1) FROM report_content_review_task WHERE apply_id = ? AND status = 'REJECTED'",
            Integer.class,
            applyId);
    if ((pending == null ? 0 : pending) > 0 || (rejected == null ? 0 : rejected) > 0) {
      return;
    }

    jdbcTemplate.update(
        """
        UPDATE report_content_review_apply
        SET status = 'APPROVED', finished_at = NOW(), updated_by = ?
        WHERE id = ?
        """,
        operator,
        applyId);

    workflowTraceService.moveNode(projectId, NEXT_NODE, "PENDING", operator);
    workflowTraceService.appendAction(
        projectId, "REPORT_CONTENT_REVIEW_FINISH", "SUBMITTED", "APPROVED", operator, "");

    notificationService.createForUser(
        appliedBy,
        "内容审核通过",
        "项目[" + applicationName + "]报告内容审核全部通过。",
        "REPORT_CONTENT_REVIEW_APPROVED",
        ProjectRegisterService.BIZ_TYPE,
        projectId);
  }

  private void loadTasks(List<ReportContentReviewRecord> rows) {
    if (rows.isEmpty()) {
      return;
    }
    Map<Long, ReportContentReviewRecord> map = new LinkedHashMap<>();
    StringBuilder inSql = new StringBuilder();
    for (int i = 0; i < rows.size(); i++) {
      ReportContentReviewRecord row = rows.get(i);
      map.put(row.getProjectRegisterId(), row);
      row.setTasks(new ArrayList<>());
      if (i > 0) {
        inSql.append(',');
      }
      inSql.append(row.getProjectRegisterId());
    }

    jdbcTemplate.query(
        """
        SELECT
          id,
          project_register_id,
          review_role,
          assignee,
          status,
          remark,
          processed_by,
          processed_at
        FROM report_content_review_task
        WHERE project_register_id IN (%s)
        ORDER BY id ASC
        """
            .formatted(inSql),
        rs -> {
          ReportContentReviewRecord row = map.get(rs.getLong("project_register_id"));
          if (row == null) {
            return;
          }
          ReportContentReviewTaskRecord task = new ReportContentReviewTaskRecord();
          task.setId(rs.getLong("id"));
          task.setReviewRole(rs.getString("review_role"));
          task.setAssignee(rs.getString("assignee"));
          task.setStatus(rs.getString("status"));
          task.setRemark(rs.getString("remark"));
          task.setProcessedBy(rs.getString("processed_by"));
          task.setProcessedAt(stringTimestamp(rs.getTimestamp("processed_at")));
          row.getTasks().add(task);
        });
  }

  private void ensureTechReviewApproved(long projectId) {
    List<String> rows =
        jdbcTemplate.query(
            """
            SELECT tr.status
            FROM project_register p
            LEFT JOIN report_tech_review_apply tr ON tr.project_register_id = p.id
            WHERE p.id = ? AND p.deleted_flag = 0
            """,
            (rs, rowNum) -> rs.getString("status"),
            projectId);
    if (rows.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "project register not found");
    }
    if (!"APPROVED".equalsIgnoreCase(rows.get(0))) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "report tech review must be approved first");
    }
  }

  private Assignment loadAssignment(long projectId) {
    String projectManager = normalizeUser(loadProjectManagerUsername(projectId));
    String reviewerTech =
        pickReviewerForSlot(
            SLOT_CONTENT_REVIEWER_TECH,
            SLOT_CONTENT_REVIEWER_A,
            "内容审核-技术",
            projectManager);
    String reviewerManagement =
        pickReviewerForSlot(
            SLOT_CONTENT_REVIEWER_MANAGEMENT,
            SLOT_CONTENT_REVIEWER_B,
            "内容审核-管理",
            projectManager);
    String reviewerNetwork =
        pickReviewerForSlot(
            SLOT_CONTENT_REVIEWER_NETWORK,
            SLOT_CONTENT_REVIEWER_C,
            "内容审核-网络",
            projectManager);
    return new Assignment(reviewerTech, reviewerManagement, reviewerNetwork);
  }

  private String pickReviewerForSlot(
      String slotKey, String legacySlotKey, String slotLabel, String excludedUsername) {
    List<String> roleCodes = resolveRoleCodesBySlot(slotKey, legacySlotKey);
    if (roleCodes.isEmpty()) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT,
          "节点规则缺少槽位配置：" + slotKey + "，请到流程管理-节点规则补齐");
    }

    List<String> candidates =
        userAccountService.listEnabledUsernamesByRoles(roleCodes).stream()
            .map(this::normalizeUser)
            .filter(item -> item != null && !item.isBlank())
            .filter(item -> excludedUsername == null || !item.equalsIgnoreCase(excludedUsername))
            .distinct()
            .toList();
    if (candidates.isEmpty()) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT,
          slotLabel + " 未匹配到可用审核人，请检查角色分配和用户启用状态");
    }
    return candidates.get(0);
  }

  private List<String> resolveRoleCodesBySlot(String slotKey, String legacySlotKey) {
    List<String> primary = workflowConfigService.listRoleCodesBySlot(NODE_TASK, slotKey, List.of());
    if (!primary.isEmpty()) {
      return primary;
    }
    if (legacySlotKey == null || legacySlotKey.isBlank()) {
      return List.of();
    }
    return workflowConfigService.listRoleCodesBySlot(NODE_TASK, legacySlotKey, List.of());
  }

  private String loadProjectManagerUsername(long projectId) {
    List<String> rows =
        jdbcTemplate.query(
            """
            SELECT project_manager_username
            FROM police_register
            WHERE project_register_id = ?
            ORDER BY id DESC
            LIMIT 1
            """,
            (rs, rowNum) -> normalizeUser(rs.getString("project_manager_username")),
            projectId);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private void ensureEnabledUsers(Assignment assignment) {
    Set<String> enabledUsers = Set.copyOf(userAccountService.listEnabledUsernames());
    for (String user : List.of(assignment.reviewerA(), assignment.reviewerB(), assignment.reviewerC())) {
      if (!enabledUsers.contains(user)) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "assignee user not enabled: " + user);
      }
    }
  }

  private TaskContext loadTask(long taskId) {
    List<TaskContext> rows =
        jdbcTemplate.query(
            """
            SELECT
              t.id,
              t.apply_id,
              t.project_register_id,
              t.review_role,
              t.assignee,
              t.status,
              a.applied_by,
              p.application_name
            FROM report_content_review_task t
            JOIN report_content_review_apply a ON a.id = t.apply_id
            JOIN project_register p ON p.id = t.project_register_id
            WHERE t.id = ?
            """,
            (rs, rowNum) ->
                new TaskContext(
                    rs.getLong("id"),
                    rs.getLong("apply_id"),
                    rs.getLong("project_register_id"),
                    rs.getString("review_role"),
                    rs.getString("assignee"),
                    rs.getString("status"),
                    rs.getString("applied_by"),
                    rs.getString("application_name")),
            taskId);
    if (rows.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "report content review task not found");
    }
    return rows.get(0);
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

  private boolean isAdmin(String username) {
    return userAccountService.hasRole(username, UserAccountService.ROLE_SUPER_ADMIN);
  }

  private boolean contains(String value, String needle) {
    return value != null && value.toLowerCase(Locale.ROOT).contains(needle);
  }

  private void applyDisplayStatus(ReportContentReviewRecord row) {
    List<ReportContentReviewTaskRecord> taskRows = row.getTasks();
    if (taskRows != null && !taskRows.isEmpty()) {
      boolean hasRejected = false;
      boolean hasPending = false;
      boolean allApproved = true;
      for (ReportContentReviewTaskRecord task : taskRows) {
        String status = normalizeStatus(task.getStatus());
        if ("REJECTED".equals(status)) {
          hasRejected = true;
        }
        if ("PENDING".equals(status)) {
          hasPending = true;
        }
        if (!"APPROVED".equals(status)) {
          allApproved = false;
        }
      }
      if (hasRejected) {
        row.setDisplayStatus("REJECTED");
        return;
      }
      if (hasPending) {
        row.setDisplayStatus("PENDING");
        return;
      }
      if (allApproved) {
        row.setDisplayStatus("APPROVED");
        return;
      }
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

  private String normalizeRemark(String value) {
    return value == null ? "" : value.trim();
  }

  private String normalizeUser(String value) {
    if (value == null) {
      return null;
    }
    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }

  private String stringTimestamp(Timestamp timestamp) {
    return timestamp == null ? null : String.valueOf(timestamp);
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

  private String baseSql() {
    return """
        SELECT
          p.id project_register_id,
          p.application_name,
          tr.status tech_review_status,
          osa.package_object_key on_site_package_object_key,
          COALESCE((
            SELECT t1.assignee
            FROM report_content_review_task t1
            WHERE t1.project_register_id = p.id
              AND t1.review_role = 'CONTENT_TECH'
            ORDER BY t1.id DESC
            LIMIT 1
          ), '') reviewer_a,
          COALESCE((
            SELECT t2.assignee
            FROM report_content_review_task t2
            WHERE t2.project_register_id = p.id
              AND t2.review_role = 'CONTENT_MANAGEMENT'
            ORDER BY t2.id DESC
            LIMIT 1
          ), '') reviewer_b,
          COALESCE((
            SELECT t3.assignee
            FROM report_content_review_task t3
            WHERE t3.project_register_id = p.id
              AND t3.review_role = 'CONTENT_NETWORK'
            ORDER BY t3.id DESC
            LIMIT 1
          ), '') reviewer_c,
          COALESCE(a.status, 'DRAFT') status,
          a.applied_by,
          a.submitted_at,
          a.finished_at,
          wi.current_node workflow_node,
          wi.status workflow_status
        FROM project_register p
        JOIN report_tech_review_apply tr ON tr.project_register_id = p.id
        LEFT JOIN on_site_assessment osa ON osa.project_register_id = p.id AND osa.status = 'SUBMITTED'
        LEFT JOIN report_content_review_apply a ON a.project_register_id = p.id
        LEFT JOIN workflow_instance wi ON wi.biz_type = 'PROJECT_REGISTER' AND wi.biz_id = p.id
        WHERE p.deleted_flag = 0
          AND tr.status = 'APPROVED'
        """;
  }

  private static class ReportContentReviewRowMapper implements RowMapper<ReportContentReviewRecord> {
    @Override
    public ReportContentReviewRecord mapRow(ResultSet rs, int rowNum) throws SQLException {
      ReportContentReviewRecord record = new ReportContentReviewRecord();
      record.setProjectRegisterId(rs.getLong("project_register_id"));
      record.setApplicationName(rs.getString("application_name"));
      record.setTechReviewStatus(rs.getString("tech_review_status"));
      record.setOnSitePackageObjectKey(rs.getString("on_site_package_object_key"));
      record.setReviewerA(rs.getString("reviewer_a"));
      record.setReviewerB(rs.getString("reviewer_b"));
      record.setReviewerC(rs.getString("reviewer_c"));
      record.setStatus(rs.getString("status"));
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

  public record ReportContentTodoTask(
      long taskId,
      long projectRegisterId,
      String applicationName,
      String appliedBy,
      String submittedAt,
      String reviewRole,
      String assignee,
      String processInstanceId) {}

  private record Assignment(String reviewerA, String reviewerB, String reviewerC) {}

  private record ApplyRow(long id, String status, String appliedBy) {}

  private record TaskContext(
      long taskId,
      long applyId,
      long projectId,
      String reviewRole,
      String assignee,
      String status,
      String appliedBy,
      String applicationName) {}

  private record ProjectRef(long id, String applicationName) {}
}

