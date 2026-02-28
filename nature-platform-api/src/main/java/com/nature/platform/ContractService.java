/**
 * @input JdbcTemplate, JsonSupport, ContractNumberService, NotificationService, audit and user services
 * @output Contract CRUD, review transitions, archive transitions, numbering, and recycle-bin operations
 * @position Contract application service implementing core contract/business rules for V1
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
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
public class ContractService {
  private final JdbcTemplate jdbcTemplate;
  private final JsonSupport jsonSupport;
  private final ContractNumberService contractNumberService;
  private final NotificationService notificationService;
  private final UserAccountService userAccountService;
  private final FieldChangeLogService fieldChangeLogService;

  public ContractService(
      JdbcTemplate jdbcTemplate,
      JsonSupport jsonSupport,
      ContractNumberService contractNumberService,
      NotificationService notificationService,
      UserAccountService userAccountService,
      FieldChangeLogService fieldChangeLogService) {
    this.jdbcTemplate = jdbcTemplate;
    this.jsonSupport = jsonSupport;
    this.contractNumberService = contractNumberService;
    this.notificationService = notificationService;
    this.userAccountService = userAccountService;
    this.fieldChangeLogService = fieldChangeLogService;
  }

  public List<ContractRecord> list() {
    List<ContractRecord> rows =
        jdbcTemplate.query(
            """
            SELECT c.id, c.customer_id, COALESCE(cm.full_name, '') customer_name, c.project_name, c.contact_name, c.mobile_phone,
                   c.payment_company, c.payment_amount, c.payment_method, c.partner_name, c.sales_person, c.performance_city, c.deal_status,
                   c.remark, c.contract_type, c.contract_file_object_key, c.service_year_detail, c.payment_status,
                   c.contract_name, c.contract_no, c.review_status, c.archive_status, c.created_by, c.created_at, c.service_years_json
            FROM contract c
            LEFT JOIN customer cm ON cm.id = c.customer_id
            WHERE c.deleted_flag = 0
            ORDER BY c.id DESC
            """,
            new ContractRowMapper(jsonSupport));
    loadSystemItems(rows);
    return rows;
  }

  public List<ContractRecord> listForArchive() {
    List<ContractRecord> rows =
        jdbcTemplate.query(
            """
            SELECT c.id, c.customer_id, COALESCE(cm.full_name, '') customer_name, c.project_name, c.contact_name, c.mobile_phone,
                   c.payment_company, c.payment_amount, c.payment_method, c.partner_name, c.sales_person, c.performance_city, c.deal_status,
                   c.remark, c.contract_type, c.contract_file_object_key, c.service_year_detail, c.payment_status,
                   c.contract_name, c.contract_no, c.review_status, c.archive_status, c.created_by, c.created_at, c.service_years_json
            FROM contract c
            LEFT JOIN customer cm ON cm.id = c.customer_id
            WHERE c.deleted_flag = 0 AND c.review_status = 'APPROVED'
            ORDER BY c.id DESC
            """,
            new ContractRowMapper(jsonSupport));
    loadSystemItems(rows);
    return rows;
  }

  public Optional<ContractRecord> findById(long id) {
    List<ContractRecord> rows =
        jdbcTemplate.query(
            """
            SELECT c.id, c.customer_id, COALESCE(cm.full_name, '') customer_name, c.project_name, c.contact_name, c.mobile_phone,
                   c.payment_company, c.payment_amount, c.payment_method, c.partner_name, c.sales_person, c.performance_city, c.deal_status,
                   c.remark, c.contract_type, c.contract_file_object_key, c.service_year_detail, c.payment_status,
                   c.contract_name, c.contract_no, c.review_status, c.archive_status, c.created_by, c.created_at, c.service_years_json
            FROM contract c
            LEFT JOIN customer cm ON cm.id = c.customer_id
            WHERE c.id = ? AND c.deleted_flag = 0
            """,
            new ContractRowMapper(jsonSupport),
            id);
    if (rows.isEmpty()) {
      return Optional.empty();
    }
    loadSystemItems(rows);
    return rows.stream().findFirst();
  }

  @Transactional
  public long create(ContractRequest request, String operator) {
    ensureCustomerExists(request.getCustomerId());
    jdbcTemplate.update(
        """
        INSERT INTO contract (
          customer_id, project_name, contact_name, mobile_phone, payment_company, payment_amount, payment_method,
          partner_name, sales_person, performance_city, deal_status, remark, contract_type, service_years_json,
          contract_file_object_key, service_year_detail, payment_status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        request.getCustomerId(),
        request.getProjectName(),
        request.getContactName(),
        request.getMobilePhone(),
        request.getPaymentCompany(),
        request.getPaymentAmount(),
        request.getPaymentMethod(),
        request.getPartnerName(),
        request.getSalesPerson(),
        request.getPerformanceCity(),
        request.getDealStatus(),
        request.getRemark(),
        request.getContractType(),
        jsonSupport.toJson(request.getServiceYears()),
        request.getContractFileObjectKey(),
        request.getServiceYearDetail(),
        normalizePaymentStatus(request.getPaymentStatus()),
        operator);
    Long id = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
    long contractId = id == null ? 0L : id;
    replaceSystemItems(contractId, request.getSystemItems());
    return contractId;
  }

  @Transactional
  public ContractRecord update(long id, ContractRequest request, String operator) {
    ContractRecord old =
        findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "contract not found"));
    ensureOwner(old, operator);
    ensureCustomerExists(request.getCustomerId());

    Map<String, Object> oldValues = contractAuditMap(old);
    jdbcTemplate.update(
        """
        UPDATE contract
        SET customer_id = ?, project_name = ?, contact_name = ?, mobile_phone = ?, payment_company = ?, payment_amount = ?,
            payment_method = ?, partner_name = ?, sales_person = ?, performance_city = ?, deal_status = ?, remark = ?,
            contract_type = ?, service_years_json = ?, contract_file_object_key = ?, service_year_detail = ?, payment_status = ?
        WHERE id = ? AND deleted_flag = 0
        """,
        request.getCustomerId(),
        request.getProjectName(),
        request.getContactName(),
        request.getMobilePhone(),
        request.getPaymentCompany(),
        request.getPaymentAmount(),
        request.getPaymentMethod(),
        request.getPartnerName(),
        request.getSalesPerson(),
        request.getPerformanceCity(),
        request.getDealStatus(),
        request.getRemark(),
        request.getContractType(),
        jsonSupport.toJson(request.getServiceYears()),
        request.getContractFileObjectKey(),
        request.getServiceYearDetail(),
        normalizePaymentStatus(request.getPaymentStatus()),
        id);
    replaceSystemItems(id, request.getSystemItems());

    ContractRecord updated =
        findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "contract not found"));
    fieldChangeLogService.logFieldChanges(
        "CONTRACT", id, operator, oldValues, contractAuditMap(updated));
    return updated;
  }

  @Transactional
  public void delete(long id, String operator) {
    ContractRecord old =
        findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "contract not found"));
    ensureOwner(old, operator);
    jdbcTemplate.update(
        "UPDATE contract SET deleted_flag = 1, deleted_at = NOW() WHERE id = ? AND deleted_flag = 0", id);
    jdbcTemplate.update(
        """
        INSERT INTO recycle_bin (biz_type, biz_id, deleted_by)
        VALUES ('CONTRACT', ?, ?)
        ON DUPLICATE KEY UPDATE deleted_by = VALUES(deleted_by), deleted_at = NOW()
        """,
        id,
        operator);
  }

  @Transactional
  public void submitReview(long id, String operator) {
    ContractRecord contract =
        findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "contract not found"));
    ensureOwner(contract, operator);

    jdbcTemplate.update(
        "UPDATE contract SET review_status = 'SUBMITTED' WHERE id = ? AND deleted_flag = 0", id);
    notificationService.createForUsers(
        userAccountService.listEnabledUsernames(),
        "合同审核待处理",
        "合同[" + contract.getProjectName() + "]已提交审核。",
        "CONTRACT_REVIEW_ENTER",
        "CONTRACT",
        id);
  }

  @Transactional
  public ContractRecord approve(long id, String operator) {
    ContractRecord contract =
        findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "contract not found"));
    boolean regenerate = "REJECTED".equalsIgnoreCase(contract.getReviewStatus()) || contract.getContractNo() == null;
    String contractNo = contract.getContractNo();
    String contractName = contract.getContractName();

    if (regenerate) {
      int year = contractNumberService.currentYear();
      int seq = nextSerial(year);
      contractNo = contractNumberService.buildContractNo(year, seq);
      contractName =
          contractNumberService.buildContractName(
              contract.getCustomerName(), contract.getSystemItems(), contract.getServiceYears());
    }

    jdbcTemplate.update(
        """
        UPDATE contract
        SET review_status = 'APPROVED', contract_no = ?, contract_name = ?
        WHERE id = ? AND deleted_flag = 0
        """,
        contractNo,
        contractName,
        id);

    notificationService.createForUsers(
        userAccountService.listEnabledUsernames(),
        "合同审核通过",
        "合同[" + contractName + "]审核已通过。",
        "CONTRACT_REVIEW_APPROVED",
        "CONTRACT",
        id);
    return findById(id).orElseThrow();
  }

  @Transactional
  public void reject(long id, String operator, String remark) {
    ContractRecord contract =
        findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "contract not found"));
    jdbcTemplate.update(
        "UPDATE contract SET review_status = 'REJECTED' WHERE id = ? AND deleted_flag = 0", id);
    notificationService.createForUser(
        contract.getCreatedBy(),
        "合同审核驳回",
        "合同[" + contract.getProjectName() + "]被驳回，备注：" + (remark == null ? "" : remark),
        "CONTRACT_REVIEW_REJECTED",
        "CONTRACT",
        id);
  }

  @Transactional
  public void archive(long id, ContractArchiveRequest request, String operator) {
    ContractRecord contract =
        findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "contract not found"));
    if (!"APPROVED".equalsIgnoreCase(contract.getReviewStatus())) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "contract review must be approved before archive");
    }
    if ("ARCHIVED".equalsIgnoreCase(contract.getArchiveStatus())) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "contract already archived");
    }
    jdbcTemplate.update(
        """
        UPDATE contract
        SET archive_status = 'ARCHIVED', signed_at = ?, file_count = ?, storage_location = ?, archive_remark = ?, archive_scan_object_key = ?
        WHERE id = ? AND deleted_flag = 0
        """,
        request.getSignedAt(),
        request.getFileCount(),
        request.getStorageLocation(),
        request.getRemark(),
        request.getArchiveScanObjectKey(),
        id);

    notificationService.createForUser(
        contract.getCreatedBy(),
        "合同归档完成",
        "合同[" + contract.getProjectName() + "]已完成归档。",
        "CONTRACT_ARCHIVED",
        "CONTRACT",
        id);
  }

  private void ensureCustomerExists(long customerId) {
    Integer count =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(1) FROM customer WHERE id = ? AND deleted_flag = 0", Integer.class, customerId);
    if (count == null || count == 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "customer not found");
    }
  }

  private void ensureOwner(ContractRecord record, String operator) {
    if (!operator.equals(record.getCreatedBy())) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "only creator can edit contract");
    }
  }

  private String normalizePaymentStatus(String paymentStatus) {
    if (paymentStatus == null || paymentStatus.isBlank()) {
      return "UNPAID";
    }
    String upper = paymentStatus.toUpperCase();
    return "PAID".equals(upper) ? "PAID" : "UNPAID";
  }

  private int nextSerial(int year) {
    Integer current =
        jdbcTemplate.query(
                "SELECT next_seq FROM contract_serial WHERE serial_year = ? FOR UPDATE",
                (rs, rowNum) -> rs.getInt("next_seq"),
                year)
            .stream()
            .findFirst()
            .orElse(null);
    if (current == null) {
      jdbcTemplate.update("INSERT INTO contract_serial (serial_year, next_seq) VALUES (?, 2)", year);
      return 1;
    }
    jdbcTemplate.update("UPDATE contract_serial SET next_seq = ? WHERE serial_year = ?", current + 1, year);
    return current;
  }

  private void replaceSystemItems(long contractId, List<ContractSystemItemPayload> systemItems) {
    jdbcTemplate.update("UPDATE contract_system_item SET deleted_flag = 1 WHERE contract_id = ?", contractId);
    int sort = 1;
    for (ContractSystemItemPayload item : systemItems) {
      jdbcTemplate.update(
          """
          INSERT INTO contract_system_item (contract_id, system_level, system_name, sort_order, deleted_flag)
          VALUES (?, ?, ?, ?, 0)
          """,
          contractId,
          item.getSystemLevel(),
          item.getSystemName(),
          sort++);
    }
  }

  private void loadSystemItems(List<ContractRecord> contracts) {
    if (contracts.isEmpty()) {
      return;
    }
    Map<Long, ContractRecord> map = new LinkedHashMap<>();
    for (ContractRecord contract : contracts) {
      map.put(contract.getId(), contract);
      contract.setSystemItems(new ArrayList<>());
    }
    String inSql =
        contracts.stream().map(item -> String.valueOf(item.getId())).reduce((a, b) -> a + "," + b).orElse("0");
    jdbcTemplate.query(
        """
        SELECT contract_id, system_level, system_name
        FROM contract_system_item
        WHERE deleted_flag = 0 AND contract_id IN (%s)
        ORDER BY contract_id ASC, system_level ASC, sort_order ASC, id ASC
        """
            .formatted(inSql),
        rs -> {
          ContractRecord contract = map.get(rs.getLong("contract_id"));
          if (contract == null) {
            return;
          }
          ContractSystemItemPayload item = new ContractSystemItemPayload();
          item.setSystemLevel(rs.getInt("system_level"));
          item.setSystemName(rs.getString("system_name"));
          contract.getSystemItems().add(item);
        });
  }

  private Map<String, Object> contractAuditMap(ContractRecord record) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("projectName", record.getProjectName());
    map.put("paymentCompany", record.getPaymentCompany());
    map.put("paymentAmount", record.getPaymentAmount());
    map.put("paymentMethod", record.getPaymentMethod());
    map.put("partnerName", record.getPartnerName());
    map.put("salesPerson", record.getSalesPerson());
    map.put("performanceCity", record.getPerformanceCity());
    map.put("dealStatus", record.getDealStatus());
    map.put("remark", record.getRemark());
    map.put("contractType", record.getContractType());
    map.put("serviceYearDetail", record.getServiceYearDetail());
    map.put("paymentStatus", record.getPaymentStatus());
    map.put("contractFileObjectKey", record.getContractFileObjectKey());
    map.put("serviceYears", record.getServiceYears());
    return map;
  }

  private static class ContractRowMapper implements RowMapper<ContractRecord> {
    private final JsonSupport jsonSupport;

    private ContractRowMapper(JsonSupport jsonSupport) {
      this.jsonSupport = jsonSupport;
    }

    @Override
    public ContractRecord mapRow(ResultSet rs, int rowNum) throws SQLException {
      ContractRecord record = new ContractRecord();
      record.setId(rs.getLong("id"));
      record.setCustomerId(rs.getLong("customer_id"));
      record.setCustomerName(rs.getString("customer_name"));
      record.setProjectName(rs.getString("project_name"));
      record.setContactName(rs.getString("contact_name"));
      record.setMobilePhone(rs.getString("mobile_phone"));
      record.setPaymentCompany(rs.getString("payment_company"));
      record.setPaymentAmount(rs.getBigDecimal("payment_amount"));
      record.setPaymentMethod(rs.getString("payment_method"));
      record.setPartnerName(rs.getString("partner_name"));
      record.setSalesPerson(rs.getString("sales_person"));
      record.setPerformanceCity(rs.getString("performance_city"));
      record.setDealStatus(rs.getString("deal_status"));
      record.setRemark(rs.getString("remark"));
      record.setContractType(rs.getString("contract_type"));
      record.setContractFileObjectKey(rs.getString("contract_file_object_key"));
      record.setServiceYearDetail(rs.getString("service_year_detail"));
      record.setPaymentStatus(rs.getString("payment_status"));
      record.setContractName(rs.getString("contract_name"));
      record.setContractNo(rs.getString("contract_no"));
      record.setReviewStatus(rs.getString("review_status"));
      record.setArchiveStatus(rs.getString("archive_status"));
      record.setCreatedBy(rs.getString("created_by"));
      record.setCreatedAt(String.valueOf(rs.getTimestamp("created_at")));
      record.setServiceYears(jsonSupport.fromJsonIntList(rs.getString("service_years_json")));
      return record;
    }
  }
}
