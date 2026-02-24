/**
 * @input OnSiteAssessmentService operations and authentication principal for operator attribution
 * @output /api/v1/on-site-assessments endpoints for node-8 list/detail/save/submit and reviewer-candidate workflows
 * @position HTTP adapter for on-site assessment stage with ZIP submit gate enforcement
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

  public OnSiteAssessmentController(OnSiteAssessmentService onSiteAssessmentService) {
    this.onSiteAssessmentService = onSiteAssessmentService;
  }

  @GetMapping
  public ApiResponse<List<OnSiteAssessmentRecord>> list() {
    return ApiResponse.success(onSiteAssessmentService.list());
  }

  @GetMapping("/{projectId}")
  public ResponseEntity<ApiResponse<OnSiteAssessmentRecord>> detail(@PathVariable long projectId) {
    return onSiteAssessmentService
        .detail(projectId)
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
    return ApiResponse.success(
        onSiteAssessmentService.save(projectId, request, CurrentUser.username(authentication)));
  }

  @GetMapping("/candidates")
  public ApiResponse<List<String>> candidates() {
    return ApiResponse.success(onSiteAssessmentService.listReviewAssignmentCandidates());
  }

  @GetMapping("/reviewer-candidates")
  public ApiResponse<OnSiteAssessmentService.ReviewerCandidates> reviewerCandidates() {
    return ApiResponse.success(onSiteAssessmentService.listReviewAssignmentCandidatesByRole());
  }

  @PutMapping("/{projectId}/review-assignment")
  public ApiResponse<OnSiteAssessmentRecord> saveReviewAssignment(
      Authentication authentication,
      @PathVariable long projectId,
      @Valid @RequestBody QualityReviewAssignmentRequest request) {
    return ApiResponse.success(
        onSiteAssessmentService.saveReviewAssignment(
            projectId, request, CurrentUser.username(authentication)));
  }

  @PostMapping("/{projectId}/submit")
  public ApiResponse<OnSiteAssessmentRecord> submit(Authentication authentication, @PathVariable long projectId) {
    return ApiResponse.success(onSiteAssessmentService.submit(projectId, CurrentUser.username(authentication)));
  }
}
