/**
 * @input JwtTokenService and UserAccountService for credential verification, role lookup, and token issue
 * @output login() and currentUserProfile() methods for local account authentication and role-aware profile data
 * @position Authentication application service layer bridging account/role persistence to JWT session flow
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

  public AuthService(JwtTokenService jwtTokenService, UserAccountService userAccountService) {
    this.jwtTokenService = jwtTokenService;
    this.userAccountService = userAccountService;
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
    return Map.of(
        "username", username,
        "displayName", userAccount.displayName(),
        "roles", roles,
        "timezone", "Asia/Shanghai");
  }
}
