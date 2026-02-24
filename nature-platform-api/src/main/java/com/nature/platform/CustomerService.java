/**
 * @input JdbcTemplate for customer persistence; FieldChangeLogService for audit trail
 * @output Customer CRUD operations with ownership checks and field-level change logging
 * @position Customer application service layer implementing business constraints from requirements
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CustomerService {
  private final JdbcTemplate jdbcTemplate;
  private final FieldChangeLogService fieldChangeLogService;

  public CustomerService(JdbcTemplate jdbcTemplate, FieldChangeLogService fieldChangeLogService) {
    this.jdbcTemplate = jdbcTemplate;
    this.fieldChangeLogService = fieldChangeLogService;
  }

  public List<CustomerRecord> list() {
    return jdbcTemplate.query(
        """
        SELECT id, full_name, industry, region, address_detail, uscc, contact_name, mobile_phone, remark,
               created_by, created_at, updated_at
        FROM customer
        WHERE deleted_flag = 0
        ORDER BY id DESC
        """,
        new CustomerRowMapper());
  }

  public Optional<CustomerRecord> findById(long id) {
    List<CustomerRecord> rows =
        jdbcTemplate.query(
            """
            SELECT id, full_name, industry, region, address_detail, uscc, contact_name, mobile_phone, remark,
                   created_by, created_at, updated_at
            FROM customer
            WHERE id = ? AND deleted_flag = 0
            """,
            new CustomerRowMapper(),
            id);
    return rows.stream().findFirst();
  }

  @Transactional
  public long create(CustomerRequest request, String operator) {
    jdbcTemplate.update(
        """
        INSERT INTO customer (full_name, industry, region, address_detail, uscc, contact_name, mobile_phone, remark, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        request.getFullName(),
        request.getIndustry(),
        request.getRegion(),
        request.getAddressDetail(),
        request.getUscc(),
        request.getContactName(),
        request.getMobilePhone(),
        request.getRemark(),
        operator);
    Long id = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
    return id == null ? 0L : id;
  }

  @Transactional
  public CustomerRecord update(long id, CustomerRequest request, String operator) {
    CustomerRecord old =
        findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "customer not found"));
    ensureEditable(old, operator);

    Map<String, Object> oldValues = toAuditMap(old);
    jdbcTemplate.update(
        """
        UPDATE customer
        SET full_name = ?, industry = ?, region = ?, address_detail = ?, uscc = ?, contact_name = ?, mobile_phone = ?, remark = ?
        WHERE id = ? AND deleted_flag = 0
        """,
        request.getFullName(),
        request.getIndustry(),
        request.getRegion(),
        request.getAddressDetail(),
        request.getUscc(),
        request.getContactName(),
        request.getMobilePhone(),
        request.getRemark(),
        id);

    CustomerRecord updated =
        findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "customer not found"));
    fieldChangeLogService.logFieldChanges(
        "CUSTOMER", id, operator, oldValues, toAuditMap(updated));
    return updated;
  }

  @Transactional
  public void delete(long id, String operator) {
    CustomerRecord old =
        findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "customer not found"));
    ensureEditable(old, operator);

    jdbcTemplate.update(
        """
        UPDATE customer
        SET deleted_flag = 1, deleted_at = NOW()
        WHERE id = ? AND deleted_flag = 0
        """,
        id);
  }

  private Map<String, Object> toAuditMap(CustomerRecord record) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("fullName", record.getFullName());
    map.put("industry", record.getIndustry());
    map.put("region", record.getRegion());
    map.put("addressDetail", record.getAddressDetail());
    map.put("uscc", record.getUscc());
    map.put("contactName", record.getContactName());
    map.put("mobilePhone", record.getMobilePhone());
    map.put("remark", record.getRemark());
    return map;
  }

  private void ensureEditable(CustomerRecord customer, String operator) {
    if (!operator.equals(customer.getCreatedBy())) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "only creator can edit or delete customer");
    }
  }

  private static class CustomerRowMapper implements RowMapper<CustomerRecord> {
    @Override
    public CustomerRecord mapRow(ResultSet rs, int rowNum) throws SQLException {
      CustomerRecord record = new CustomerRecord();
      record.setId(rs.getLong("id"));
      record.setFullName(rs.getString("full_name"));
      record.setIndustry(rs.getString("industry"));
      record.setRegion(rs.getString("region"));
      record.setAddressDetail(rs.getString("address_detail"));
      record.setUscc(rs.getString("uscc"));
      record.setContactName(rs.getString("contact_name"));
      record.setMobilePhone(rs.getString("mobile_phone"));
      record.setRemark(rs.getString("remark"));
      record.setCreatedBy(rs.getString("created_by"));
      record.setCreatedAt(String.valueOf(rs.getTimestamp("created_at")));
      record.setUpdatedAt(String.valueOf(rs.getTimestamp("updated_at")));
      return record;
    }
  }
}

