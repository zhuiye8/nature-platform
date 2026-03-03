/**
 * @input JdbcTemplate persistence, Flowable Runtime/Task services, JsonSupport serialization, notification/user services
 * @output Project register CRUD, submit/approve/reject transitions, Flowable process start, and workflow trace query APIs
 * @position Project registration application service implementing V1 registration closure with Flowable-based review routing
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.engine.runtime.ProcessInstance;
import org.flowable.task.api.Task;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ProjectRegisterService {
  private static final ZoneId ZONE_ID = ZoneId.of("Asia/Shanghai");
  public static final String BIZ_TYPE = "PROJECT_REGISTER";
  public static final String PROJECT_REVIEW_WORKFLOW_KEY = "PROJECT_REGISTER_FLOW";
  public static final String REVIEW_NODE_KEY = "PROJECT_REGISTER_REVIEW";

  private final JdbcTemplate jdbcTemplate;
  private final JsonSupport jsonSupport;
  private final NotificationService notificationService;
  private final UserAccountService userAccountService;
  private final UserDataScopeService userDataScopeService;
  private final RuntimeService runtimeService;
  private final TaskService taskService;

  public ProjectRegisterService(
      JdbcTemplate jdbcTemplate,
      JsonSupport jsonSupport,
      NotificationService notificationService,
      UserAccountService userAccountService,
      UserDataScopeService userDataScopeService,
      RuntimeService runtimeService,
      TaskService taskService) {
    this.jdbcTemplate = jdbcTemplate;
    this.jsonSupport = jsonSupport;
    this.notificationService = notificationService;
    this.userAccountService = userAccountService;
    this.userDataScopeService = userDataScopeService;
    this.runtimeService = runtimeService;
    this.taskService = taskService;
  }

  public List<ProjectRegisterRecord> list(String operator) {
    List<ProjectRegisterRecord> rows =
        jdbcTemplate.query(
            """
            SELECT p.id, p.contract_id, p.contract_year, p.application_name, p.status, p.created_by, p.created_at,
                   COALESCE(c.contract_name, c.project_name, '') contract_name,
                   wi.id workflow_instance_id, wi.status workflow_status, wi.current_node workflow_node, wi.process_instance_id
            FROM project_register p
            LEFT JOIN contract c ON c.id = p.contract_id
            LEFT JOIN workflow_instance wi ON wi.biz_type = 'PROJECT_REGISTER' AND wi.biz_id = p.id
            WHERE p.deleted_flag = 0
            ORDER BY p.id DESC
            """,
            new ProjectRowMapper());
    loadSystemItems(rows);
    loadAssessmentMembers(rows);
    return userDataScopeService.filterByCreator(operator, rows, ProjectRegisterRecord::getCreatedBy, true);
  }

  public Optional<ProjectRegisterRecord> findById(long id) {
    List<ProjectRegisterRecord> rows =
        jdbcTemplate.query(
            """
            SELECT p.id, p.contract_id, p.contract_year, p.application_name, p.status, p.created_by, p.created_at,
                   COALESCE(c.contract_name, c.project_name, '') contract_name,
                   wi.id workflow_instance_id, wi.status workflow_status, wi.current_node workflow_node, wi.process_instance_id
            FROM project_register p
            LEFT JOIN contract c ON c.id = p.contract_id
            LEFT JOIN workflow_instance wi ON wi.biz_type = 'PROJECT_REGISTER' AND wi.biz_id = p.id
            WHERE p.id = ? AND p.deleted_flag = 0
            """,
            new ProjectRowMapper(),
            id);
    if (rows.isEmpty()) {
      return Optional.empty();
    }
    loadSystemItems(rows);
    loadAssessmentMembers(rows);
    return rows.stream().findFirst();
  }

  public Optional<ProjectRegisterRecord> findByIdVisible(long id, String operator) {
    Optional<ProjectRegisterRecord> row = findById(id);
    if (row.isEmpty()) {
      return Optional.empty();
    }
    return userDataScopeService.canAccessByCreator(
            operator, row.get().getCreatedBy(), true)
        ? row
        : Optional.empty();
  }

  public List<WorkflowTraceRecord> listWorkflowTrace(long id) {
    ensureExists(id);
    return jdbcTemplate.query(
        """
        SELECT wal.id, wal.instance_id, wal.action, wal.from_status, wal.to_status,
               wal.operator, wal.remark, wal.created_at, wi.status workflow_status, wi.current_node workflow_node
        FROM workflow_action_log wal
        LEFT JOIN workflow_instance wi ON wi.id = wal.instance_id
        WHERE wal.biz_type = ? AND wal.biz_id = ?
        ORDER BY wal.id ASC
        """,
        new WorkflowTraceRowMapper(),
        BIZ_TYPE,
        id);
  }

  public List<String> listAssessmentMembers(long projectId) {
    ensureExists(projectId);
    return jdbcTemplate.query(
        """
        SELECT username
        FROM project_assessment_member
        WHERE project_register_id = ?
        ORDER BY sort_order ASC, id ASC
        """,
        (rs, rowNum) -> rs.getString("username"),
        projectId);
  }

  public List<AdminRoleUserOptionRecord> listAssessmentMemberOptions(long projectId) {
    ensureExists(projectId);
    return jdbcTemplate.query(
        """
        SELECT u.username, u.display_name, u.enabled, u.dept_id, d.dept_name
        FROM user_account u
        LEFT JOIN iam_department d ON d.id = u.dept_id
        WHERE u.enabled = 1
        ORDER BY COALESCE(d.sort_order, 9999) ASC, d.id ASC, u.display_name ASC, u.username ASC
        """,
        (rs, rowNum) -> {
          AdminRoleUserOptionRecord record = new AdminRoleUserOptionRecord();
          record.setUsername(rs.getString("username"));
          record.setDisplayName(rs.getString("display_name"));
          record.setEnabled(rs.getBoolean("enabled"));
          long deptId = rs.getLong("dept_id");
          record.setDeptId(rs.wasNull() ? null : deptId);
          record.setDeptName(rs.getString("dept_name"));
          return record;
        });
  }

  @Transactional
  public void saveAssessmentMembers(long projectId, List<String> usernames, String operator) {
    ensureExists(projectId);
    List<String> normalized = normalizeUsernames(usernames);
    if (normalized.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "\u81f3\u5c11\u9700\u8981\u5206\u914d 1 \u540d\u6d4b\u8bc4\u4eba\u5458");
    }
    ensureEnabledUsernames(normalized);

    jdbcTemplate.update("DELETE FROM project_assessment_member WHERE project_register_id = ?", projectId);
    int sortOrder = 1;
    for (String username : normalized) {
      jdbcTemplate.update(
          """
          INSERT INTO project_assessment_member (project_register_id, username, sort_order, created_by)
          VALUES (?, ?, ?, ?)
          """,
          projectId,
          username,
          sortOrder++,
          operator);
    }
  }


  private List<String> normalizeUsernames(List<String> usernames) {
    if (usernames == null || usernames.isEmpty()) {
      return List.of();
    }
    LinkedHashSet<String> set = new LinkedHashSet<>();
    for (String username : usernames) {
      if (username == null || username.isBlank()) {
        continue;
      }
      set.add(username.trim());
    }
    return new ArrayList<>(set);
  }

  private void ensureEnabledUsernames(List<String> usernames) {
    if (usernames == null || usernames.isEmpty()) {
      return;
    }
    String placeholders = String.join(",", java.util.Collections.nCopies(usernames.size(), "?"));
    String sql =
        "SELECT username FROM user_account WHERE enabled = 1 AND username IN (" + placeholders + ")";
    List<String> enabled = jdbcTemplate.query(sql, (rs, rowNum) -> rs.getString("username"), usernames.toArray());
    Set<String> enabledSet = Set.copyOf(enabled);
    for (String username : usernames) {
      if (!enabledSet.contains(username)) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "assignee user not enabled: " + username);
      }
    }
  }

  @Transactional
  public long create(ProjectRegisterRequest request, String operator) {
    ContractBase contract = mustLoadArchivedContract(request.getContractId());
    validateYearAllowed(contract.serviceYears(), request.getContractYear());
    ensureUniqueActive(request.getContractId(), request.getContractYear(), null);
    validateSystemItems(request.getSystemItems());

    String today = LocalDate.now(ZONE_ID).toString();
    String appName =
        operator
            + "-系统登记申请-"
            + contract.contractName()
            + "("
            + request.getContractYear()
            + ")-"
            + today;

    jdbcTemplate.update(
        """
        INSERT INTO project_register (contract_id, contract_year, application_name, status, created_by)
        VALUES (?, ?, ?, 'DRAFT', ?)
        """,
        request.getContractId(),
        request.getContractYear(),
        appName,
        operator);
    Long id = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
    if (id == null || id <= 0) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "project register create failed");
    }
    replaceSystemItems(id, request.getSystemItems());
    return id;
  }

  @Transactional
  public ProjectRegisterRecord update(long id, ProjectRegisterRequest request, String operator) {
    ProjectRegisterRecord old =
        findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "project register not found"));
    ensureOwner(old, operator);
    ensureEditable(old.getStatus());

    ContractBase contract = mustLoadArchivedContract(request.getContractId());
    validateYearAllowed(contract.serviceYears(), request.getContractYear());
    ensureUniqueActive(request.getContractId(), request.getContractYear(), id);
    validateSystemItems(request.getSystemItems());

    jdbcTemplate.update(
        """
        UPDATE project_register
        SET contract_id = ?, contract_year = ?
        WHERE id = ? AND deleted_flag = 0
        """,
        request.getContractId(),
        request.getContractYear(),
        id);
    replaceSystemItems(id, request.getSystemItems());
    return findById(id).orElseThrow();
  }

  @Transactional
  public void delete(long id, String operator) {
    ProjectRegisterRecord old =
        findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "project register not found"));
    ensureOwner(old, operator);
    ensureEditable(old.getStatus());

    jdbcTemplate.update(
        "UPDATE project_register SET deleted_flag = 1, deleted_at = NOW() WHERE id = ? AND deleted_flag = 0", id);
    jdbcTemplate.update(
        """
        INSERT INTO recycle_bin (biz_type, biz_id, deleted_by)
        VALUES ('PROJECT_REGISTER', ?, ?)
        ON DUPLICATE KEY UPDATE deleted_by = VALUES(deleted_by), deleted_at = NOW()
        """,
        id,
        operator);
  }

  @Transactional
  public void submitReview(long id, String operator) {
    ProjectRegisterRecord project =
        findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "project register not found"));
    ensureOwner(project, operator);
    ensureSubmittable(project.getStatus());

    jdbcTemplate.update(
        "UPDATE project_register SET status = 'SUBMITTED' WHERE id = ? AND deleted_flag = 0", id);

    ProcessLaunch launch = startReviewProcess(id, project, operator);
    long workflowInstanceId = upsertWorkflowInstance(id, operator, launch.currentNode(), launch.processInstanceId());
    String action = "REJECTED".equalsIgnoreCase(project.getStatus()) ? "RESUBMIT" : "SUBMIT";
    insertWorkflowAction(
        workflowInstanceId, id, action, project.getStatus(), "SUBMITTED", operator, "");

    notificationService.createForUsers(
        userAccountService.listEnabledUsernames(),
        "\u9879\u76ee\u767b\u8bb0\u5f85\u5ba1\u6838",
        "\u9879\u76ee\u767b\u8bb0\u7533\u8bf7[" + project.getApplicationName() + "]\u5df2\u63d0\u4ea4\u5ba1\u6838\u3002",
        "PROJECT_REGISTER_SUBMITTED",
        BIZ_TYPE,
        id);
  }

  @Transactional
  public ProjectRegisterRecord approve(long id, String operator) {
    ProjectRegisterRecord project =
        findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "project register not found"));
    ensureSubmitted(project.getStatus());
    ensureAssessmentMembersAssigned(id);

    jdbcTemplate.update(
        "UPDATE project_register SET status = 'APPROVED' WHERE id = ? AND deleted_flag = 0", id);
    long workflowInstanceId = markWorkflowFinished(id, "APPROVED", "END", operator);
    insertWorkflowAction(workflowInstanceId, id, "APPROVE", "SUBMITTED", "APPROVED", operator, "");

    notificationService.createForUser(
        project.getCreatedBy(),
        "\u9879\u76ee\u767b\u8bb0\u5ba1\u6838\u901a\u8fc7",
        "\u9879\u76ee\u767b\u8bb0\u7533\u8bf7[" + project.getApplicationName() + "]\u5ba1\u6838\u901a\u8fc7\u3002",
        "PROJECT_REGISTER_APPROVED",
        BIZ_TYPE,
        id);
    return findById(id).orElseThrow();
  }

  @Transactional
  public void reject(long id, String operator, String remark) {
    ProjectRegisterRecord project =
        findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "project register not found"));
    ensureSubmitted(project.getStatus());

    jdbcTemplate.update(
        "UPDATE project_register SET status = 'REJECTED' WHERE id = ? AND deleted_flag = 0", id);
    long workflowInstanceId = markWorkflowFinished(id, "REJECTED", REVIEW_NODE_KEY, operator);
    insertWorkflowAction(
        workflowInstanceId,
        id,
        "REJECT",
        "SUBMITTED",
        "REJECTED",
        operator,
        remark == null ? "" : remark);

    notificationService.createForUser(
        project.getCreatedBy(),
        "\u9879\u76ee\u767b\u8bb0\u5ba1\u6838\u9a73\u56de",
        "\u9879\u76ee\u767b\u8bb0\u7533\u8bf7[" + project.getApplicationName() + "]\u5ba1\u6838\u9a73\u56de\uff1a" + (remark == null ? "" : remark),
        "PROJECT_REGISTER_REJECTED",
        BIZ_TYPE,
        id);
  }

  private ContractBase mustLoadArchivedContract(long contractId) {
    List<ContractBase> rows =
        jdbcTemplate.query(
            """
            SELECT id, COALESCE(contract_name, project_name, '') contract_name, archive_status, service_years_json
            FROM contract
            WHERE id = ? AND deleted_flag = 0
            """,
            (rs, rowNum) ->
                new ContractBase(
                    rs.getLong("id"),
                    rs.getString("contract_name"),
                    rs.getString("archive_status"),
                    jsonSupport.fromJsonIntList(rs.getString("service_years_json"))),
            contractId);
    ContractBase contract =
        rows.stream()
            .findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "contract not found"));
    if (!"ARCHIVED".equalsIgnoreCase(contract.archiveStatus())) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "contract must be archived before project register");
    }
    return contract;
  }

  private void validateYearAllowed(List<Integer> years, int year) {
    if (!years.contains(year)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "contract year is not selectable");
    }
  }

  private void ensureUniqueActive(long contractId, int contractYear, Long excludeId) {
    String sql =
        """
        SELECT COUNT(1)
        FROM project_register
        WHERE contract_id = ? AND contract_year = ? AND deleted_flag = 0
        """
            + (excludeId == null ? "" : " AND id <> ?");
    Integer count =
        excludeId == null
            ? jdbcTemplate.queryForObject(sql, Integer.class, contractId, contractYear)
            : jdbcTemplate.queryForObject(sql, Integer.class, contractId, contractYear, excludeId);
    if (count != null && count > 0) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "same contract-year project register already exists");
    }
  }

  private void validateSystemItems(List<ProjectSystemItemRequest> items) {
    if (items == null || items.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "project system item is required");
    }
    for (ProjectSystemItemRequest item : items) {
      validateOptionalFiles(
          item.getHasFilingCertificate(), item.getFilingCertificateFiles(), "filing certificate");
      validateOptionalFiles(item.getHasFilingForm(), item.getFilingFormFiles(), "filing form");
      validateOptionalFiles(
          item.getHasClassificationReport(),
          item.getClassificationReportFiles(),
          "classification report");
      validateFileLimit(item.getFilingCertificateFiles());
      validateFileLimit(item.getFilingFormFiles());
      validateFileLimit(item.getClassificationReportFiles());
    }
  }

  private void validateOptionalFiles(Boolean has, List<String> files, String fieldName) {
    if (Boolean.TRUE.equals(has) && (files == null || files.isEmpty())) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, fieldName + " file is required when flag is true");
    }
  }

  private void validateFileLimit(List<String> files) {
    if (files != null && files.size() > 5) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "single attachment field supports up to 5 files");
    }
  }

  private void ensureOwner(ProjectRegisterRecord record, String operator) {
    if (!operator.equals(record.getCreatedBy())) {
      throw new ResponseStatusException(
          HttpStatus.FORBIDDEN, "only creator can edit project register");
    }
  }

  private void ensureEditable(String status) {
    if (!"DRAFT".equalsIgnoreCase(status) && !"REJECTED".equalsIgnoreCase(status)) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "only draft or rejected project register can be edited");
    }
  }

  private void ensureSubmittable(String status) {
    if (!"DRAFT".equalsIgnoreCase(status) && !"REJECTED".equalsIgnoreCase(status)) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "only draft or rejected project register can be submitted");
    }
  }

  private void ensureSubmitted(String status) {
    if (!"SUBMITTED".equalsIgnoreCase(status)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "only submitted project can be reviewed");
    }
  }

  private ProcessLaunch startReviewProcess(long projectId, ProjectRegisterRecord project, String operator) {
    String businessKey = buildBusinessKey(projectId);
    runtimeService
        .createProcessInstanceQuery()
        .processDefinitionKey(PROJECT_REVIEW_WORKFLOW_KEY)
        .processInstanceBusinessKey(businessKey)
        .active()
        .list()
        .forEach(instance -> runtimeService.deleteProcessInstance(instance.getId(), "resubmit_restart"));

    Map<String, Object> variables = new LinkedHashMap<>();
    variables.put("bizType", BIZ_TYPE);
    variables.put("bizId", projectId);
    variables.put("projectRegisterId", projectId);
    variables.put("submittedBy", operator);
    variables.put("applicationName", project.getApplicationName());
    variables.put("approved", false);

    ProcessInstance processInstance =
        runtimeService.startProcessInstanceByKey(PROJECT_REVIEW_WORKFLOW_KEY, businessKey, variables);
    Task reviewTask =
        taskService
            .createTaskQuery()
            .processInstanceId(processInstance.getProcessInstanceId())
            .active()
            .orderByTaskCreateTime()
            .asc()
            .listPage(0, 1)
            .stream()
            .findFirst()
            .orElse(null);
    String currentNode = reviewTask == null ? REVIEW_NODE_KEY : reviewTask.getTaskDefinitionKey();
    return new ProcessLaunch(processInstance.getProcessInstanceId(), currentNode);
  }

  private long upsertWorkflowInstance(
      long projectId, String operator, String currentNode, String processInstanceId) {
    List<Long> instanceIds =
        jdbcTemplate.query(
            """
            SELECT id
            FROM workflow_instance
            WHERE biz_type = ? AND biz_id = ?
            """,
            (rs, rowNum) -> rs.getLong("id"),
            BIZ_TYPE,
            projectId);
    if (instanceIds.isEmpty()) {
      jdbcTemplate.update(
          """
          INSERT INTO workflow_instance (
            biz_type, biz_id, workflow_key, current_node, status, started_by, process_instance_id, finished_at
          ) VALUES (?, ?, ?, ?, 'PENDING', ?, ?, NULL)
          """,
          BIZ_TYPE,
          projectId,
          PROJECT_REVIEW_WORKFLOW_KEY,
          currentNode,
          operator,
          processInstanceId);
      Long insertedId = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
      if (insertedId == null || insertedId <= 0) {
        throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "workflow instance create failed");
      }
      return insertedId;
    }

    long instanceId = instanceIds.get(0);
    jdbcTemplate.update(
        """
        UPDATE workflow_instance
        SET workflow_key = ?, current_node = ?, status = 'PENDING', started_by = ?, process_instance_id = ?, finished_at = NULL
        WHERE id = ?
        """,
        PROJECT_REVIEW_WORKFLOW_KEY,
        currentNode,
        operator,
        processInstanceId,
        instanceId);
    return instanceId;
  }

  private long markWorkflowFinished(long projectId, String workflowStatus, String node, String operator) {
    List<Long> instanceIds =
        jdbcTemplate.query(
            """
            SELECT id
            FROM workflow_instance
            WHERE biz_type = ? AND biz_id = ?
            """,
            (rs, rowNum) -> rs.getLong("id"),
            BIZ_TYPE,
            projectId);
    if (instanceIds.isEmpty()) {
      jdbcTemplate.update(
          """
          INSERT INTO workflow_instance (
            biz_type, biz_id, workflow_key, current_node, status, started_by, process_instance_id, finished_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
          """,
          BIZ_TYPE,
          projectId,
          PROJECT_REVIEW_WORKFLOW_KEY,
          node,
          workflowStatus,
          operator,
          null);
      Long insertedId = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
      if (insertedId == null || insertedId <= 0) {
        throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "workflow instance create failed");
      }
      return insertedId;
    }

    long instanceId = instanceIds.get(0);
    jdbcTemplate.update(
        """
        UPDATE workflow_instance
        SET status = ?, current_node = ?, finished_at = NOW()
        WHERE id = ?
        """,
        workflowStatus,
        node,
        instanceId);
    return instanceId;
  }

  private void insertWorkflowAction(
      long instanceId,
      long projectId,
      String action,
      String fromStatus,
      String toStatus,
      String operator,
      String remark) {
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
        remark);
  }

  private void ensureExists(long id) {
    Integer count =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(1) FROM project_register WHERE id = ? AND deleted_flag = 0", Integer.class, id);
    if (count == null || count == 0) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "project register not found");
    }
  }

  private void ensureAssessmentMembersAssigned(long projectId) {
    Integer count =
        jdbcTemplate.queryForObject(
            """
            SELECT COUNT(1)
            FROM project_assessment_member
            WHERE project_register_id = ?
            """,
            Integer.class,
            projectId);
    if (count == null || count <= 0) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "\u9879\u76ee\u767b\u8bb0\u5ba1\u6838\u901a\u8fc7\u524d\u5fc5\u987b\u5206\u914d\u6d4b\u8bc4\u4eba\u5458");
    }
  }


  private void replaceSystemItems(long projectId, List<ProjectSystemItemRequest> systemItems) {
    jdbcTemplate.update(
        "UPDATE project_system_item SET deleted_flag = 1 WHERE project_register_id = ?", projectId);
    for (ProjectSystemItemRequest item : systemItems) {
      jdbcTemplate.update(
          """
          INSERT INTO project_system_item (
            project_register_id, system_name, filing_agency, security_level, is_reassessment,
            required_entry_date, required_report_delivery_date, assessed_unit_name, assessed_unit_industry,
            assessed_unit_contact, assessed_unit_mobile, assessed_unit_address, has_filing_certificate,
            filing_certificate_files_json, filing_certificate_no, filing_certificate_issued_at, has_filing_form,
            filing_form_files_json, has_classification_report, classification_report_files_json, deleted_flag
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
          """,
          projectId,
          item.getSystemName(),
          item.getFilingAgency(),
          item.getSecurityLevel(),
          Boolean.TRUE.equals(item.getReassessment()) ? 1 : 0,
          item.getRequiredEntryDate(),
          item.getRequiredReportDeliveryDate(),
          item.getAssessedUnitName(),
          item.getAssessedUnitIndustry(),
          item.getAssessedUnitContact(),
          item.getAssessedUnitMobile(),
          item.getAssessedUnitAddress(),
          Boolean.TRUE.equals(item.getHasFilingCertificate()) ? 1 : 0,
          jsonSupport.toJson(item.getFilingCertificateFiles()),
          item.getFilingCertificateNo(),
          item.getFilingCertificateIssuedAt(),
          Boolean.TRUE.equals(item.getHasFilingForm()) ? 1 : 0,
          jsonSupport.toJson(item.getFilingFormFiles()),
          Boolean.TRUE.equals(item.getHasClassificationReport()) ? 1 : 0,
          jsonSupport.toJson(item.getClassificationReportFiles()));
    }
  }
  private void loadSystemItems(List<ProjectRegisterRecord> projects) {
    if (projects == null || projects.isEmpty()) {
      return;
    }
    Map<Long, ProjectRegisterRecord> map = new LinkedHashMap<>();
    for (ProjectRegisterRecord item : projects) {
      map.put(item.getId(), item);
      item.setSystemItems(new ArrayList<>());
    }
    String inSql =
        projects.stream().map(item -> String.valueOf(item.getId())).reduce((a, b) -> a + "," + b).orElse("0");
    jdbcTemplate.query(
        """
        SELECT project_register_id, system_name, filing_agency, security_level, is_reassessment,
               required_entry_date, required_report_delivery_date, assessed_unit_name, assessed_unit_industry,
               assessed_unit_contact, assessed_unit_mobile, assessed_unit_address, has_filing_certificate,
               filing_certificate_files_json, filing_certificate_no, filing_certificate_issued_at, has_filing_form,
               filing_form_files_json, has_classification_report, classification_report_files_json
        FROM project_system_item
        WHERE deleted_flag = 0 AND project_register_id IN (%s)
        ORDER BY id ASC
        """
            .formatted(inSql),
        rs -> {
          ProjectRegisterRecord record = map.get(rs.getLong("project_register_id"));
          if (record == null) {
            return;
          }
          ProjectSystemItemRequest item = new ProjectSystemItemRequest();
          item.setSystemName(rs.getString("system_name"));
          item.setFilingAgency(rs.getString("filing_agency"));
          item.setSecurityLevel(rs.getString("security_level"));
          item.setReassessment(rs.getBoolean("is_reassessment"));
          item.setRequiredEntryDate(dateString(rs.getDate("required_entry_date")));
          item.setRequiredReportDeliveryDate(dateString(rs.getDate("required_report_delivery_date")));
          item.setAssessedUnitName(rs.getString("assessed_unit_name"));
          item.setAssessedUnitIndustry(rs.getString("assessed_unit_industry"));
          item.setAssessedUnitContact(rs.getString("assessed_unit_contact"));
          item.setAssessedUnitMobile(rs.getString("assessed_unit_mobile"));
          item.setAssessedUnitAddress(rs.getString("assessed_unit_address"));
          item.setHasFilingCertificate(rs.getBoolean("has_filing_certificate"));
          item.setFilingCertificateFiles(jsonSupport.fromJsonList(rs.getString("filing_certificate_files_json")));
          item.setFilingCertificateNo(rs.getString("filing_certificate_no"));
          item.setFilingCertificateIssuedAt(dateString(rs.getDate("filing_certificate_issued_at")));
          item.setHasFilingForm(rs.getBoolean("has_filing_form"));
          item.setFilingFormFiles(jsonSupport.fromJsonList(rs.getString("filing_form_files_json")));
          item.setHasClassificationReport(rs.getBoolean("has_classification_report"));
          item.setClassificationReportFiles(
              jsonSupport.fromJsonList(rs.getString("classification_report_files_json")));
          record.getSystemItems().add(item);
        });
  }
  private void loadAssessmentMembers(List<ProjectRegisterRecord> projects) {
    if (projects == null || projects.isEmpty()) {
      return;
    }
    Map<Long, ProjectRegisterRecord> map = new LinkedHashMap<>();
    for (ProjectRegisterRecord item : projects) {
      map.put(item.getId(), item);
      item.setAssessmentMembers(new ArrayList<>());
    }
    String inSql =
        projects.stream().map(item -> String.valueOf(item.getId())).reduce((a, b) -> a + "," + b).orElse("0");
    jdbcTemplate.query(
        """
        SELECT project_register_id, username
        FROM project_assessment_member
        WHERE project_register_id IN (%s)
        ORDER BY project_register_id ASC, sort_order ASC, id ASC
        """
            .formatted(inSql),
        rs -> {
          ProjectRegisterRecord record = map.get(rs.getLong("project_register_id"));
          if (record != null) {
            record.getAssessmentMembers().add(rs.getString("username"));
          }
        });
  }

  private String dateString(java.sql.Date date) {
    return date == null ? null : date.toString();
  }

  private String buildBusinessKey(long projectId) {
    return BIZ_TYPE + ":" + projectId;
  }

  private static class ProjectRowMapper implements RowMapper<ProjectRegisterRecord> {
    @Override
    public ProjectRegisterRecord mapRow(ResultSet rs, int rowNum) throws SQLException {
      ProjectRegisterRecord record = new ProjectRegisterRecord();
      record.setId(rs.getLong("id"));
      record.setContractId(rs.getLong("contract_id"));
      record.setContractYear(rs.getInt("contract_year"));
      record.setApplicationName(rs.getString("application_name"));
      record.setStatus(rs.getString("status"));
      Long workflowInstanceId = rs.getLong("workflow_instance_id");
      if (rs.wasNull()) {
        workflowInstanceId = null;
      }
      record.setWorkflowInstanceId(workflowInstanceId);
      record.setWorkflowStatus(rs.getString("workflow_status"));
      record.setWorkflowNode(rs.getString("workflow_node"));
      record.setProcessInstanceId(rs.getString("process_instance_id"));
      record.setCreatedBy(rs.getString("created_by"));
      record.setCreatedAt(String.valueOf(rs.getTimestamp("created_at")));
      record.setContractName(rs.getString("contract_name"));
      return record;
    }
  }

  private static class WorkflowTraceRowMapper implements RowMapper<WorkflowTraceRecord> {
    @Override
    public WorkflowTraceRecord mapRow(ResultSet rs, int rowNum) throws SQLException {
      WorkflowTraceRecord record = new WorkflowTraceRecord();
      record.setId(rs.getLong("id"));
      record.setInstanceId(rs.getLong("instance_id"));
      record.setAction(rs.getString("action"));
      record.setFromStatus(rs.getString("from_status"));
      record.setToStatus(rs.getString("to_status"));
      record.setWorkflowStatus(rs.getString("workflow_status"));
      record.setWorkflowNode(rs.getString("workflow_node"));
      record.setOperator(rs.getString("operator"));
      record.setRemark(rs.getString("remark"));
      record.setCreatedAt(String.valueOf(rs.getTimestamp("created_at")));
      return record;
    }
  }

  private record ContractBase(long id, String contractName, String archiveStatus, List<Integer> serviceYears) {}

  private record ProcessLaunch(String processInstanceId, String currentNode) {}
}
