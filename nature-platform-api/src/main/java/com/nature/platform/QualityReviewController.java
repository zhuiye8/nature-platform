/**
 * @input QualityReviewService operations, AdminAccessService permission checks, assignment/request DTOs, and auth principal context
 * @output /api/v1/quality-reviews endpoints for assignment, submit, detail/list, and candidate lookup with action-level authorization
 * @position HTTP adapter for node-9/10 quality review apply and reviewer assignment workflows with RBAC guards
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
@RequestMapping("/api/v1/quality-reviews")
public class QualityReviewController {
  private final QualityReviewService qualityReviewService;
  private final AdminAccessService adminAccessService;

  public QualityReviewController(
      QualityReviewService qualityReviewService, AdminAccessService adminAccessService) {
    this.qualityReviewService = qualityReviewService;
    this.adminAccessService = adminAccessService;
  }

  @GetMapping
  public ApiResponse<List<QualityReviewRecord>> list(Authentication authentication) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.QUALITY_REVIEW_VIEW);
    return ApiResponse.success(qualityReviewService.list());
  }

  @GetMapping("/{projectId}")
  public ResponseEntity<ApiResponse<QualityReviewRecord>> detail(
      Authentication authentication, @PathVariable long projectId) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.QUALITY_REVIEW_VIEW);
    return qualityReviewService
        .detail(projectId)
        .map(item -> ResponseEntity.ok(ApiResponse.success(item)))
        .orElseGet(
            () ->
                ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.failure(ErrorCode.NOT_FOUND, "quality review record not found")));
  }

  @GetMapping("/candidates")
  public ApiResponse<List<String>> candidates(Authentication authentication) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.QUALITY_REVIEW_CANDIDATE_VIEW);
    return ApiResponse.success(qualityReviewService.listCandidates());
  }

  @PutMapping("/{projectId}/assignment")
  public ApiResponse<QualityReviewRecord> saveAssignment(
      Authentication authentication,
      @PathVariable long projectId,
      @Valid @RequestBody QualityReviewAssignmentRequest request) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.QUALITY_REVIEW_ASSIGN);
    return ApiResponse.success(
        qualityReviewService.saveAssignment(projectId, request, CurrentUser.username(authentication)));
  }

  @PostMapping("/{projectId}/submit")
  public ApiResponse<QualityReviewRecord> submit(Authentication authentication, @PathVariable long projectId) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.QUALITY_REVIEW_SUBMIT);
    return ApiResponse.success(qualityReviewService.submit(projectId, CurrentUser.username(authentication)));
  }
}
