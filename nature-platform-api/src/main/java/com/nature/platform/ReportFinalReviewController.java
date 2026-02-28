/**
 * @input ReportFinalReviewService operations, AdminAccessService permission checks, and authenticated operator context
 * @output /api/v1/report-final-reviews endpoints for node-15 reviewer save/list APIs with action-level authorization
 * @position HTTP adapter for report final-review stage operations with RBAC guards
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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/report-final-reviews")
public class ReportFinalReviewController {
  private final ReportFinalReviewService reportFinalReviewService;
  private final AdminAccessService adminAccessService;

  public ReportFinalReviewController(
      ReportFinalReviewService reportFinalReviewService, AdminAccessService adminAccessService) {
    this.reportFinalReviewService = reportFinalReviewService;
    this.adminAccessService = adminAccessService;
  }

  @GetMapping
  public ApiResponse<List<ReportFinalReviewRecord>> list(Authentication authentication) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.REPORT_FINAL_REVIEW_VIEW);
    return ApiResponse.success(reportFinalReviewService.list());
  }

  @GetMapping("/{projectId}")
  public ResponseEntity<ApiResponse<ReportFinalReviewRecord>> detail(
      Authentication authentication, @PathVariable long projectId) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.REPORT_FINAL_REVIEW_VIEW);
    return reportFinalReviewService
        .detail(projectId)
        .map(item -> ResponseEntity.ok(ApiResponse.success(item)))
        .orElseGet(
            () ->
                ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.failure(ErrorCode.NOT_FOUND, "report final review not found")));
  }

  @GetMapping("/candidates")
  public ApiResponse<List<String>> candidates(Authentication authentication) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.REPORT_FINAL_REVIEW_CANDIDATE_VIEW);
    return ApiResponse.success(reportFinalReviewService.listCandidates());
  }

  @PutMapping("/{projectId}")
  public ApiResponse<ReportFinalReviewRecord> save(
      Authentication authentication,
      @PathVariable long projectId,
      @Valid @RequestBody ReportFinalReviewRequest request) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.REPORT_FINAL_REVIEW_SAVE);
    return ApiResponse.success(
        reportFinalReviewService.save(projectId, request, CurrentUser.username(authentication)));
  }
}
