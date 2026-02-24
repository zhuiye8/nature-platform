/**
 * @input ConfigurationProperties from Spring Boot; app.security namespace from application.yml
 * @output SecurityProperties bean exposing JWT secret and expiration settings
 * @position Configuration binding layer for authentication and token lifecycle control
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.security")
public class SecurityProperties {
  private String jwtSecret =
      "replace-with-at-least-32-bytes-secret-in-production-please";
  private long tokenExpireMinutes = 120;

  public String getJwtSecret() {
    return jwtSecret;
  }

  public void setJwtSecret(String jwtSecret) {
    this.jwtSecret = jwtSecret;
  }

  public long getTokenExpireMinutes() {
    return tokenExpireMinutes;
  }

  public void setTokenExpireMinutes(long tokenExpireMinutes) {
    this.tokenExpireMinutes = tokenExpireMinutes;
  }
}

