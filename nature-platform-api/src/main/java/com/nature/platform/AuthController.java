/**
 * @input AuthService, DingTalkProperties, login/password DTOs, and Spring MVC auth context
 * @output /api/v1/auth endpoints for account login, DingTalk authorize+callback+login, password update, and current user profile
 * @position HTTP adapter layer for unified authentication flows and frontend session bootstrap contracts
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
  private final AuthService authService;
  private final DingTalkProperties dingTalkProperties;

  public AuthController(AuthService authService, DingTalkProperties dingTalkProperties) {
    this.authService = authService;
    this.dingTalkProperties = dingTalkProperties;
  }

  @PostMapping("/login")
  public ResponseEntity<ApiResponse<LoginResponse>> login(@Valid @RequestBody LoginRequest request) {
    try {
      return ResponseEntity.ok(ApiResponse.success(authService.login(request)));
    } catch (IllegalArgumentException ex) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(ApiResponse.failure(ErrorCode.AUTH_INVALID_CREDENTIALS, ex.getMessage()));
    }
  }

  @PostMapping("/dingtalk/login")
  public ApiResponse<LoginResponse> dingTalkLogin(@Valid @RequestBody DingTalkLoginRequest request) {
    return ApiResponse.success(authService.loginByDingTalk(request.getAuthCode()));
  }

  @GetMapping("/dingtalk/authorize-url")
  public ApiResponse<Map<String, String>> dingTalkAuthorizeUrl(
      @RequestParam(required = false) String redirect, HttpServletRequest request) {
    if (!StringUtils.hasText(dingTalkProperties.getAppKey())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "钉钉登录未配置 app-key");
    }

    String frontendRedirect = resolveFrontendRedirect(redirect);
    String callbackBase = resolveCallbackBase(request);
    String state = UUID.randomUUID().toString().replace("-", "");
    String callbackUrl =
        callbackBase
            + "/api/v1/auth/dingtalk/callback?redirect="
            + URLEncoder.encode(frontendRedirect, StandardCharsets.UTF_8);

    String authorizeUrl =
        "https://login.dingtalk.com/oauth2/auth?redirect_uri="
            + URLEncoder.encode(callbackUrl, StandardCharsets.UTF_8)
            + "&response_type=code&client_id="
            + dingTalkProperties.getAppKey()
            + "&scope=openid&prompt=consent&state="
            + state;

    return ApiResponse.success(Map.of("url", authorizeUrl, "state", state));
  }

  @GetMapping("/dingtalk/url")
  public ApiResponse<Map<String, String>> dingTalkLoginUrl(HttpServletRequest request) {
    return dingTalkAuthorizeUrl(null, request);
  }

  @GetMapping("/dingtalk/callback")
  public void dingTalkCallback(
      @RequestParam(value = "authCode", required = false) String authCode,
      @RequestParam(value = "code", required = false) String code,
      @RequestParam(value = "state", required = false) String state,
      @RequestParam(value = "error", required = false) String error,
      @RequestParam(value = "redirect", required = false) String redirect,
      HttpServletResponse response)
      throws IOException {
    String frontendRedirect = resolveFrontendRedirect(redirect);
    UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(frontendRedirect);

    String finalAuthCode = StringUtils.hasText(authCode) ? authCode : code;
    if (StringUtils.hasText(finalAuthCode)) {
      builder.queryParam("authCode", finalAuthCode);
    }
    if (StringUtils.hasText(state)) {
      builder.queryParam("state", state);
    }
    if (StringUtils.hasText(error)) {
      builder.queryParam("error", error);
    }
    response.sendRedirect(builder.build(true).toUriString());
  }

  @PostMapping("/change-password")
  public ApiResponse<Map<String, Object>> changePassword(
      Authentication authentication, @Valid @RequestBody ChangePasswordRequest request) {
    if (authentication == null || !authentication.isAuthenticated()) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录或登录已过期");
    }
    String username = authentication.getName();
    authService.changePassword(username, request.getNewPassword());
    return ApiResponse.success(authService.currentUserProfile(username));
  }

  @GetMapping("/me")
  public ResponseEntity<ApiResponse<Map<String, Object>>> me(Authentication authentication) {
    if (authentication == null || !authentication.isAuthenticated()) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(ApiResponse.failure(ErrorCode.AUTH_UNAUTHORIZED, "unauthorized"));
    }

    Map<String, Object> data = new LinkedHashMap<>(authService.currentUserProfile(authentication.getName()));
    return ResponseEntity.ok(ApiResponse.success(data));
  }

  private String resolveFrontendRedirect(String redirect) {
    String configured = normalizeFrontendRedirect(dingTalkProperties.getFrontendRedirectUri());
    if (!StringUtils.hasText(configured)) {
      configured = "http://localhost:5173/login";
    }
    if (!StringUtils.hasText(redirect)) {
      return configured;
    }

    String candidate = normalizeFrontendRedirect(redirect);
    if (!StringUtils.hasText(candidate)) {
      return configured;
    }

    Set<String> allowedOrigins = buildAllowedFrontendOrigins(configured);
    String candidateOrigin = safeOrigin(candidate);
    if (!StringUtils.hasText(candidateOrigin) || !containsIgnoreCase(allowedOrigins, candidateOrigin)) {
      return configured;
    }
    return candidate;
  }

  private Set<String> buildAllowedFrontendOrigins(String configuredRedirect) {
    Set<String> origins = new LinkedHashSet<>();
    String configuredOrigin = safeOrigin(configuredRedirect);
    if (StringUtils.hasText(configuredOrigin)) {
      origins.add(configuredOrigin);
    }

    String extraOrigins = dingTalkProperties.getFrontendRedirectOrigins();
    if (!StringUtils.hasText(extraOrigins)) {
      return origins;
    }

    for (String item : extraOrigins.split(",")) {
      if (!StringUtils.hasText(item)) {
        continue;
      }
      String candidate = item.trim();
      String normalized = normalizeOrigin(candidate);
      if (StringUtils.hasText(normalized)) {
        origins.add(normalized);
        continue;
      }

      // 兼容传入完整 URL（例如 http://host:5173/login）
      String asRedirect = normalizeFrontendRedirect(candidate);
      String asRedirectOrigin = safeOrigin(asRedirect);
      if (StringUtils.hasText(asRedirectOrigin)) {
        origins.add(asRedirectOrigin);
      }
    }
    return origins;
  }

  private String normalizeOrigin(String raw) {
    if (!StringUtils.hasText(raw)) {
      return "";
    }
    try {
      URI uri = new URI(raw.trim());
      if (!StringUtils.hasText(uri.getScheme()) || !StringUtils.hasText(uri.getHost())) {
        return "";
      }
      int port = uri.getPort();
      if (port > 0) {
        return uri.getScheme() + "://" + uri.getHost() + ":" + port;
      }
      return uri.getScheme() + "://" + uri.getHost();
    } catch (URISyntaxException ex) {
      return "";
    }
  }

  private boolean containsIgnoreCase(Set<String> set, String target) {
    for (String item : set) {
      if (item.equalsIgnoreCase(target)) {
        return true;
      }
    }
    return false;
  }

  private String normalizeFrontendRedirect(String raw) {
    if (!StringUtils.hasText(raw)) {
      return "";
    }
    String value = raw.trim();
    try {
      URI uri = new URI(value);
      if (!StringUtils.hasText(uri.getScheme()) || !StringUtils.hasText(uri.getHost())) {
        return "";
      }
      return uri.toString();
    } catch (URISyntaxException ex) {
      return "";
    }
  }

  private String safeOrigin(String raw) {
    try {
      URI uri = new URI(raw);
      if (!StringUtils.hasText(uri.getScheme()) || !StringUtils.hasText(uri.getHost())) {
        return "";
      }
      int port = uri.getPort();
      if (port > 0) {
        return uri.getScheme() + "://" + uri.getHost() + ":" + port;
      }
      return uri.getScheme() + "://" + uri.getHost();
    } catch (URISyntaxException ex) {
      return "";
    }
  }

  private String resolveCallbackBase(HttpServletRequest request) {
    if (StringUtils.hasText(dingTalkProperties.getCallbackBase())) {
      return dingTalkProperties.getCallbackBase().trim();
    }
    String proto = request.getHeader("X-Forwarded-Proto");
    String host = request.getHeader("X-Forwarded-Host");
    if (!StringUtils.hasText(proto)) {
      proto = request.getScheme();
    }
    if (!StringUtils.hasText(host)) {
      host = request.getHeader("Host");
    }
    return proto + "://" + host;
  }
}

