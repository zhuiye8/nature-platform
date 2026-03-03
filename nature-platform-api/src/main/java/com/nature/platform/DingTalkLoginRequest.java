/**
 * @input Jakarta validation annotations for OAuth authCode payload validation
 * @output DingTalkLoginRequest DTO consumed by /api/v1/auth/dingtalk/login
 * @position Authentication input contract for DingTalk OAuth code exchange login
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import jakarta.validation.constraints.NotBlank;

public class DingTalkLoginRequest {
  @NotBlank
  private String authCode;

  public String getAuthCode() {
    return authCode;
  }

  public void setAuthCode(String authCode) {
    this.authCode = authCode;
  }
}
