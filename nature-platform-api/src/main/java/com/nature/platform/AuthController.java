/**
 * @input AuthService, DingTalkProperties, LoginRequest; Spring MVC and validation framework
 * @output /api/v1/auth endpoints for login, DingTalk login URL, and current user role/permission profile
 * @position HTTP adapter layer for authentication use cases and session bootstrap data
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import jakarta.validation.Valid;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;

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

  @GetMapping("/dingtalk/url")
  public ApiResponse<Map<String, String>> dingTalkLoginUrl() {
    String redirect = URLEncoder.encode(dingTalkProperties.getRedirectUri(), StandardCharsets.UTF_8);
    String url =
        "https://login.dingtalk.com/oauth2/auth?"
            + "redirect_uri="
            + redirect
            + "&response_type=code&client_id="
            + dingTalkProperties.getAppKey()
            + "&scope=openid";
    return ApiResponse.success(Map.of("url", url));
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

  @GetMapping("/dingtalk/callback")
  public ApiResponse<Map<String, String>> dingTalkCallback(
      @RequestParam(required = false) String code) {
    return ApiResponse.success(
        Map.of(
            "code", code == null ? "" : code,
            "message", "callback received; exchange-to-user flow will be implemented in V1"));
  }
}
