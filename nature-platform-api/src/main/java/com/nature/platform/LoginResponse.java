/**
 * @input AuthService login result assembly
 * @output LoginResponse DTO with token and user metadata for frontend session bootstrap
 * @position Authentication output contract consumed by login page and auth store
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

public class LoginResponse {
  private String token;
  private String username;
  private boolean mustChangePassword;

  public LoginResponse(String token, String username, boolean mustChangePassword) {
    this.token = token;
    this.username = username;
    this.mustChangePassword = mustChangePassword;
  }

  public String getToken() {
    return token;
  }

  public void setToken(String token) {
    this.token = token;
  }

  public String getUsername() {
    return username;
  }

  public void setUsername(String username) {
    this.username = username;
  }

  public boolean isMustChangePassword() {
    return mustChangePassword;
  }

  public void setMustChangePassword(boolean mustChangePassword) {
    this.mustChangePassword = mustChangePassword;
  }
}

