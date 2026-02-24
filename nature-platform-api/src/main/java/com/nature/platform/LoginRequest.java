/**
 * @input Jakarta validation annotations from jakarta.validation.constraints
 * @output LoginRequest DTO consumed by /api/v1/auth/login
 * @position Authentication input contract for username-password login
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import jakarta.validation.constraints.NotBlank;

public class LoginRequest {
  @NotBlank private String username;
  @NotBlank private String password;

  public String getUsername() {
    return username;
  }

  public void setUsername(String username) {
    this.username = username;
  }

  public String getPassword() {
    return password;
  }

  public void setPassword(String password) {
    this.password = password;
  }
}

