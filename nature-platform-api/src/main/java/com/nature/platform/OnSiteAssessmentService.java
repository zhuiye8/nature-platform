/**
 * @input JdbcTemplate storage, police-register prerequisite service, workflow trace helper, and notification services
 * @output Node-8 on-site assessment save/submit APIs with multi-evidence attachments and rectification-aware resubmission into report-review chain
 * @position Project node service implementing unified on-site submission entry and direct routing to technical/content/final review
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.util.ArrayList;
import java.util.LinkedHashSet;
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

  private final JdbcTemplate jdbcTemplate;
  private final JsonSupport jsonSupport;
  private final PoliceRegisterService policeRegisterService;
  private final ProjectWorkflowTraceService workflowTraceService;
  private final NotificationService notificationService;
  private final UserDataScopeService userDataScopeService;
  private final ReportTechReviewService reportTechReviewService;
  private final ReportContentReviewService reportContentReviewService;
  private final ReportFinalReviewService reportFinalReviewService;

  public OnSiteAssessmentService(
      JdbcTemplate jdbcTemplate,
      JsonSupport jsonSupport,
      PoliceRegisterService policeRegisterService,
      ProjectWorkflowTraceService workflowTraceService,
      NotificationService notificationService,
      UserDataScopeService userDataScopeService,
      ReportTechReviewService reportTechReviewService,
      ReportContentReviewService reportContentReviewService,
      ReportFinalReviewService reportFinalReviewService) {
    this.jdbcTemplate = jdbcTemplate;
    this.jsonSupport = jsonSupport;
    this.policeRegisterService = policeRegisterService;
    this.workflowTraceService = workflowTraceService;
    this.notificationService = notificationService;
    this.userDataScopeService = userDataScopeService;
    this.reportTechReviewService = reportTechReviewService;
    this.reportContentReviewService = reportContentReviewService;
    this.reportFinalReviewService = reportFinalReviewService;
  }

  public List<OnSiteAssessmentRecord> list(String operator) {
    return listResults(operator);
  }

  public List<OnSiteAssessmentRecord> listExecutions(String operator) {
    List<OnSiteAssessmentRecord> rows =
        jdbcTemplate.query(baseSql() + " ORDER BY p.id DESC", new OnSiteAssessmentRowMapper(jsonSupport));
    if (rows.isEmpty()) {
      return rows;
    }
    UserDataScopeService.DataScopeProfile profile = userDataScopeService.resolveProfile(operator);
    if (profile.allowAll()) {
      return rows;
    }
    Set<Long> accessibleProjectIds =
        Set.copyOf(
            jdbcTemplate.query(
                """
                SELECT DISTINCT project_register_id
                FROM project_assessment_member
                WHERE username = ?
                """,
                (rs, rowNum) -> rs.getLong("project_register_id"),
                operator));
    return rows.stream()
        .filter(item -> accessibleProjectIds.contains(item.getProjectRegisterId()))
        .toList();
  }

  public List<OnSiteAssessmentRecord> listResults(String operator) {
    List<OnSiteAssessmentRecord> rows =
        jdbcTemplate.query(baseSql() + " ORDER BY p.id DESC", new OnSiteAssessmentRowMapper(jsonSupport));
    if (rows.isEmpty()) {
      return rows;
    }
    UserDataScopeService.DataScopeProfile profile = userDataScopeService.resolveProfile(operator);
    if (profile.allowAll() || profile.projectViewAll()) {
      return rows;
    }
    Set<Long> managerProjectIds =
        Set.copyOf(
            jdbcTemplate.query(
                """
                SELECT DISTINCT project_register_id
                FROM police_register
                WHERE project_manager_username = ?
                """,
                (rs, rowNum) -> rs.getLong("project_register_id"),
                operator));
    return rows.stream()
        .filter(item -> managerProjectIds.contains(item.getProjectRegisterId()))
        .toList();
  }

  public Optional<OnSiteAssessmentRecord> detail(long projectId) {
    List<OnSiteAssessmentRecord> rows =
        jdbcTemplate.query(
            baseSql() + " AND p.id = ?", new OnSiteAssessmentRowMapper(jsonSupport), projectId);
    return rows.stream().findFirst();
  }

  public Optional<OnSiteAssessmentRecord> detailVisible(long projectId, String operator) {
    Optional<OnSiteAssessmentRecord> row = detail(projectId);
    if (row.isEmpty()) {
      return Optional.empty();
    }
    return canAccessOnSiteProject(projectId, operator) ? row : Optional.empty();
  }

  @Transactional
  public OnSiteAssessmentRecord save(long projectId, OnSiteAssessmentRequest request, String operator) {
    ensureProjectApproved(projectId);
    ensureOnSiteOperationPermitted(projectId, operator);
    List<String> evidenceFiles = resolveEvidenceFiles(request);
    validateEvidenceFiles(evidenceFiles, false);
    String packageKey = resolveLegacyPackageKey(evidenceFiles, request.getPackageObjectKey());
    String assessmentDetail = trim(request.getAssessmentDetail());
    String assessmentRemark = trim(request.getAssessmentRemark());

    List<Long> ids =
        jdbcTemplate.query(
            "SELECT id FROM on_site_assessment WHERE project_register_id = ?",
            (rs, rowNum) -> rs.getLong("id"),
            projectId);
    if (ids.isEmpty()) {
      jdbcTemplate.update(
          """
          INSERT INTO on_site_assessment (
            project_register_id, package_object_key, evidence_files_json, assessment_detail, assessment_remark, status, created_by, updated_by
          ) VALUES (?, ?, ?, ?, ?, 'DRAFT', ?, ?)
          """,
          projectId,
          packageKey,
          jsonSupport.toJson(evidenceFiles),
          assessmentDetail,
          assessmentRemark,
          operator,
          operator);
      workflowTraceService.moveNode(projectId, NODE_KEY, "PENDING", operator);
      workflowTraceService.appendAction(projectId, "ON_SITE_ASSESSMENT_SAVE", null, "DRAFT", operator, "");
    } else {
      long id = ids.get(0);
      RectificationTarget rectificationTarget = resolveRectificationTarget(projectId);
      String oldStatus =
          jdbcTemplate.queryForObject(
              "SELECT status FROM on_site_assessment WHERE id = ?", String.class, id);
      ensureEditableOnSubmitted(oldStatus, rectificationTarget);
      jdbcTemplate.update(
          """
          UPDATE on_site_assessment
          SET package_object_key = ?, evidence_files_json = ?, assessment_detail = ?, assessment_remark = ?, updated_by = ?,
              status = CASE WHEN status = 'SUBMITTED' THEN 'SUBMITTED' ELSE 'DRAFT' END
          WHERE id = ?
          """,
          packageKey,
          jsonSupport.toJson(evidenceFiles),
          assessmentDetail,
          assessmentRemark,
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
  public OnSiteAssessmentRecord submit(long projectId, String operator) {
    ensureProjectApproved(projectId);
    ensureOnSiteOperationPermitted(projectId, operator);
    if (!policeRegisterService.isSubmitted(projectId)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "police register must be submitted first");
    }

    OnSiteAssessmentRecord row = detail(projectId).orElse(null);
    if (row == null || row.getId() == null) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "on-site assessment draft is required before submit");
    }

    validateEvidenceFiles(row.getEvidenceFiles(), true);
    RectificationTarget rectificationTarget = resolveRectificationTarget(projectId);
    ensureEditableOnSubmitted(row.getStatus(), rectificationTarget);

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
        row.getStatus(),
        "SUBMITTED",
        operator,
        "");
    submitToNextReviewStage(projectId, operator, rectificationTarget);

    ProjectOwner projectOwner = loadProjectOwner(projectId);
    notificationService.createForUser(
        projectOwner.createdBy(),
        "现场测评已提交",
        "项目[" + projectOwner.applicationName() + "]现场测评已提交，流程已进入审核阶段。",
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

  private boolean canAccessOnSiteProject(long projectId, String operator) {
    if (operator == null || operator.isBlank()) {
      return false;
    }
    UserDataScopeService.DataScopeProfile profile = userDataScopeService.resolveProfile(operator);
    if (profile.allowAll() || profile.projectViewAll()) {
      return true;
    }
    Integer assessmentMemberCount =
        jdbcTemplate.queryForObject(
            """
            SELECT COUNT(1)
            FROM project_assessment_member
            WHERE project_register_id = ? AND username = ?
            """,
            Integer.class,
            projectId,
            operator);
    if (assessmentMemberCount != null && assessmentMemberCount > 0) {
      return true;
    }
    Integer managerCount =
        jdbcTemplate.queryForObject(
            """
            SELECT COUNT(1)
            FROM police_register
            WHERE project_register_id = ? AND project_manager_username = ?
            """,
            Integer.class,
            projectId,
            operator);
    return managerCount != null && managerCount > 0;
  }

  private void ensureOnSiteOperationPermitted(long projectId, String operator) {
    if (canAccessOnSiteProject(projectId, operator)) {
      return;
    }
    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "current user has no permission for this project");
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

  private void validateEvidenceFiles(List<String> evidenceFiles, boolean required) {
    if (evidenceFiles == null || evidenceFiles.isEmpty()) {
      if (required) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "at least one evidence file is required");
      }
      return;
    }
    for (String objectKey : evidenceFiles) {
      if (objectKey == null || objectKey.isBlank()) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "evidence object key is invalid");
      }
      if (objectKey.trim().length() > 512) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "evidence object key length exceeds 512");
      }
    }
  }

  private List<String> resolveEvidenceFiles(OnSiteAssessmentRequest request) {
    LinkedHashSet<String> set = new LinkedHashSet<>();
    if (request.getEvidenceFiles() != null) {
      for (String objectKey : request.getEvidenceFiles()) {
        String normalized = trim(objectKey);
        if (normalized != null) {
          set.add(normalized);
        }
      }
    }
    String packageObjectKey = trim(request.getPackageObjectKey());
    if (packageObjectKey != null) {
      set.add(packageObjectKey);
    }
    return new ArrayList<>(set);
  }

  private String resolveLegacyPackageKey(List<String> evidenceFiles, String requestPackageObjectKey) {
    String explicit = trim(requestPackageObjectKey);
    if (explicit != null) {
      return explicit;
    }
    if (evidenceFiles == null || evidenceFiles.isEmpty()) {
      return null;
    }
    for (String objectKey : evidenceFiles) {
      if (objectKey != null && objectKey.toLowerCase(Locale.ROOT).endsWith(".zip")) {
        return objectKey;
      }
    }
    return evidenceFiles.get(0);
  }

  private void ensureEditableOnSubmitted(String onSiteStatus, RectificationTarget rectificationTarget) {
    if (!"SUBMITTED".equalsIgnoreCase(onSiteStatus)) {
      return;
    }
    if (rectificationTarget != RectificationTarget.NONE) {
      return;
    }
    throw new ResponseStatusException(
        HttpStatus.CONFLICT, "现场测评正在审核中，仅在“需要整改”时允许编辑并重新提交");
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
          osa.evidence_files_json,
          NULL tech_reviewer,
          NULL content_reviewer_a,
          NULL content_reviewer_b,
          NULL content_reviewer_c,
          0 assignment_version_no,
          osa.assessment_detail,
          osa.assessment_remark,
          COALESCE(osa.created_by, p.created_by) created_by,
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
        LEFT JOIN workflow_instance wi ON wi.biz_type = 'PROJECT_REGISTER' AND wi.biz_id = p.id
        WHERE p.deleted_flag = 0 AND p.status = 'APPROVED'
        """;
  }

  private static class OnSiteAssessmentRowMapper implements RowMapper<OnSiteAssessmentRecord> {
    private final JsonSupport jsonSupport;

    private OnSiteAssessmentRowMapper(JsonSupport jsonSupport) {
      this.jsonSupport = jsonSupport;
    }

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
      record.setEvidenceFiles(jsonSupport.fromJsonList(rs.getString("evidence_files_json")));
      record.setTechReviewer(rs.getString("tech_reviewer"));
      record.setContentReviewerA(rs.getString("content_reviewer_a"));
      record.setContentReviewerB(rs.getString("content_reviewer_b"));
      record.setContentReviewerC(rs.getString("content_reviewer_c"));
      record.setAssignmentVersionNo(rs.getInt("assignment_version_no"));
      record.setAssessmentDetail(rs.getString("assessment_detail"));
      record.setAssessmentRemark(rs.getString("assessment_remark"));
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

  private record WorkflowState(String currentNode, String status) {}

  private record ProjectOwner(String createdBy, String applicationName) {}

  private enum RectificationTarget {
    NONE,
    REPORT_TECH_REVIEW,
    REPORT_CONTENT_REVIEW,
    REPORT_FINAL_REVIEW
  }
}
