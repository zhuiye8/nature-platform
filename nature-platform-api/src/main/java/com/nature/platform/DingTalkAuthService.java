/**
 * @input DingTalk properties, RestClient HTTP adapters, UserAccountService identity upsert, and JwtTokenService
 * @output DingTalk OAuth code login flow that exchanges authCode, resolves profile, auto-provisions local account, and returns LoginResponse
 * @position Authentication integration service bridging DingTalk identity APIs into local session token issuance
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DingTalkAuthService {
  private static final String API_BASE = "https://api.dingtalk.com";
  private static final String OAPI_BASE = "https://oapi.dingtalk.com";
  private static final String USER_ACCESS_TOKEN_PATH = "/v1.0/oauth2/userAccessToken";
  private static final String USER_ME_PATH = "/v1.0/contact/users/me";
  private static final String OAPI_GETTOKEN_PATH = "/gettoken";
  private static final String OAPI_USER_GET_PATH = "/user/get";

  private final DingTalkProperties dingTalkProperties;
  private final RestClient apiClient;
  private final RestClient oapiClient;
  private final UserAccountService userAccountService;
  private final JwtTokenService jwtTokenService;

  public DingTalkAuthService(
      DingTalkProperties dingTalkProperties,
      RestClient.Builder restClientBuilder,
      UserAccountService userAccountService,
      JwtTokenService jwtTokenService) {
    this.dingTalkProperties = dingTalkProperties;
    this.apiClient = restClientBuilder.baseUrl(API_BASE).build();
    this.oapiClient = restClientBuilder.baseUrl(OAPI_BASE).build();
    this.userAccountService = userAccountService;
    this.jwtTokenService = jwtTokenService;
  }

  public LoginResponse loginByAuthCode(String authCode) {
    ensureConfigured();
    if (!StringUtils.hasText(authCode)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "authCode 不能为空");
    }

    UserAccountService.DingTalkIdentity identity = resolveIdentity(authCode.trim());
    UserAccountService.UserAccount account = userAccountService.upsertByDingTalk(identity);
    List<String> roles = userAccountService.listRoles(account.username());
    String token = jwtTokenService.generateToken(account.username(), roles);
    return new LoginResponse(token, account.username(), account.mustChangePassword());
  }

  private UserAccountService.DingTalkIdentity resolveIdentity(String authCode) {
    String userAccessToken = exchangeUserAccessToken(authCode);
    Map<String, Object> profile = fetchUserProfile(userAccessToken);

    String dingUserId = readString(profile, "orgUserId", "userid", "userId");
    String dingUnionId = readString(profile, "unionId", "unionid");
    String displayName = readString(profile, "nick", "name");

    if (!StringUtils.hasText(dingUserId) && !StringUtils.hasText(dingUnionId)) {
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "钉钉用户信息缺失 userId/unionId");
    }

    Long deptId = fetchDepartmentIdBestEffort(dingUserId);
    return new UserAccountService.DingTalkIdentity(dingUserId, dingUnionId, displayName, deptId);
  }

  private void ensureConfigured() {
    if (!StringUtils.hasText(dingTalkProperties.getAppKey())
        || !StringUtils.hasText(dingTalkProperties.getAppSecret())) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "钉钉登录未配置：请设置 app.dingtalk.app-key 和 app.dingtalk.app-secret");
    }
  }

  private String exchangeUserAccessToken(String authCode) {
    Map<String, Object> response;
    try {
      response =
          apiClient
              .post()
              .uri(USER_ACCESS_TOKEN_PATH)
              .body(
                  Map.of(
                      "clientId", dingTalkProperties.getAppKey(),
                      "clientSecret", dingTalkProperties.getAppSecret(),
                      "code", authCode,
                      "grantType", "authorization_code"))
              .retrieve()
              .body(new ParameterizedTypeReference<Map<String, Object>>() {});
    } catch (Exception ex) {
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "调用钉钉换取 userAccessToken 失败");
    }

    String token = readString(response, "accessToken", "access_token");
    if (!StringUtils.hasText(token)) {
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "钉钉 userAccessToken 响应无效");
    }
    return token;
  }

  private Map<String, Object> fetchUserProfile(String userAccessToken) {
    try {
      Map<String, Object> response =
          apiClient
              .get()
              .uri(USER_ME_PATH)
              .header("x-acs-dingtalk-access-token", userAccessToken)
              .retrieve()
              .body(new ParameterizedTypeReference<Map<String, Object>>() {});
      return response == null ? Map.of() : response;
    } catch (Exception ex) {
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "调用钉钉获取用户信息失败");
    }
  }

  private Long fetchDepartmentIdBestEffort(String dingUserId) {
    if (!StringUtils.hasText(dingUserId)) {
      return null;
    }
    try {
      String appAccessToken = fetchAppAccessToken();
      if (!StringUtils.hasText(appAccessToken)) {
        return null;
      }
      Map<String, Object> userDetail =
          oapiClient
              .get()
              .uri(
                  uriBuilder ->
                      uriBuilder
                          .path(OAPI_USER_GET_PATH)
                          .queryParam("access_token", appAccessToken)
                          .queryParam("userid", dingUserId)
                          .build())
              .retrieve()
              .body(new ParameterizedTypeReference<Map<String, Object>>() {});
      if (userDetail == null) {
        return null;
      }
      for (String deptToken : readDepartmentTokens(userDetail)) {
        try {
          return Long.parseLong(deptToken);
        } catch (NumberFormatException ignored) {
          // continue
        }
      }
      return null;
    } catch (Exception ex) {
      return null;
    }
  }

  private String fetchAppAccessToken() {
    Map<String, Object> response =
        oapiClient
            .get()
            .uri(
                uriBuilder ->
                    uriBuilder
                        .path(OAPI_GETTOKEN_PATH)
                        .queryParam("appkey", dingTalkProperties.getAppKey())
                        .queryParam("appsecret", dingTalkProperties.getAppSecret())
                        .build())
            .retrieve()
            .body(new ParameterizedTypeReference<Map<String, Object>>() {});
    if (response == null) {
      return null;
    }
    return readString(response, "access_token", "accessToken");
  }

  private List<String> readDepartmentTokens(Map<String, Object> source) {
    List<String> result = new ArrayList<>();
    Object department = source == null ? null : source.get("department");
    if (department instanceof List<?> list) {
      for (Object item : list) {
        if (item == null) {
          continue;
        }
        String text = String.valueOf(item).trim();
        if (!text.isEmpty()) {
          result.add(text);
        }
      }
    }
    Object deptIdList = source == null ? null : source.get("dept_id_list");
    if (deptIdList instanceof List<?> list) {
      for (Object item : list) {
        if (item == null) {
          continue;
        }
        String text = String.valueOf(item).trim();
        if (!text.isEmpty()) {
          result.add(text);
        }
      }
    }
    String single = readString(source, "departmentId", "department_id", "dept_id");
    if (StringUtils.hasText(single)) {
      result.add(single);
    }
    return result;
  }

  private String readString(Map<String, Object> source, String... keys) {
    if (source == null || keys == null) {
      return null;
    }
    for (String key : keys) {
      Object value = source.get(key);
      if (value == null) {
        continue;
      }
      String text = String.valueOf(value).trim();
      if (!text.isEmpty()) {
        return text;
      }
    }
    return null;
  }
}
