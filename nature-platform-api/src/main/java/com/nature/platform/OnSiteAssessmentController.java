/**
 * @input OnSiteAssessmentService operations, AdminAccessService guards, and authentication principal for operator attribution
 * @output /api/v1/on-site-assessments endpoints for node-8 list/detail/save/submit workflows
 * @position HTTP adapter for on-site assessment stage with ZIP submit gate enforcement and action-level authorization
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/on-site-assessments")
public class OnSiteAssessmentController {
  private final OnSiteAssessmentService onSiteAssessmentService;
  private final AdminAccessService adminAccessService;

  public OnSiteAssessmentController(
      OnSiteAssessmentService onSiteAssessmentService, AdminAccessService adminAccessService) {
    this.onSiteAssessmentService = onSiteAssessmentService;
    this.adminAccessService = adminAccessService;
  }

  @GetMapping
  public ApiResponse<List<OnSiteAssessmentRecord>> list(Authentication authentication) {
    String operator = CurrentUser.username(authentication);
    requireOnSiteResultResource(operator);
    return ApiResponse.success(onSiteAssessmentService.listResults(operator));
  }

  @GetMapping("/executions")
  public ApiResponse<List<OnSiteAssessmentRecord>> listExecutions(Authentication authentication) {
    String operator = CurrentUser.username(authentication);
    requireOnSiteExecutionResource(operator);
    return ApiResponse.success(onSiteAssessmentService.listExecutions(operator));
  }

  @GetMapping("/results")
  public ApiResponse<List<OnSiteAssessmentRecord>> listResults(Authentication authentication) {
    String operator = CurrentUser.username(authentication);
    requireOnSiteResultResource(operator);
    return ApiResponse.success(onSiteAssessmentService.listResults(operator));
  }

  @GetMapping("/{projectId}")
  public ResponseEntity<ApiResponse<OnSiteAssessmentRecord>> detail(
      Authentication authentication, @PathVariable long projectId) {
    String operator = CurrentUser.username(authentication);
    requireOnSiteAnyResource(operator);
    return onSiteAssessmentService
        .detailVisible(projectId, operator)
        .map(item -> ResponseEntity.ok(ApiResponse.success(item)))
        .orElseGet(
            () ->
                ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.failure(ErrorCode.NOT_FOUND, "on-site assessment not found")));
  }

  @PutMapping("/{projectId}")
  public ApiResponse<OnSiteAssessmentRecord> save(
      Authentication authentication,
      @PathVariable long projectId,
      @Valid @RequestBody OnSiteAssessmentRequest request) {
    requireOnSiteAnyResource(CurrentUser.username(authentication));
    return ApiResponse.success(
        onSiteAssessmentService.save(projectId, request, CurrentUser.username(authentication)));
  }

  @PostMapping("/{projectId}/submit")
  public ApiResponse<OnSiteAssessmentRecord> submit(Authentication authentication, @PathVariable long projectId) {
    requireOnSiteAnyResource(CurrentUser.username(authentication));
    return ApiResponse.success(onSiteAssessmentService.submit(projectId, CurrentUser.username(authentication)));
  }

  private void requireOnSiteExecutionResource(String operator) {
    if (adminAccessService.hasResource(operator, ResourceKeys.PAGE_ON_SITE_ASSESSMENT_EXECUTIONS)
        || adminAccessService.hasResource(operator, ResourceKeys.PAGE_ON_SITE_ASSESSMENTS)) {
      return;
    }
    throw new org.springframework.web.server.ResponseStatusException(
        org.springframework.http.HttpStatus.FORBIDDEN,
        "current user has no permission: on-site-assessment:execution");
  }

  private void requireOnSiteResultResource(String operator) {
    if (adminAccessService.hasResource(operator, ResourceKeys.PAGE_ON_SITE_ASSESSMENT_RESULTS)
        || adminAccessService.hasResource(operator, ResourceKeys.PAGE_ON_SITE_ASSESSMENTS)) {
      return;
    }
    throw new org.springframework.web.server.ResponseStatusException(
        org.springframework.http.HttpStatus.FORBIDDEN,
        "current user has no permission: on-site-assessment:result");
  }

  private void requireOnSiteAnyResource(String operator) {
    if (adminAccessService.hasResource(operator, ResourceKeys.PAGE_ON_SITE_ASSESSMENT_EXECUTIONS)
        || adminAccessService.hasResource(operator, ResourceKeys.PAGE_ON_SITE_ASSESSMENT_RESULTS)
        || adminAccessService.hasResource(operator, ResourceKeys.PAGE_ON_SITE_ASSESSMENTS)) {
      return;
    }
    throw new org.springframework.web.server.ResponseStatusException(
        org.springframework.http.HttpStatus.FORBIDDEN,
        "current user has no permission: on-site-assessment");
  }
}
