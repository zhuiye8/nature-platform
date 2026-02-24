/**
 * @input JdbcTemplate data access for recycle_bin/contract/project_register and user-role checks
 * @output Recycle-bin list queries and restore operations with conflict/permission checks
 * @position Recycle-bin application service implementing soft-delete recovery rules
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class RecycleBinService {
  private final JdbcTemplate jdbcTemplate;
  private final UserAccountService userAccountService;

  public RecycleBinService(JdbcTemplate jdbcTemplate, UserAccountService userAccountService) {
    this.jdbcTemplate = jdbcTemplate;
    this.userAccountService = userAccountService;
  }

  public List<RecycleItemRecord> listContracts() {
    return jdbcTemplate.query(
        """
        SELECT r.biz_id, COALESCE(c.contract_name, c.project_name, '') biz_name, r.deleted_by, r.deleted_at,
               COALESCE(c.contract_no, '') extra
        FROM recycle_bin r
        JOIN contract c ON c.id = r.biz_id
        WHERE r.biz_type = 'CONTRACT'
        ORDER BY r.deleted_at DESC
        """,
        (rs, rowNum) -> {
          RecycleItemRecord item = new RecycleItemRecord();
          item.setBizId(rs.getLong("biz_id"));
          item.setBizName(rs.getString("biz_name"));
          item.setDeletedBy(rs.getString("deleted_by"));
          item.setDeletedAt(String.valueOf(rs.getTimestamp("deleted_at")));
          item.setExtra(rs.getString("extra"));
          return item;
        });
  }

  public List<RecycleItemRecord> listProjects() {
    return jdbcTemplate.query(
        """
        SELECT r.biz_id, p.application_name biz_name, r.deleted_by, r.deleted_at,
               CONCAT('contract=', p.contract_id, ',year=', p.contract_year) extra
        FROM recycle_bin r
        JOIN project_register p ON p.id = r.biz_id
        WHERE r.biz_type = 'PROJECT_REGISTER'
        ORDER BY r.deleted_at DESC
        """,
        (rs, rowNum) -> {
          RecycleItemRecord item = new RecycleItemRecord();
          item.setBizId(rs.getLong("biz_id"));
          item.setBizName(rs.getString("biz_name"));
          item.setDeletedBy(rs.getString("deleted_by"));
          item.setDeletedAt(String.valueOf(rs.getTimestamp("deleted_at")));
          item.setExtra(rs.getString("extra"));
          return item;
        });
  }

  @Transactional
  public void restore(String type, long id, String operator) {
    if (!userAccountService.hasRole(operator, UserAccountService.ROLE_SUPER_ADMIN)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "current user has no restore permission");
    }
    switch (type.toUpperCase()) {
      case "CONTRACT" -> restoreContract(id);
      case "PROJECT_REGISTER" -> restoreProject(id);
      default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "unsupported recycle type");
    }
    jdbcTemplate.update("DELETE FROM recycle_bin WHERE biz_type = ? AND biz_id = ?", type.toUpperCase(), id);
  }

  private void restoreContract(long id) {
    Integer count =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(1) FROM contract WHERE id = ? AND deleted_flag = 1", Integer.class, id);
    if (count == null || count == 0) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "contract not found in recycle-bin");
    }
    jdbcTemplate.update(
        "UPDATE contract SET deleted_flag = 0, deleted_at = NULL WHERE id = ? AND deleted_flag = 1", id);
  }

  private void restoreProject(long id) {
    List<ProjectKey> keys =
        jdbcTemplate.query(
            "SELECT contract_id, contract_year FROM project_register WHERE id = ? AND deleted_flag = 1",
            (rs, rowNum) -> new ProjectKey(rs.getLong("contract_id"), rs.getInt("contract_year")),
            id);
    ProjectKey key =
        keys.stream()
            .findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "project not found in recycle-bin"));

    Integer conflict =
        jdbcTemplate.queryForObject(
            """
            SELECT COUNT(1)
            FROM project_register
            WHERE contract_id = ? AND contract_year = ? AND deleted_flag = 0
            """,
            Integer.class,
            key.contractId(),
            key.contractYear());
    if (conflict != null && conflict > 0) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "restore conflict: same contract-year active record exists");
    }
    jdbcTemplate.update(
        "UPDATE project_register SET deleted_flag = 0, deleted_at = NULL WHERE id = ? AND deleted_flag = 1", id);
  }

  private record ProjectKey(long contractId, int contractYear) {}
}
