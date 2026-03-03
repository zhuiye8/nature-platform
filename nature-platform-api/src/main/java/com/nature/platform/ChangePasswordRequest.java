/**
 * @input Jakarta validation annotations for authenticated password-update payload validation
 * @output ChangePasswordRequest DTO consumed by /api/v1/auth/change-password
 * @position Authentication write contract for first-login forced password reset and self-service password updates
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class ChangePasswordRequest {
  @NotBlank
  @Size(min = 6, max = 64)
  private String newPassword;

  public String getNewPassword() {
    return newPassword;
  }

  public void setNewPassword(String newPassword) {
    this.newPassword = newPassword;
  }
}
