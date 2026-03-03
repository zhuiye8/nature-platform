/**
 * @input DingTalk app credentials, RestClient HTTP calls, JdbcTemplate IAM persistence, and admin audit logger
 * @output Organization synchronization workflow that upserts DingTalk departments/users into IAM tables
 * @position Integration application service bridging DingTalk org APIs with local department/user master data
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AdminDingTalkSyncService {
  private static final String OAPI_BASE_URL = "https://oapi.dingtalk.com";
  private static final String API_GETTOKEN = "/gettoken";
  private static final String API_DEPARTMENT_LIST = "/department/list";
  private static final String API_USER_SIMPLELIST = "/user/simplelist";
  private static final String API_USER_GET = "/user/get";

  private final DingTalkProperties dingTalkProperties;
  private final RestClient oapiClient;
  private final JdbcTemplate jdbcTemplate;
  private final AdminAuditService adminAuditService;

  public AdminDingTalkSyncService(
      DingTalkProperties dingTalkProperties,
      RestClient.Builder restClientBuilder,
      JdbcTemplate jdbcTemplate,
      AdminAuditService adminAuditService) {
    this.dingTalkProperties = dingTalkProperties;
    this.oapiClient = restClientBuilder.baseUrl(OAPI_BASE_URL).build();
    this.jdbcTemplate = jdbcTemplate;
    this.adminAuditService = adminAuditService;
  }

  @Transactional
  public AdminDingTalkSyncResult syncAll(String operator) {
    ensureConfigReady();
    String token = fetchAppAccessToken();
    List<DingDepartment> departments = fetchDepartments(token);
    DepartmentSyncStat departmentSyncStat = upsertDepartments(departments);
    UserSyncStat userSyncStat = syncUsers(token, departments);

    AdminDingTalkSyncResult result =
        new AdminDingTalkSyncResult(
            departmentSyncStat.total(),
            departmentSyncStat.inserted(),
            departmentSyncStat.updated(),
            userSyncStat.total(),
            userSyncStat.inserted(),
            userSyncStat.updated(),
            userSyncStat.disabled());

    adminAuditService.logAction(
        operator,
        "ADMIN_DINGTALK_SYNC",
        "DINGTALK",
        "ORG",
        Map.of(
            "departmentTotal", result.departmentTotal(),
            "departmentInserted", result.departmentInserted(),
            "departmentUpdated", result.departmentUpdated(),
            "userTotal", result.userTotal(),
            "userInserted", result.userInserted(),
            "userUpdated", result.userUpdated(),
            "userDisabled", result.userDisabled()));
    return result;
  }

  private void ensureConfigReady() {
    if (!StringUtils.hasText(dingTalkProperties.getAppKey())
        || !StringUtils.hasText(dingTalkProperties.getAppSecret())) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "钉钉同步前置配置缺失：请配置 app.dingtalk.app-key 与 app.dingtalk.app-secret");
    }
  }

  private String fetchAppAccessToken() {
    Map<String, Object> response;
    try {
      response =
          oapiClient
              .get()
              .uri(
                  uriBuilder ->
                      uriBuilder
                          .path(API_GETTOKEN)
                          .queryParam("appkey", dingTalkProperties.getAppKey())
                          .queryParam("appsecret", dingTalkProperties.getAppSecret())
                          .build())
              .retrieve()
              .body(new ParameterizedTypeReference<Map<String, Object>>() {});
    } catch (Exception ex) {
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "调用钉钉获取访问令牌失败");
    }
    String token = readString(response, "access_token");
    if (!StringUtils.hasText(token)) {
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "钉钉访问令牌响应无效");
    }
    return token;
  }

  private List<DingDepartment> fetchDepartments(String token) {
    Map<String, Object> response;
    try {
      response =
          oapiClient
              .get()
              .uri(
                  uriBuilder ->
                      uriBuilder
                          .path(API_DEPARTMENT_LIST)
                          .queryParam("access_token", token)
                          .build())
              .retrieve()
              .body(new ParameterizedTypeReference<Map<String, Object>>() {});
    } catch (Exception ex) {
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "调用钉钉部门列表失败");
    }

    List<Map<String, Object>> rows = readList(response, "department");
    if (rows.isEmpty()) {
      return List.of();
    }
    List<DingDepartment> departments = new ArrayList<>();
    for (Map<String, Object> row : rows) {
      String dingDeptId = readString(row, "id");
      String deptName = readString(row, "name");
      String parentDingDeptId = readString(row, "parentid", "parentId");
      if (!StringUtils.hasText(dingDeptId) || !StringUtils.hasText(deptName)) {
        continue;
      }
      departments.add(new DingDepartment(dingDeptId, deptName.trim(), parentDingDeptId));
    }
    return departments;
  }

  private DepartmentSyncStat upsertDepartments(List<DingDepartment> departments) {
    if (departments.isEmpty()) {
      return new DepartmentSyncStat(0, 0, 0);
    }
    int inserted = 0;
    int updated = 0;

    for (int i = 0; i < departments.size(); i++) {
      DingDepartment department = departments.get(i);
      List<Long> existingIds =
          jdbcTemplate.query(
              "SELECT id FROM iam_department WHERE ding_dept_id = ? LIMIT 1",
              (rs, rowNum) -> rs.getLong("id"),
              department.dingDeptId());
      if (existingIds.isEmpty()) {
        jdbcTemplate.update(
            """
            INSERT INTO iam_department
              (dept_code, dept_name, parent_id, source_type, ding_dept_id, enabled, sort_order)
            VALUES
              (?, ?, NULL, ?, ?, 1, ?)
            """,
            buildDingDeptCode(department.dingDeptId()),
            department.deptName(),
            AdminDepartmentService.SOURCE_DINGTALK,
            department.dingDeptId(),
            i * 10);
        inserted++;
      } else {
        jdbcTemplate.update(
            """
            UPDATE iam_department
            SET dept_name = ?, source_type = ?, sort_order = ?
            WHERE id = ?
            """,
            department.deptName(),
            AdminDepartmentService.SOURCE_DINGTALK,
            i * 10,
            existingIds.get(0));
        updated++;
      }
    }

    Map<String, Long> localIdByDingId = loadDepartmentIdByDingId();
    for (DingDepartment department : departments) {
      Long selfId = localIdByDingId.get(department.dingDeptId());
      if (selfId == null) {
        continue;
      }
      Long parentId =
          StringUtils.hasText(department.parentDingDeptId())
              ? localIdByDingId.get(department.parentDingDeptId())
              : null;
      jdbcTemplate.update(
          "UPDATE iam_department SET parent_id = ? WHERE id = ?",
          parentId,
          selfId);
    }

    return new DepartmentSyncStat(departments.size(), inserted, updated);
  }

  private UserSyncStat syncUsers(String token, List<DingDepartment> departments) {
    if (departments.isEmpty()) {
      return new UserSyncStat(0, 0, 0, 0);
    }

    Set<String> syncedDingUserIds = new LinkedHashSet<>();
    int inserted = 0;
    int updated = 0;

    Map<String, Long> localDeptIdByDingId = loadDepartmentIdByDingId();
    for (DingDepartment department : departments) {
      int offset = 0;
      int size = 100;
      boolean hasMore = true;
      while (hasMore) {
        Map<String, Object> response =
            fetchSimpleUserPage(token, department.dingDeptId(), offset, size);
        List<Map<String, Object>> userList = readList(response, "userlist");
        for (Map<String, Object> user : userList) {
          String dingUserId = readString(user, "userid", "userId");
          if (!StringUtils.hasText(dingUserId) || syncedDingUserIds.contains(dingUserId)) {
            continue;
          }
          Map<String, Object> detail = fetchUserDetail(token, dingUserId);
          UserUpsertStat stat = upsertDingUser(detail, localDeptIdByDingId);
          inserted += stat.inserted();
          updated += stat.updated();
          syncedDingUserIds.add(dingUserId);
        }
        hasMore = readBoolean(response, "hasMore", "has_more");
        offset += size;
      }
    }

    int disabled = disableStaleDingUsers(syncedDingUserIds);
    return new UserSyncStat(syncedDingUserIds.size(), inserted, updated, disabled);
  }

  private Map<String, Object> fetchSimpleUserPage(
      String token, String dingDeptId, int offset, int size) {
    try {
      return oapiClient
          .get()
          .uri(
              uriBuilder ->
                  uriBuilder
                      .path(API_USER_SIMPLELIST)
                      .queryParam("access_token", token)
                      .queryParam("department_id", dingDeptId)
                      .queryParam("offset", offset)
                      .queryParam("size", size)
                      .build())
          .retrieve()
          .body(new ParameterizedTypeReference<Map<String, Object>>() {});
    } catch (Exception ex) {
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "调用钉钉用户列表失败");
    }
  }

  private Map<String, Object> fetchUserDetail(String token, String dingUserId) {
    try {
      Map<String, Object> detail =
          oapiClient
              .get()
              .uri(
                  uriBuilder ->
                      uriBuilder
                          .path(API_USER_GET)
                          .queryParam("access_token", token)
                          .queryParam("userid", dingUserId)
                          .build())
              .retrieve()
              .body(new ParameterizedTypeReference<Map<String, Object>>() {});
      return detail == null ? Map.of("userid", dingUserId) : detail;
    } catch (Exception ex) {
      return Map.of("userid", dingUserId);
    }
  }

  private UserUpsertStat upsertDingUser(Map<String, Object> detail, Map<String, Long> localDeptIdByDingId) {
    String dingUserId = readString(detail, "userid", "userId");
    if (!StringUtils.hasText(dingUserId)) {
      return new UserUpsertStat(0, 0);
    }

    String displayName = readString(detail, "name", "nick");
    if (!StringUtils.hasText(displayName)) {
      displayName = dingUserId;
    }
    String unionId = readString(detail, "unionid", "unionId");
    String jobNumber = readString(detail, "jobnumber", "jobNumber");
    String mobile = readString(detail, "mobile");
    boolean enabled = !"false".equalsIgnoreCase(String.valueOf(detail.getOrDefault("active", "true")));

    Long deptId = resolveLocalDeptId(detail, localDeptIdByDingId);
    List<Long> existingRows =
        jdbcTemplate.query(
            "SELECT id FROM user_account WHERE ding_user_id = ? LIMIT 1",
            (rs, rowNum) -> rs.getLong("id"),
            dingUserId);

    if (existingRows.isEmpty()) {
      String username = resolveAvailableUsername(dingUserId, jobNumber, mobile);
      jdbcTemplate.update(
          """
          INSERT INTO user_account
            (username, password_hash, display_name, enabled, source_type, dept_id, ding_user_id, ding_union_id, ding_job_number, last_sync_at, must_change_password)
          VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 1)
          """,
          username,
          "dingtalk-login-only",
          displayName,
          enabled ? 1 : 0,
          AdminDepartmentService.SOURCE_DINGTALK,
          deptId,
          dingUserId,
          emptyToNull(unionId),
          emptyToNull(jobNumber));
      jdbcTemplate.update(
          "INSERT IGNORE INTO user_role (username, role_code, sort_order) VALUES (?, ?, 0)",
          username,
          UserAccountService.ROLE_USER);
      return new UserUpsertStat(1, 0);
    }

    long id = existingRows.get(0);
    jdbcTemplate.update(
        """
        UPDATE user_account
        SET display_name = ?,
            enabled = ?,
            source_type = ?,
            dept_id = ?,
            ding_union_id = ?,
            ding_job_number = ?,
            last_sync_at = NOW()
        WHERE id = ?
        """,
        displayName,
        enabled ? 1 : 0,
        AdminDepartmentService.SOURCE_DINGTALK,
        deptId,
        emptyToNull(unionId),
        emptyToNull(jobNumber),
        id);
    String username =
        jdbcTemplate
            .query(
                "SELECT username FROM user_account WHERE id = ?",
                (rs, rowNum) -> rs.getString("username"),
                id)
            .stream()
            .findFirst()
            .orElse("");
    if (StringUtils.hasText(username)) {
      jdbcTemplate.update(
          "INSERT IGNORE INTO user_role (username, role_code, sort_order) VALUES (?, ?, 0)",
          username,
          UserAccountService.ROLE_USER);
    }
    return new UserUpsertStat(0, 1);
  }

  private Long resolveLocalDeptId(Map<String, Object> detail, Map<String, Long> localDeptIdByDingId) {
    List<String> deptIds = readStringList(detail.get("department"));
    if (deptIds.isEmpty()) {
      String single = readString(detail, "departmentId", "department_id", "dept_id");
      if (StringUtils.hasText(single)) {
        deptIds = List.of(single);
      }
    }
    for (String dingDeptId : deptIds) {
      Long localId = localDeptIdByDingId.get(dingDeptId);
      if (localId != null) {
        return localId;
      }
    }
    return null;
  }

  private String resolveAvailableUsername(String dingUserId, String jobNumber, String mobile) {
    List<String> candidates = new ArrayList<>();
    if (StringUtils.hasText(jobNumber)) {
      candidates.add(normalizeUsername(jobNumber));
    }
    if (StringUtils.hasText(mobile)) {
      candidates.add(normalizeUsername(mobile));
    }
    candidates.add(normalizeUsername("dd_" + dingUserId));

    for (String candidate : candidates) {
      if (!StringUtils.hasText(candidate)) {
        continue;
      }
      if (!usernameExists(candidate)) {
        return candidate;
      }
      for (int i = 1; i < 200; i++) {
        String withSeq = trimUsername(candidate + "_" + i);
        if (!usernameExists(withSeq)) {
          return withSeq;
        }
      }
    }
    throw new ResponseStatusException(HttpStatus.CONFLICT, "无法为钉钉用户生成可用用户名");
  }

  private boolean usernameExists(String username) {
    Integer count =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(1) FROM user_account WHERE username = ?",
            Integer.class,
            username);
    return count != null && count > 0;
  }

  private int disableStaleDingUsers(Set<String> syncedDingUserIds) {
    if (syncedDingUserIds.isEmpty()) {
      return 0;
    }
    String placeholders = String.join(",", java.util.Collections.nCopies(syncedDingUserIds.size(), "?"));
    String sql =
        """
        UPDATE user_account
        SET enabled = 0
        WHERE source_type = ?
          AND (ding_user_id IS NULL OR ding_user_id NOT IN (%s))
        """
            .formatted(placeholders);
    List<Object> params = new ArrayList<>();
    params.add(AdminDepartmentService.SOURCE_DINGTALK);
    params.addAll(syncedDingUserIds);
    return jdbcTemplate.update(sql, params.toArray());
  }

  private Map<String, Long> loadDepartmentIdByDingId() {
    Map<String, Long> map = new LinkedHashMap<>();
    jdbcTemplate
        .query(
            "SELECT id, ding_dept_id FROM iam_department WHERE ding_dept_id IS NOT NULL",
            (rs, rowNum) -> Map.entry(rs.getString("ding_dept_id"), rs.getLong("id")))
        .forEach(entry -> map.put(entry.getKey(), entry.getValue()));
    return map;
  }

  private String buildDingDeptCode(String dingDeptId) {
    return "DD_" + dingDeptId;
  }

  private String normalizeUsername(String raw) {
    if (!StringUtils.hasText(raw)) {
      return "";
    }
    String normalized = raw.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9._-]", "_");
    if (normalized.length() < 3) {
      normalized = (normalized + "___").substring(0, 3);
    }
    return trimUsername(normalized);
  }

  private String trimUsername(String username) {
    if (username.length() <= 64) {
      return username;
    }
    return username.substring(0, 64);
  }

  private String emptyToNull(String value) {
    if (!StringUtils.hasText(value)) {
      return null;
    }
    return value.trim();
  }

  @SuppressWarnings("unchecked")
  private List<Map<String, Object>> readList(Map<String, Object> source, String key) {
    if (source == null) {
      return List.of();
    }
    Object value = source.get(key);
    if (!(value instanceof List<?> list)) {
      return List.of();
    }
    List<Map<String, Object>> result = new ArrayList<>();
    for (Object item : list) {
      if (item instanceof Map<?, ?> map) {
        result.add(castMap(map));
      }
    }
    return result;
  }

  private String readString(Map<String, Object> source, String... keys) {
    if (source == null || keys == null) {
      return null;
    }
    for (String key : keys) {
      Object value = source.get(key);
      if (value != null) {
        String text = String.valueOf(value).trim();
        if (!text.isEmpty()) {
          return text;
        }
      }
    }
    return null;
  }

  private boolean readBoolean(Map<String, Object> source, String... keys) {
    String value = readString(source, keys);
    return StringUtils.hasText(value) && Boolean.parseBoolean(value);
  }

  private List<String> readStringList(Object value) {
    if (!(value instanceof List<?> list)) {
      return List.of();
    }
    List<String> result = new ArrayList<>();
    for (Object item : list) {
      if (item == null) {
        continue;
      }
      String text = String.valueOf(item).trim();
      if (!text.isEmpty()) {
        result.add(text);
      }
    }
    return result;
  }

  private Map<String, Object> castMap(Map<?, ?> map) {
    Map<String, Object> result = new HashMap<>();
    map.forEach(
        (key, value) -> {
          if (key != null) {
            result.put(String.valueOf(key), value);
          }
        });
    return result;
  }

  private record DingDepartment(String dingDeptId, String deptName, String parentDingDeptId) {}

  private record DepartmentSyncStat(int total, int inserted, int updated) {}

  private record UserSyncStat(int total, int inserted, int updated, int disabled) {}

  private record UserUpsertStat(int inserted, int updated) {}
}
