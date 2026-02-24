/**
 * @input JdbcTemplate persistence for workflow_instance/workflow_action_log and project workflow context
 * @output Workflow node/status transition helpers and action-log append APIs for project register follow-up stages
 * @position Shared project workflow trace service used by nodes 7-10 to keep node transitions and trace data consistent
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ProjectWorkflowTraceService {
  public static final String BIZ_TYPE = ProjectRegisterService.BIZ_TYPE;
  public static final String WORKFLOW_KEY = ProjectRegisterService.PROJECT_REVIEW_WORKFLOW_KEY;

  private final JdbcTemplate jdbcTemplate;

  public ProjectWorkflowTraceService(JdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
  }

  public long moveNode(long projectId, String node, String workflowStatus, String operator) {
    ensureProjectExists(projectId);
    long instanceId = ensureWorkflowInstance(projectId, operator, node, workflowStatus);
    if (isFinishedStatus(workflowStatus)) {
      jdbcTemplate.update(
          """
          UPDATE workflow_instance
          SET current_node = ?, status = ?, finished_at = NOW()
          WHERE id = ?
          """,
          node,
          workflowStatus,
          instanceId);
    } else {
      jdbcTemplate.update(
          """
          UPDATE workflow_instance
          SET current_node = ?, status = ?, finished_at = NULL
          WHERE id = ?
          """,
          node,
          workflowStatus,
          instanceId);
    }
    return instanceId;
  }

  public long appendAction(
      long projectId,
      String action,
      String fromStatus,
      String toStatus,
      String operator,
      String remark) {
    long instanceId = ensureWorkflowInstance(projectId, operator, "", "PENDING");
    jdbcTemplate.update(
        """
        INSERT INTO workflow_action_log (
          instance_id, biz_type, biz_id, action, from_status, to_status, operator, remark
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        instanceId,
        BIZ_TYPE,
        projectId,
        action,
        fromStatus,
        toStatus,
        operator,
        remark == null ? "" : remark);
    return instanceId;
  }

  private long ensureWorkflowInstance(
      long projectId, String operator, String defaultNode, String defaultWorkflowStatus) {
    List<Long> ids =
        jdbcTemplate.query(
            """
            SELECT id
            FROM workflow_instance
            WHERE biz_type = ? AND biz_id = ?
            """,
            (rs, rowNum) -> rs.getLong("id"),
            BIZ_TYPE,
            projectId);
    if (!ids.isEmpty()) {
      return ids.get(0);
    }

    String node = defaultNode == null || defaultNode.isBlank() ? "PROJECT_REGISTER_REVIEW" : defaultNode;
    String status =
        defaultWorkflowStatus == null || defaultWorkflowStatus.isBlank() ? "PENDING" : defaultWorkflowStatus;
    jdbcTemplate.update(
        """
        INSERT INTO workflow_instance (
          biz_type, biz_id, workflow_key, current_node, status, started_by, process_instance_id, finished_at
        ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)
        """,
        BIZ_TYPE,
        projectId,
        WORKFLOW_KEY,
        node,
        status,
        operator,
        isFinishedStatus(status) ? java.sql.Timestamp.valueOf(java.time.LocalDateTime.now()) : null);
    Long insertedId = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
    if (insertedId == null || insertedId <= 0) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "workflow instance create failed");
    }
    return insertedId;
  }

  private boolean isFinishedStatus(String workflowStatus) {
    return "APPROVED".equalsIgnoreCase(workflowStatus) || "REJECTED".equalsIgnoreCase(workflowStatus);
  }

  private void ensureProjectExists(long projectId) {
    Integer count =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(1) FROM project_register WHERE id = ? AND deleted_flag = 0", Integer.class, projectId);
    if (count == null || count == 0) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "project register not found");
    }
  }
}
