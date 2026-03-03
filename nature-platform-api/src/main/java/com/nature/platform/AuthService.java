/**
 * @input JwtTokenService, UserAccountService, AdminAccessService, and AdminResourceService for IAM-aware profile aggregation
 * @output login() and currentUserProfile() methods for local authentication and role/resource/menu bootstrap payloads
 * @position Authentication application service layer bridging account/role persistence to token session and frontend RBAC context
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
  private final JwtTokenService jwtTokenService;
  private final UserAccountService userAccountService;
  private final AdminAccessService adminAccessService;
  private final AdminResourceService adminResourceService;
  private final DingTalkAuthService dingTalkAuthService;

  public AuthService(
      JwtTokenService jwtTokenService,
      UserAccountService userAccountService,
      AdminAccessService adminAccessService,
      AdminResourceService adminResourceService,
      DingTalkAuthService dingTalkAuthService) {
    this.jwtTokenService = jwtTokenService;
    this.userAccountService = userAccountService;
    this.adminAccessService = adminAccessService;
    this.adminResourceService = adminResourceService;
    this.dingTalkAuthService = dingTalkAuthService;
  }

  public LoginResponse login(LoginRequest request) {
    UserAccountService.UserAccount userAccount =
        userAccountService
            .findByUsername(request.getUsername())
            .orElseThrow(() -> new IllegalArgumentException("invalid username or password"));
    if (!userAccount.enabled() || !userAccount.passwordHash().equals(request.getPassword())) {
      throw new IllegalArgumentException("invalid username or password");
    }

    List<String> scopes = userAccountService.listRoles(userAccount.username());
    String token = jwtTokenService.generateToken(request.getUsername(), scopes);
    return new LoginResponse(token, request.getUsername(), userAccount.mustChangePassword());
  }

  public LoginResponse loginByDingTalk(String authCode) {
    return dingTalkAuthService.loginByAuthCode(authCode);
  }

  public void changePassword(String username, String newPassword) {
    userAccountService.updatePassword(username, newPassword);
  }

  public Map<String, Object> currentUserProfile(String username) {
    UserAccountService.UserAccount userAccount =
        userAccountService
            .findByUsername(username)
            .orElse(
                new UserAccountService.UserAccount(
                    0L, username, "", username, true, null, false, "LOCAL", null, null));
    List<String> roles = userAccountService.listRoles(username);
    List<String> resources = adminAccessService.listResources(username);
    List<AdminResourceRecord> menuTree = adminResourceService.listResourceTreeForUser(username);
    return Map.of(
        "username", username,
        "displayName", userAccount.displayName(),
        "mustChangePassword", userAccount.mustChangePassword(),
        "roles", roles,
        "permissions", resources,
        "resources", resources,
        "menuTree", menuTree,
        "timezone", "Asia/Shanghai");
  }
}
