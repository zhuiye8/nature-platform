/**
 * @input SecurityProperties and JwtTokenService from main code; JUnit assertions
 * @output jwtRoundTrip() unit test validating token issue/parse baseline behavior
 * @position Core security unit test layer that avoids full Spring context startup
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import org.junit.jupiter.api.Test;

class NaturePlatformApplicationTests {

  @Test
  void jwtRoundTrip() {
    SecurityProperties properties = new SecurityProperties();
    properties.setJwtSecret("test-secret-with-at-least-32-bytes-1234");
    properties.setTokenExpireMinutes(30);

    JwtTokenService tokenService = new JwtTokenService(properties);
    String token = tokenService.generateToken("demo", List.of("ROLE_USER"));
    String username = tokenService.parseUsername(token);
    List<String> scopes = tokenService.parseScopes(token);

    assertEquals("demo", username);
    assertEquals(List.of("ROLE_USER"), scopes);
  }
}
