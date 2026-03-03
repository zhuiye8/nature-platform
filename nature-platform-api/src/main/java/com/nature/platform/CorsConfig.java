/**
 * @input CorsConfiguration APIs from Spring Web; app.cors settings resolved from properties
 * @output CorsConfigurationSource bean used by Spring Security for preflight and CORS control
 * @position HTTP cross-origin policy layer for web frontend integration in dev/prod
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Stream;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class CorsConfig {
  @Value("${app.cors.allowed-origins:}")
  private String allowedOrigins;

  @Value(
      "${app.cors.allowed-origin-patterns:https://frp-bus.com:[*],https://frp-way.com:[*],http://localhost:[*],http://127.0.0.1:[*]}")
  private String allowedOriginPatterns;

  @Bean
  CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration configuration = new CorsConfiguration();
    List<String> origins =
        parseCsv(allowedOrigins);
    List<String> originPatterns =
        Stream.concat(
                parseCsv(allowedOriginPatterns).stream(),
                origins.stream())
            .distinct()
            .collect(Collectors.toList());
    configuration.setAllowedOriginPatterns(originPatterns);
    configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
    configuration.setAllowedHeaders(List.of("*"));
    configuration.setAllowCredentials(true);
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", configuration);
    return source;
  }

  private List<String> parseCsv(String raw) {
    if (raw == null) {
      return List.of();
    }
    return Arrays.stream(raw.split(","))
        .map(String::trim)
        .filter(item -> !item.isEmpty())
        .collect(Collectors.toList());
  }
}
