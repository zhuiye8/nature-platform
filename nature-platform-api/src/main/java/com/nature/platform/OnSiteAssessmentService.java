/**
 * @input JdbcTemplate storage, user/role lookup, police-register prerequisite service, workflow trace helper, workflow config, and notifications
 * @output Node-8 on-site assessment save/submit plus reviewer-assignment, rectification routing, and role-pool candidate operations
 * @position Project node service implementing unified on-site submission entry for first-pass review and rework resubmission
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.sql.ResultSet;
import java.sql.SQLException;
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
public class OnSiteAssessmentService {
 public static final String NODE_KEY = "ON_SITE_ASSESSMENT";
  private static final String NODE_REPORT_TECH_REVIEW_TASK = "REPORT_TECH_REVIEW_TASK";
  private static final String NODE_REPORT_CONTENT_REVIEW_TASK = "REPORT_CONTENT_REVIEW_TASK";
  private static final String NODE_REPORT_FINAL_REVIEW_TASK = "REPORT_FINAL_REVIEW_TASK";
  public static final String SLOT_TECH_REVIEWER = "TECH_REVIEWER";
  public static final String SLOT_CONTENT_REVIEWER_TECH = "CONTENT_REVIEWER_TECH";
  public static final String SLOT_CONTENT_REVIEWER_MANAGEMENT = "CONTENT_REVIEWER_MANAGEMENT";
  public static final String SLOT_CONTENT_REVIEWER_NETWORK = "CONTENT_REVIEWER_NETWORK";
  private static final String LEGACY_SLOT_CONTENT_REVIEWER_A = "CONTENT_REVIEWER_A";
  private static final String LEGACY_SLOT_CONTENT_REVIEWER_B = "CONTENT_REVIEWER_B";
  private static final String LEGACY_SLOT_CONTENT_REVIEWER_C = "CONTENT_REVIEWER_C";

  private final JdbcTemplate jdbcTemplate;
  private final UserAccountService userAccountService;
  private final PoliceRegisterService policeRegisterService;
  private final ProjectWorkflowTraceService workflowTraceService;
  private final WorkflowConfigService workflowConfigService;
  private final NotificationService notificationService;
  private final ReportTechReviewService reportTechReviewService;
  private final ReportContentReviewService reportContentReviewService;
  private final ReportFinalReviewService reportFinalReviewService;

  public OnSiteAssessmentService(
      JdbcTemplate jdbcTemplate,
      UserAccountService userAccountService,
      PoliceRegisterService policeRegisterService,
      ProjectWorkflowTraceService workflowTraceService,
      WorkflowConfigService workflowConfigService,
      NotificationService notificationService,
      ReportTechReviewService reportTechReviewService,
      ReportContentReviewService reportContentReviewService,
      ReportFinalReviewService reportFinalReviewService) {
    this.jdbcTemplate = jdbcTemplate;
    this.userAccountService = userAccountService;
    this.policeRegisterService = policeRegisterService;
    this.workflowTraceService = workflowTraceService;
    this.workflowConfigService = workflowConfigService;
    this.notificationService = notificationService;
    this.reportTechReviewService = reportTechReviewService;
    this.reportContentReviewService = reportContentReviewService;
    this.reportFinalReviewService = reportFinalReviewService;
  }

  public List<OnSiteAssessmentRecord> list() {
    return jdbcTemplate.query(baseSql() + " ORDER BY p.id DESC", new OnSiteAssessmentRowMapper());
  }

  public Optional<OnSiteAssessmentRecord> detail(long projectId) {
    List<OnSiteAssessmentRecord> rows =
        jdbcTemplate.query(baseSql() + " AND p.id = ?", new OnSiteAssessmentRowMapper(), projectId);
    return rows.stream().findFirst();
  }

  public List<String> listReviewAssignmentCandidates() {
    return userAccountService.listEnabledUsernames();
  }

  public ReviewerCandidates listReviewAssignmentCandidatesByRole() {
    List<String> techRoleCodes =
        workflowConfigService.listRoleCodesBySlot(
            NODE_KEY,
            SLOT_TECH_REVIEWER,
            List.of(
                UserAccountService.ROLE_SUPER_ADMIN,
                UserAccountService.ROLE_REVIEWER,
                UserAccountService.ROLE_REVIEW_TECH));
    List<String> reviewerTechRoleCodes =
        listRoleCodesBySlotWithLegacy(
            SLOT_CONTENT_REVIEWER_TECH,
            LEGACY_SLOT_CONTENT_REVIEWER_A,
            List.of(
                UserAccountService.ROLE_SUPER_ADMIN,
                UserAccountService.ROLE_REVIEWER,
                UserAccountService.ROLE_REVIEW_CONTENT_TECH));
    List<String> reviewerManagementRoleCodes =
        listRoleCodesBySlotWithLegacy(
            SLOT_CONTENT_REVIEWER_MANAGEMENT,
            LEGACY_SLOT_CONTENT_REVIEWER_B,
            List.of(
                UserAccountService.ROLE_SUPER_ADMIN,
                UserAccountService.ROLE_REVIEWER,
                UserAccountService.ROLE_REVIEW_CONTENT_MANAGEMENT));
    List<String> reviewerNetworkRoleCodes =
        listRoleCodesBySlotWithLegacy(
            SLOT_CONTENT_REVIEWER_NETWORK,
            LEGACY_SLOT_CONTENT_REVIEWER_C,
            List.of(
                UserAccountService.ROLE_SUPER_ADMIN,
                UserAccountService.ROLE_REVIEWER,
                UserAccountService.ROLE_REVIEW_CONTENT_NETWORK));

    return new ReviewerCandidates(
        listCandidatesByRoles(techRoleCodes),
        listCandidatesByRoles(reviewerTechRoleCodes),
        listCandidatesByRoles(reviewerManagementRoleCodes),
        listCandidatesByRoles(reviewerNetworkRoleCodes));
  }

  @Transactional
  public OnSiteAssessmentRecord save(long projectId, OnSiteAssessmentRequest request, String operator) {
    ensureProjectApproved(projectId);
    String packageKey = trim(request.getPackageObjectKey());
    validateZipObjectKey(packageKey, false);

    List<Long> ids =
        jdbcTemplate.query(
            "SELECT id FROM on_site_assessment WHERE project_register_id = ?",
            (rs, rowNum) -> rs.getLong("id"),
            projectId);
    if (ids.isEmpty()) {
      jdbcTemplate.update(
          """
          INSERT INTO on_site_assessment (
            project_register_id, package_object_key, assessment_detail, status, created_by, updated_by
          ) VALUES (?, ?, ?, 'DRAFT', ?, ?)
          """,
          projectId,
          packageKey,
          trim(request.getAssessmentDetail()),
          operator,
          operator);
      workflowTraceService.moveNode(projectId, NODE_KEY, "PENDING", operator);
      workflowTraceService.appendAction(projectId, "ON_SITE_ASSESSMENT_SAVE", null, "DRAFT", operator, "");
    } else {
      long id = ids.get(0);
      RectificationTarget rectificationTarget = resolveRectificationTarget(projectId);
      String oldStatus =
          jdbcTemplate.queryForObject(
              "SELECT status FROM on_site_assessment WHERE id = ?",
              String.class,
              id);
      jdbcTemplate.update(
          """
          UPDATE on_site_assessment
          SET package_object_key = ?, assessment_detail = ?, updated_by = ?,
              status = CASE WHEN status = 'SUBMITTED' THEN 'SUBMITTED' ELSE 'DRAFT' END
          WHERE id = ?
          """,
          packageKey,
          trim(request.getAssessmentDetail()),
          operator,
          id);
      if (rectificationTarget == RectificationTarget.NONE) {
        workflowTraceService.moveNode(projectId, NODE_KEY, "PENDING", operator);
      }
      workflowTraceService.appendAction(projectId, "ON_SITE_ASSESSMENT_SAVE", oldStatus, "DRAFT", operator, "");
    }

    return detail(projectId).orElseThrow();
  }

  @Transactional
  public OnSiteAssessmentRecord saveReviewAssignment(
      long projectId, QualityReviewAssignmentRequest request, String operator) {
    ensureProjectApproved(projectId);
    ensurePackageUploaded(projectId);

    String techReviewer = trim(request.getTechReviewer());
    String reviewerA = trim(request.getContentReviewerTech());
    String reviewerB = trim(request.getContentReviewerManagement());
    String reviewerC = trim(request.getContentReviewerNetwork());
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
        throw new ResponseStatusException(HttpStatus.CONFLICT, "assignment already changed, refresh required");
      }
      jdbcTemplate.update(
          """
          INSERT INTO workflow_assignment (
            project_register_id, tech_reviewer, content_reviewer_a, content_reviewer_b, content_reviewer_c, version_no, updated_by
          ) VALUES (?, ?, ?, ?, ?, 1, ?)
          """,
          projectId,
          techReviewer,
          reviewerA,
          reviewerB,
          reviewerC,
          operator);
      workflowTraceService.appendAction(projectId, "ON_SITE_REVIEW_ASSIGN_SAVE", null, "ASSIGNED", operator, "");
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
        throw new ResponseStatusException(HttpStatus.CONFLICT, "assignment already changed, refresh required");
      }
      workflowTraceService.appendAction(
          projectId,
          "ON_SITE_REVIEW_ASSIGN_SAVE",
          "v" + old.versionNo(),
          "v" + (old.versionNo() + 1),
          operator,
          "");
    }

    return detail(projectId).orElseThrow();
  }
  @Transactional
  public OnSiteAssessmentRecord submit(long projectId, String operator) {
    ensureProjectApproved(projectId);
    if (!policeRegisterService.isSubmitted(projectId)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "police register must be submitted first");
    }

    OnSiteAssessmentRecord detail = detail(projectId).orElse(null);
    if (detail == null || detail.getId() == null) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "on-site assessment draft is required before submit");
    }

    validateZipObjectKey(detail.getPackageObjectKey(), true);
    AssignmentRow assignment = loadAssignment(projectId);
    validateAssignees(
        assignment.techReviewer(),
        assignment.contentReviewerA(),
        assignment.contentReviewerB(),
        assignment.contentReviewerC());
    RectificationTarget rectificationTarget = resolveRectificationTarget(projectId);

    jdbcTemplate.update(
        """
        UPDATE on_site_assessment
        SET status = 'SUBMITTED', updated_by = ?
        WHERE project_register_id = ?
        """,
        operator,
        projectId);
    workflowTraceService.appendAction(
        projectId,
        "ON_SITE_ASSESSMENT_SUBMIT",
        detail.getStatus(),
        "SUBMITTED",
        operator,
        "");
    upsertQualityGatewayApproved(projectId, operator);
    submitToNextReviewStage(projectId, operator, rectificationTarget);

    ProjectOwner projectOwner = loadProjectOwner(projectId);
    notificationService.createForUser(
        projectOwner.createdBy(),
        "现场测评已提交",
        "项目[" + projectOwner.applicationName() + "]现场测评已提交，已进入后续审核流程。",
        "ON_SITE_ASSESSMENT_SUBMITTED",
        ProjectRegisterService.BIZ_TYPE,
        projectId);
    return detail(projectId).orElseThrow();
  }

  public boolean isSubmitted(long projectId) {
    Integer count =
        jdbcTemplate.queryForObject(
            """
            SELECT COUNT(1)
            FROM on_site_assessment
            WHERE project_register_id = ? AND status = 'SUBMITTED'
            """,
            Integer.class,
            projectId);
    return count != null && count > 0;
  }

  public String loadSubmittedPackageKey(long projectId) {
    List<String> rows =
        jdbcTemplate.query(
            """
            SELECT package_object_key
            FROM on_site_assessment
            WHERE project_register_id = ? AND status = 'SUBMITTED'
            """,
            (rs, rowNum) -> rs.getString("package_object_key"),
            projectId);
    if (rows.isEmpty()) {
      return null;
    }
    return rows.get(0);
  }

  private void submitToNextReviewStage(
      long projectId, String operator, RectificationTarget rectificationTarget) {
    if (rectificationTarget == RectificationTarget.REPORT_CONTENT_REVIEW) {
      reportContentReviewService.submit(projectId, operator);
      return;
    }
    if (rectificationTarget == RectificationTarget.REPORT_FINAL_REVIEW) {
      reportFinalReviewService.submit(projectId, operator);
      return;
    }
    reportTechReviewService.submit(projectId, operator);
  }

  private RectificationTarget resolveRectificationTarget(long projectId) {
    List<WorkflowState> rows =
        jdbcTemplate.query(
            """
            SELECT current_node, status
            FROM workflow_instance
            WHERE biz_type = ? AND biz_id = ?
            LIMIT 1
            """,
            (rs, rowNum) -> new WorkflowState(rs.getString("current_node"), rs.getString("status")),
            ProjectRegisterService.BIZ_TYPE,
            projectId);
    if (rows.isEmpty()) {
      return RectificationTarget.NONE;
    }
    WorkflowState state = rows.get(0);
    if (!"REJECTED".equalsIgnoreCase(state.status())) {
      return RectificationTarget.NONE;
    }
    if (NODE_REPORT_TECH_REVIEW_TASK.equals(state.currentNode())) {
      return RectificationTarget.REPORT_TECH_REVIEW;
    }
    if (NODE_REPORT_CONTENT_REVIEW_TASK.equals(state.currentNode())) {
      return RectificationTarget.REPORT_CONTENT_REVIEW;
    }
    if (NODE_REPORT_FINAL_REVIEW_TASK.equals(state.currentNode())) {
      return RectificationTarget.REPORT_FINAL_REVIEW;
    }
    return RectificationTarget.NONE;
  }

  private List<String> listCandidatesByRoles(List<String> roles) {
    List<String> rows = userAccountService.listEnabledUsernamesByRoles(roles);
    if (!rows.isEmpty()) {
      return rows;
    }
    return userAccountService.listEnabledUsernames();
  }

  private List<String> listRoleCodesBySlotWithLegacy(
      String primarySlotKey, String legacySlotKey, List<String> fallbackRoleCodes) {
    List<String> primary =
        workflowConfigService.listRoleCodesBySlot(NODE_KEY, primarySlotKey, List.of());
    if (!primary.isEmpty()) {
      return primary;
    }
    return workflowConfigService.listRoleCodesBySlot(NODE_KEY, legacySlotKey, fallbackRoleCodes);
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

  private void ensurePackageUploaded(long projectId) {
    List<String> rows =
        jdbcTemplate.query(
            "SELECT package_object_key FROM on_site_assessment WHERE project_register_id = ?",
            (rs, rowNum) -> rs.getString("package_object_key"),
            projectId);
    if (rows.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "save on-site package before assignment");
    }
    validateZipObjectKey(rows.get(0), true);
  }

  private void validateZipObjectKey(String packageKey, boolean required) {
    if (packageKey == null || packageKey.isBlank()) {
      if (required) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "zip package object key is required");
      }
      return;
    }
    if (!packageKey.toLowerCase(Locale.ROOT).endsWith(".zip")) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "only zip package is allowed");
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
      throw new ResponseStatusException(HttpStatus.CONFLICT, "assign reviewers before submit");
    }
    return rows.get(0);
  }

  private void validateAssignees(String techReviewer, String reviewerA, String reviewerB, String reviewerC) {
    if (techReviewer == null || reviewerA == null || reviewerB == null || reviewerC == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "four reviewers are required");
    }
    Set<String> enabledUsers = Set.copyOf(userAccountService.listEnabledUsernames());
    for (String username : List.of(techReviewer, reviewerA, reviewerB, reviewerC)) {
      if (!enabledUsers.contains(username)) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "assignee user not enabled: " + username);
      }
    }
  }

  private void upsertQualityGatewayApproved(long projectId, String operator) {
    List<Long> rows =
        jdbcTemplate.query(
            "SELECT id FROM quality_review_apply WHERE project_register_id = ?",
            (rs, rowNum) -> rs.getLong("id"),
            projectId);
    if (rows.isEmpty()) {
      jdbcTemplate.update(
          """
          INSERT INTO quality_review_apply (
            project_register_id, status, applied_by, submitted_at, finished_at, updated_by
          ) VALUES (?, 'APPROVED', ?, NOW(), NOW(), ?)
          """,
          projectId,
          operator,
          operator);
      return;
    }
    long applyId = rows.get(0);
    jdbcTemplate.update(
        """
        UPDATE quality_review_apply
        SET status = 'APPROVED', applied_by = ?, submitted_at = COALESCE(submitted_at, NOW()), finished_at = NOW(), updated_by = ?
        WHERE id = ?
        """,
        operator,
        operator,
        applyId);
    jdbcTemplate.update("DELETE FROM quality_review_task WHERE quality_apply_id = ?", applyId);
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

  private String trim(String value) {
    if (value == null) {
      return null;
    }
    String normalized = value.trim();
    return normalized.isEmpty() ? null : normalized;
  }

  private String baseSql() {
    return """
        SELECT
          osa.id,
          p.id project_register_id,
          p.application_name,
          p.status project_status,
          COALESCE(osa.status, 'DRAFT') status,
          osa.package_object_key,
          wa.tech_reviewer,
          wa.content_reviewer_a,
          wa.content_reviewer_b,
          wa.content_reviewer_c,
          COALESCE(wa.version_no, 0) assignment_version_no,
          osa.assessment_detail,
          osa.created_by,
          osa.updated_by,
          osa.created_at,
          osa.updated_at,
          wi.current_node workflow_node,
          wi.status workflow_status,
          CASE
            WHEN wi.status = 'REJECTED'
              AND wi.current_node IN ('REPORT_TECH_REVIEW_TASK', 'REPORT_CONTENT_REVIEW_TASK', 'REPORT_FINAL_REVIEW_TASK')
            THEN wi.current_node
            ELSE NULL
          END rectification_node,
          CASE
            WHEN wi.status = 'REJECTED' AND wi.current_node = 'REPORT_TECH_REVIEW_TASK' THEN (
              SELECT t.remark
              FROM report_tech_review_task t
              WHERE t.project_register_id = p.id AND t.status = 'REJECTED'
              ORDER BY t.processed_at DESC, t.id DESC
              LIMIT 1
            )
            WHEN wi.status = 'REJECTED' AND wi.current_node = 'REPORT_CONTENT_REVIEW_TASK' THEN (
              SELECT t.remark
              FROM report_content_review_task t
              WHERE t.project_register_id = p.id AND t.status = 'REJECTED'
              ORDER BY t.processed_at DESC, t.id DESC
              LIMIT 1
            )
            WHEN wi.status = 'REJECTED' AND wi.current_node = 'REPORT_FINAL_REVIEW_TASK' THEN (
              SELECT t.remark
              FROM report_final_review_task t
              WHERE t.project_register_id = p.id AND t.status = 'REJECTED'
              ORDER BY t.processed_at DESC, t.id DESC
              LIMIT 1
            )
            ELSE NULL
          END rectification_remark,
          CASE
            WHEN wi.status = 'REJECTED' AND wi.current_node = 'REPORT_TECH_REVIEW_TASK' THEN (
              SELECT t.processed_at
              FROM report_tech_review_task t
              WHERE t.project_register_id = p.id AND t.status = 'REJECTED'
              ORDER BY t.processed_at DESC, t.id DESC
              LIMIT 1
            )
            WHEN wi.status = 'REJECTED' AND wi.current_node = 'REPORT_CONTENT_REVIEW_TASK' THEN (
              SELECT t.processed_at
              FROM report_content_review_task t
              WHERE t.project_register_id = p.id AND t.status = 'REJECTED'
              ORDER BY t.processed_at DESC, t.id DESC
              LIMIT 1
            )
            WHEN wi.status = 'REJECTED' AND wi.current_node = 'REPORT_FINAL_REVIEW_TASK' THEN (
              SELECT t.processed_at
              FROM report_final_review_task t
              WHERE t.project_register_id = p.id AND t.status = 'REJECTED'
              ORDER BY t.processed_at DESC, t.id DESC
              LIMIT 1
            )
            ELSE NULL
          END rectification_at
        FROM project_register p
        LEFT JOIN on_site_assessment osa ON osa.project_register_id = p.id
        LEFT JOIN workflow_assignment wa ON wa.project_register_id = p.id
        LEFT JOIN workflow_instance wi ON wi.biz_type = 'PROJECT_REGISTER' AND wi.biz_id = p.id
        WHERE p.deleted_flag = 0 AND p.status = 'APPROVED'
        """;
  }

  private static class OnSiteAssessmentRowMapper implements RowMapper<OnSiteAssessmentRecord> {
    @Override
    public OnSiteAssessmentRecord mapRow(ResultSet rs, int rowNum) throws SQLException {
      OnSiteAssessmentRecord record = new OnSiteAssessmentRecord();
      Long id = rs.getLong("id");
      if (rs.wasNull()) {
        id = null;
      }
      record.setId(id);
      record.setProjectRegisterId(rs.getLong("project_register_id"));
      record.setApplicationName(rs.getString("application_name"));
      record.setProjectStatus(rs.getString("project_status"));
      record.setStatus(rs.getString("status"));
      record.setPackageObjectKey(rs.getString("package_object_key"));
      record.setTechReviewer(rs.getString("tech_reviewer"));
      record.setContentReviewerA(rs.getString("content_reviewer_a"));
      record.setContentReviewerB(rs.getString("content_reviewer_b"));
      record.setContentReviewerC(rs.getString("content_reviewer_c"));
      record.setAssignmentVersionNo(rs.getInt("assignment_version_no"));
      record.setAssessmentDetail(rs.getString("assessment_detail"));
      record.setCreatedBy(rs.getString("created_by"));
      record.setUpdatedBy(rs.getString("updated_by"));
      record.setCreatedAt(stringTimestamp(rs.getTimestamp("created_at")));
      record.setUpdatedAt(stringTimestamp(rs.getTimestamp("updated_at")));
      record.setWorkflowNode(rs.getString("workflow_node"));
      record.setWorkflowStatus(rs.getString("workflow_status"));
      record.setRectificationNode(rs.getString("rectification_node"));
      record.setRectificationRemark(rs.getString("rectification_remark"));
      record.setRectificationAt(stringTimestamp(rs.getTimestamp("rectification_at")));
      return record;
    }

    private String stringTimestamp(java.sql.Timestamp timestamp) {
      return timestamp == null ? null : String.valueOf(timestamp);
    }
  }

  private record AssignmentRow(
      long projectRegisterId,
      String techReviewer,
      String contentReviewerA,
      String contentReviewerB,
      String contentReviewerC,
      int versionNo) {}

  private record WorkflowState(String currentNode, String status) {}

  private record ProjectOwner(String createdBy, String applicationName) {}

  private enum RectificationTarget {
    NONE,
    REPORT_TECH_REVIEW,
    REPORT_CONTENT_REVIEW,
    REPORT_FINAL_REVIEW
  }

  public record ReviewerCandidates(
      List<String> techReviewers,
      List<String> contentReviewersTech,
      List<String> contentReviewersManagement,
      List<String> contentReviewersNetwork) {
    @JsonProperty("contentReviewersA")
    public List<String> getContentReviewersA() {
      return contentReviewersTech;
    }

    @JsonProperty("contentReviewersB")
    public List<String> getContentReviewersB() {
      return contentReviewersManagement;
    }

    @JsonProperty("contentReviewersC")
    public List<String> getContentReviewersC() {
      return contentReviewersNetwork;
    }
  }
}



