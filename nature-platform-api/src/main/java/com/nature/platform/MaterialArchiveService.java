/**
 * @input JdbcTemplate storage, JsonSupport, workflow trace helper, and notifications
 * @output Node-16 material archive save/submit operations with checklist enum validation and report/form file validation
 * @position Material archive service closing report workflow after final review approval and status-checklist persistence
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.util.ArrayList;
import java.util.LinkedHashSet;
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
public class MaterialArchiveService {
  public static final String NODE_KEY = "MATERIAL_ARCHIVE";
  public static final List<String> MATERIAL_STATUS_CODES =
      List.of(
          "MATERIAL_SUMMARY_PENDING_PRINT",
          "ASSESSMENT_REPORT",
          "ASSESSMENT_REPORT_REVIEW_RECORD",
          "VERIFICATION_TEST",
          "TOOL_SCAN",
          "ASSESSMENT_PLAN",
          "ASSESSMENT_PLAN_REVIEW_RECORD",
          "ON_SITE_ASSESSMENT",
          "PROCESS_DOCUMENT",
          "INFORMATION_COLLECTION",
          "PROJECT_PLAN");

  private final JdbcTemplate jdbcTemplate;
  private final JsonSupport jsonSupport;
  private final ProjectWorkflowTraceService workflowTraceService;
  private final NotificationService notificationService;

  public MaterialArchiveService(
      JdbcTemplate jdbcTemplate,
      JsonSupport jsonSupport,
      ProjectWorkflowTraceService workflowTraceService,
      NotificationService notificationService) {
    this.jdbcTemplate = jdbcTemplate;
    this.jsonSupport = jsonSupport;
    this.workflowTraceService = workflowTraceService;
    this.notificationService = notificationService;
  }

  public List<MaterialArchiveRecord> list() {
    return jdbcTemplate.query(baseSql() + " ORDER BY p.id DESC", new MaterialArchiveRowMapper(jsonSupport));
  }

  public Optional<MaterialArchiveRecord> detail(long projectId) {
    List<MaterialArchiveRecord> rows =
        jdbcTemplate.query(baseSql() + " AND p.id = ?", new MaterialArchiveRowMapper(jsonSupport), projectId);
    return rows.stream().findFirst();
  }

  @Transactional
  public MaterialArchiveRecord save(long projectId, MaterialArchiveRequest request, String operator) {
    ensureFinalReviewApproved(projectId);
    List<String> materialStatusCodes = normalizeMaterialStatusCodes(request.getMaterialStatusCodes());

    List<Long> rows =
        jdbcTemplate.query(
            "SELECT id FROM material_archive WHERE project_register_id = ?",
            (rs, rowNum) -> rs.getLong("id"),
            projectId);

    if (rows.isEmpty()) {
      jdbcTemplate.update(
          """
          INSERT INTO material_archive (
            project_register_id,
            material_status_codes_json,
            report_files_json,
            form_files_json,
            remark,
            status,
            submitted_by,
            submitted_at,
            updated_by
          ) VALUES (?, ?, ?, ?, ?, 'DRAFT', NULL, NULL, ?)
          """,
          projectId,
          jsonSupport.toJson(materialStatusCodes),
          jsonSupport.toJson(request.getReportFiles()),
          jsonSupport.toJson(request.getFormFiles()),
          normalizeText(request.getRemark()),
          operator);
    } else {
      jdbcTemplate.update(
          """
          UPDATE material_archive
          SET material_status_codes_json = ?, report_files_json = ?, form_files_json = ?, remark = ?,
              status = CASE WHEN status = 'ARCHIVED' THEN 'ARCHIVED' ELSE 'DRAFT' END,
              updated_by = ?
          WHERE id = ?
          """,
          jsonSupport.toJson(materialStatusCodes),
          jsonSupport.toJson(request.getReportFiles()),
          jsonSupport.toJson(request.getFormFiles()),
          normalizeText(request.getRemark()),
          operator,
          rows.get(0));
    }

    workflowTraceService.moveNode(projectId, NODE_KEY, "PENDING", operator);
    workflowTraceService.appendAction(projectId, "MATERIAL_ARCHIVE_SAVE", null, "DRAFT", operator, "");
    return detail(projectId).orElseThrow();
  }

  @Transactional
  public MaterialArchiveRecord submit(long projectId, String operator) {
    ensureFinalReviewApproved(projectId);

    MaterialRow row = loadMaterialRow(projectId);
    List<String> reportFiles = jsonSupport.fromJsonList(row.reportFilesJson());
    List<String> formFiles = jsonSupport.fromJsonList(row.formFilesJson());
    if (reportFiles.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "at least one report file is required");
    }
    if (formFiles.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "at least one form file is required");
    }

    jdbcTemplate.update(
        """
        UPDATE material_archive
        SET status = 'ARCHIVED', submitted_by = ?, submitted_at = NOW(), updated_by = ?
        WHERE id = ?
        """,
        operator,
        operator,
        row.id());

    workflowTraceService.moveNode(projectId, NODE_KEY, "APPROVED", operator);
    workflowTraceService.appendAction(projectId, "MATERIAL_ARCHIVE_SUBMIT", row.status(), "ARCHIVED", operator, "");

    ProjectRef project = loadProject(projectId);
    notificationService.createForUser(
        project.createdBy(),
        "材料归档完成",
        "项目[" + project.applicationName() + "]材料归档已完成。",
        "MATERIAL_ARCHIVE_DONE",
        ProjectRegisterService.BIZ_TYPE,
        projectId);

    return detail(projectId).orElseThrow();
  }

  private void ensureFinalReviewApproved(long projectId) {
    List<String> rows =
        jdbcTemplate.query(
            """
            SELECT fr.status
            FROM project_register p
            LEFT JOIN report_final_review_apply fr ON fr.project_register_id = p.id
            WHERE p.id = ? AND p.deleted_flag = 0
            """,
            (rs, rowNum) -> rs.getString("status"),
            projectId);
    if (rows.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "project register not found");
    }
    if (!"APPROVED".equalsIgnoreCase(rows.get(0))) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "report final review must be approved first");
    }
  }

  private MaterialRow loadMaterialRow(long projectId) {
    List<MaterialRow> rows =
        jdbcTemplate.query(
            """
            SELECT id, status, report_files_json, form_files_json
            FROM material_archive
            WHERE project_register_id = ?
            """,
            (rs, rowNum) ->
                new MaterialRow(
                    rs.getLong("id"),
                    rs.getString("status"),
                    rs.getString("report_files_json"),
                    rs.getString("form_files_json")),
            projectId);
    if (rows.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "material archive draft is required");
    }
    return rows.get(0);
  }

  private ProjectRef loadProject(long projectId) {
    List<ProjectRef> rows =
        jdbcTemplate.query(
            "SELECT application_name, created_by FROM project_register WHERE id = ? AND deleted_flag = 0",
            (rs, rowNum) -> new ProjectRef(rs.getString("application_name"), rs.getString("created_by")),
            projectId);
    if (rows.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "project register not found");
    }
    return rows.get(0);
  }

  private String normalizeText(String value) {
    if (value == null) {
      return null;
    }
    String normalized = value.trim();
    return normalized.isEmpty() ? null : normalized;
  }

  private List<String> normalizeMaterialStatusCodes(List<String> values) {
    if (values == null || values.isEmpty()) {
      return List.of();
    }
    Set<String> allowed = Set.copyOf(MATERIAL_STATUS_CODES);
    LinkedHashSet<String> normalized = new LinkedHashSet<>();
    for (String item : values) {
      if (item == null) {
        continue;
      }
      String code = item.trim().toUpperCase();
      if (code.isEmpty()) {
        continue;
      }
      if (!allowed.contains(code)) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid material status code: " + code);
      }
      normalized.add(code);
    }
    return new ArrayList<>(normalized);
  }

  private String baseSql() {
    return """
        SELECT
          p.id project_register_id,
          p.application_name,
          fr.status final_review_status,
          osa.package_object_key on_site_package_object_key,
          m.material_status_codes_json,
          m.report_files_json,
          m.form_files_json,
          m.remark,
          COALESCE(m.status, 'DRAFT') status,
          m.submitted_by,
          m.submitted_at,
          wi.current_node workflow_node,
          wi.status workflow_status
        FROM project_register p
        JOIN report_final_review_apply fr ON fr.project_register_id = p.id
        LEFT JOIN on_site_assessment osa ON osa.project_register_id = p.id AND osa.status = 'SUBMITTED'
        LEFT JOIN material_archive m ON m.project_register_id = p.id
        LEFT JOIN workflow_instance wi ON wi.biz_type = 'PROJECT_REGISTER' AND wi.biz_id = p.id
        WHERE p.deleted_flag = 0
          AND fr.status = 'APPROVED'
        """;
  }

  private static class MaterialArchiveRowMapper implements RowMapper<MaterialArchiveRecord> {
    private final JsonSupport jsonSupport;

    private MaterialArchiveRowMapper(JsonSupport jsonSupport) {
      this.jsonSupport = jsonSupport;
    }

    @Override
    public MaterialArchiveRecord mapRow(ResultSet rs, int rowNum) throws SQLException {
      MaterialArchiveRecord record = new MaterialArchiveRecord();
      record.setProjectRegisterId(rs.getLong("project_register_id"));
      record.setApplicationName(rs.getString("application_name"));
      record.setFinalReviewStatus(rs.getString("final_review_status"));
      record.setOnSitePackageObjectKey(rs.getString("on_site_package_object_key"));
      record.setMaterialStatusCodes(jsonSupport.fromJsonList(rs.getString("material_status_codes_json")));
      record.setReportFiles(jsonSupport.fromJsonList(rs.getString("report_files_json")));
      record.setFormFiles(jsonSupport.fromJsonList(rs.getString("form_files_json")));
      record.setRemark(rs.getString("remark"));
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

  private record MaterialRow(long id, String status, String reportFilesJson, String formFilesJson) {}

  private record ProjectRef(String applicationName, String createdBy) {}
}

