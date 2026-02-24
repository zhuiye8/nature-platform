/**
 * @input JdbcTemplate storage, project/workflow trace helpers, and notification service
 * @output Node-7 police register CRUD/submit operations with workflow-node linkage and trace logs
 * @position Project node service implementing police registration stage closure before on-site assessment
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PoliceRegisterService {
  public static final String NODE_KEY = "POLICE_REGISTER";
  public static final String NEXT_NODE_KEY = "ON_SITE_ASSESSMENT";

  private final JdbcTemplate jdbcTemplate;
  private final ProjectWorkflowTraceService workflowTraceService;
  private final NotificationService notificationService;

  public PoliceRegisterService(
      JdbcTemplate jdbcTemplate,
      ProjectWorkflowTraceService workflowTraceService,
      NotificationService notificationService) {
    this.jdbcTemplate = jdbcTemplate;
    this.workflowTraceService = workflowTraceService;
    this.notificationService = notificationService;
  }

  public List<PoliceRegisterRecord> list() {
    return jdbcTemplate.query(baseSql() + " ORDER BY p.id DESC", new PoliceRegisterRowMapper());
  }

  public Optional<PoliceRegisterRecord> detail(long projectId) {
    List<PoliceRegisterRecord> rows =
        jdbcTemplate.query(baseSql() + " AND p.id = ?", new PoliceRegisterRowMapper(), projectId);
    return rows.stream().findFirst();
  }

  @Transactional
  public PoliceRegisterRecord save(long projectId, PoliceRegisterRequest request, String operator) {
    ensureProjectApproved(projectId);
    List<Long> ids =
        jdbcTemplate.query(
            "SELECT id FROM police_register WHERE project_register_id = ?",
            (rs, rowNum) -> rs.getLong("id"),
            projectId);
    if (ids.isEmpty()) {
      jdbcTemplate.update(
          """
          INSERT INTO police_register (
            project_register_id, register_no, filing_agency, contact_name, contact_phone, remark, status, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, 'DRAFT', ?)
          """,
          projectId,
          trim(request.getRegisterNo()),
          trim(request.getFilingAgency()),
          trim(request.getContactName()),
          trim(request.getContactPhone()),
          trim(request.getRemark()),
          operator);
      workflowTraceService.moveNode(projectId, NODE_KEY, "PENDING", operator);
      workflowTraceService.appendAction(projectId, "POLICE_REGISTER_SAVE", null, "DRAFT", operator, "");
    } else {
      long id = ids.get(0);
      String oldStatus =
          jdbcTemplate.queryForObject(
              "SELECT status FROM police_register WHERE id = ?",
              String.class,
              id);
      jdbcTemplate.update(
          """
          UPDATE police_register
          SET register_no = ?, filing_agency = ?, contact_name = ?, contact_phone = ?, remark = ?,
              status = CASE WHEN status = 'SUBMITTED' THEN 'SUBMITTED' ELSE 'DRAFT' END
          WHERE id = ?
          """,
          trim(request.getRegisterNo()),
          trim(request.getFilingAgency()),
          trim(request.getContactName()),
          trim(request.getContactPhone()),
          trim(request.getRemark()),
          id);
      workflowTraceService.moveNode(projectId, NODE_KEY, "PENDING", operator);
      workflowTraceService.appendAction(projectId, "POLICE_REGISTER_SAVE", oldStatus, "DRAFT", operator, "");
    }
    return detail(projectId).orElseThrow();
  }

  @Transactional
  public PoliceRegisterRecord submit(long projectId, String operator) {
    ensureProjectApproved(projectId);
    PoliceRegisterRecord detail = detail(projectId).orElse(null);
    if (detail == null || detail.getId() == null) {
      jdbcTemplate.update(
          """
          INSERT INTO police_register (project_register_id, status, created_by)
          VALUES (?, 'SUBMITTED', ?)
          """,
          projectId,
          operator);
      workflowTraceService.appendAction(projectId, "POLICE_REGISTER_SUBMIT", "DRAFT", "SUBMITTED", operator, "");
    } else {
      jdbcTemplate.update(
          "UPDATE police_register SET status = 'SUBMITTED' WHERE project_register_id = ?",
          projectId);
      workflowTraceService.appendAction(
          projectId,
          "POLICE_REGISTER_SUBMIT",
          detail.getStatus(),
          "SUBMITTED",
          operator,
          "");
    }

    workflowTraceService.moveNode(projectId, NEXT_NODE_KEY, "PENDING", operator);

    ProjectOwner projectOwner = loadProjectOwner(projectId);
    notificationService.createForUser(
        projectOwner.createdBy(),
        "公安登记已提交",
        "项目[" + projectOwner.applicationName() + "]已完成公安登记提交，请继续现场测评。",
        "POLICE_REGISTER_SUBMITTED",
        ProjectRegisterService.BIZ_TYPE,
        projectId);
    return detail(projectId).orElseThrow();
  }

  public boolean isSubmitted(long projectId) {
    Integer count =
        jdbcTemplate.queryForObject(
            """
            SELECT COUNT(1)
            FROM police_register
            WHERE project_register_id = ? AND status = 'SUBMITTED'
            """,
            Integer.class,
            projectId);
    return count != null && count > 0;
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
          pr.id,
          p.id project_register_id,
          p.application_name,
          p.status project_status,
          COALESCE(pr.status, 'DRAFT') status,
          pr.register_no,
          pr.filing_agency,
          pr.contact_name,
          pr.contact_phone,
          pr.remark,
          pr.created_by,
          pr.created_at,
          pr.updated_at,
          wi.current_node workflow_node,
          wi.status workflow_status
        FROM project_register p
        LEFT JOIN police_register pr ON pr.project_register_id = p.id
        LEFT JOIN workflow_instance wi ON wi.biz_type = 'PROJECT_REGISTER' AND wi.biz_id = p.id
        WHERE p.deleted_flag = 0 AND p.status = 'APPROVED'
        """;
  }

  private String trim(String value) {
    if (value == null) {
      return null;
    }
    String normalized = value.trim();
    return normalized.isEmpty() ? null : normalized;
  }

  private static class PoliceRegisterRowMapper implements RowMapper<PoliceRegisterRecord> {
    @Override
    public PoliceRegisterRecord mapRow(ResultSet rs, int rowNum) throws SQLException {
      PoliceRegisterRecord record = new PoliceRegisterRecord();
      Long id = rs.getLong("id");
      if (rs.wasNull()) {
        id = null;
      }
      record.setId(id);
      record.setProjectRegisterId(rs.getLong("project_register_id"));
      record.setApplicationName(rs.getString("application_name"));
      record.setProjectStatus(rs.getString("project_status"));
      record.setStatus(rs.getString("status"));
      record.setRegisterNo(rs.getString("register_no"));
      record.setFilingAgency(rs.getString("filing_agency"));
      record.setContactName(rs.getString("contact_name"));
      record.setContactPhone(rs.getString("contact_phone"));
      record.setRemark(rs.getString("remark"));
      record.setCreatedBy(rs.getString("created_by"));
      record.setCreatedAt(stringTimestamp(rs.getTimestamp("created_at")));
      record.setUpdatedAt(stringTimestamp(rs.getTimestamp("updated_at")));
      record.setWorkflowNode(rs.getString("workflow_node"));
      record.setWorkflowStatus(rs.getString("workflow_status"));
      return record;
    }

    private String stringTimestamp(java.sql.Timestamp timestamp) {
      return timestamp == null ? null : String.valueOf(timestamp);
    }
  }

  private record ProjectOwner(String createdBy, String applicationName) {}
}
