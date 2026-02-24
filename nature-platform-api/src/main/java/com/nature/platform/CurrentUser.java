/**
 * @input Authentication principal from Spring Security context
 * @output username() helper used by controllers/services for operator attribution
 * @position Security utility layer to normalize current-operator resolution
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import org.springframework.security.core.Authentication;

public final class CurrentUser {
  private CurrentUser() {}

  public static String username(Authentication authentication) {
    if (authentication == null || !authentication.isAuthenticated()) {
      return "anonymous";
    }
    return authentication.getName();
  }
}

