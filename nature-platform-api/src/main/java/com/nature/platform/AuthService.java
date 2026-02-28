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

  public AuthService(
      JwtTokenService jwtTokenService,
      UserAccountService userAccountService,
      AdminAccessService adminAccessService,
      AdminResourceService adminResourceService) {
    this.jwtTokenService = jwtTokenService;
    this.userAccountService = userAccountService;
    this.adminAccessService = adminAccessService;
    this.adminResourceService = adminResourceService;
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
    boolean mustChangePassword = false;
    return new LoginResponse(token, request.getUsername(), mustChangePassword);
  }

  public Map<String, Object> currentUserProfile(String username) {
    UserAccountService.UserAccount userAccount =
        userAccountService
            .findByUsername(username)
            .orElse(new UserAccountService.UserAccount(0L, username, "", username, true));
    List<String> roles = userAccountService.listRoles(username);
    List<String> resources = adminAccessService.listResources(username);
    List<AdminResourceRecord> menuTree = adminResourceService.listResourceTreeForUser(username);
    return Map.of(
        "username", username,
        "displayName", userAccount.displayName(),
        "roles", roles,
        "permissions", resources,
        "resources", resources,
        "menuTree", menuTree,
        "timezone", "Asia/Shanghai");
  }
}
