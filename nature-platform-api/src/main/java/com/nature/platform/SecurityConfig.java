/**
 * @input HttpSecurity DSL, JwtAuthenticationFilter, Spring Security session/policy APIs
 * @output SecurityFilterChain bean defining public/protected routes and JSON auth error responses
 * @position Central security policy layer for stateless JWT auth, access rules, and 401/403 shaping
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
public class SecurityConfig {
  private final JwtAuthenticationFilter jwtAuthenticationFilter;
  private final ObjectMapper objectMapper;

  public SecurityConfig(
      JwtAuthenticationFilter jwtAuthenticationFilter, ObjectMapper objectMapper) {
    this.jwtAuthenticationFilter = jwtAuthenticationFilter;
    this.objectMapper = objectMapper;
  }

  @Bean
  SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    http.csrf(AbstractHttpConfigurer::disable)
        .cors(Customizer.withDefaults())
        .sessionManagement(
            session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(
            auth ->
                auth.requestMatchers(
                        "/actuator/health",
                        "/api/v1/auth/login",
                        "/api/v1/auth/dingtalk/url",
                        "/api/v1/auth/dingtalk/callback")
                    .permitAll()
                    .anyRequest()
                    .authenticated())
        .exceptionHandling(
            exception ->
                exception
                    .authenticationEntryPoint(
                        (request, response, authException) ->
                            writeErrorResponse(
                                response,
                                HttpStatus.UNAUTHORIZED,
                                ErrorCode.AUTH_UNAUTHORIZED,
                                "未登录或登录已过期，请重新登录"))
                    .accessDeniedHandler(
                        (request, response, accessDeniedException) ->
                            writeErrorResponse(
                                response,
                                HttpStatus.FORBIDDEN,
                                ErrorCode.AUTH_FORBIDDEN,
                                "当前账号无权限执行该操作")))
        .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
    return http.build();
  }

  private void writeErrorResponse(
      HttpServletResponse response, HttpStatus status, ErrorCode errorCode, String message)
      throws IOException {
    response.setStatus(status.value());
    response.setCharacterEncoding(StandardCharsets.UTF_8.name());
    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
    objectMapper.writeValue(response.getWriter(), ApiResponse.failure(errorCode, message));
  }
}
