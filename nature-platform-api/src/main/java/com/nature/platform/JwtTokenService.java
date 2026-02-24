/**
 * @input SecurityProperties from local config; JJWT API for signing/parsing tokens
 * @output generateToken(), parseUsername(), parseScopes() methods for JWT issue and verification
 * @position Security utility layer providing stateless token primitives for auth flows
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Objects;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Component;

@Component
public class JwtTokenService {
  private final SecurityProperties securityProperties;

  public JwtTokenService(SecurityProperties securityProperties) {
    this.securityProperties = securityProperties;
  }

  public String generateToken(String username, List<String> scopes) {
    Instant now = Instant.now();
    Instant expiresAt = now.plusSeconds(securityProperties.getTokenExpireMinutes() * 60);

    return Jwts.builder()
        .subject(username)
        .claim("scope", scopes)
        .issuedAt(Date.from(now))
        .expiration(Date.from(expiresAt))
        .signWith(secretKey())
        .compact();
  }

  public String parseUsername(String token) {
    return parseClaims(token).getSubject();
  }

  public List<String> parseScopes(String token) {
    Object raw = parseClaims(token).get("scope");
    if (raw instanceof List<?> list) {
      return list.stream()
          .filter(Objects::nonNull)
          .map(String::valueOf)
          .map(String::trim)
          .filter(value -> !value.isEmpty())
          .toList();
    }
    return List.of();
  }

  private Claims parseClaims(String token) {
    return Jwts.parser().verifyWith(secretKey()).build().parseSignedClaims(token).getPayload();
  }

  private SecretKey secretKey() {
    byte[] raw = securityProperties.getJwtSecret().getBytes(StandardCharsets.UTF_8);
    return Keys.hmacShaKeyFor(raw);
  }
}
