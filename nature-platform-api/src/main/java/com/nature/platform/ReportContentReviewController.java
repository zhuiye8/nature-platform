/**
 * @input ReportContentReviewService operations, AdminAccessService permission checks, and authenticated operator context
 * @output /api/v1/report-content-reviews endpoints for node-12 list/detail operations with action-level authorization
 * @position HTTP adapter for report content-review (technical/management/network) stage orchestration with RBAC guards
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/report-content-reviews")
public class ReportContentReviewController {
  private final ReportContentReviewService reportContentReviewService;
  private final AdminAccessService adminAccessService;

  public ReportContentReviewController(
      ReportContentReviewService reportContentReviewService, AdminAccessService adminAccessService) {
    this.reportContentReviewService = reportContentReviewService;
    this.adminAccessService = adminAccessService;
  }

  @GetMapping
  public ApiResponse<List<ReportContentReviewRecord>> list(Authentication authentication) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.REPORT_CONTENT_REVIEW_VIEW);
    return ApiResponse.success(reportContentReviewService.list());
  }

  @GetMapping("/{projectId}")
  public ResponseEntity<ApiResponse<ReportContentReviewRecord>> detail(
      Authentication authentication, @PathVariable long projectId) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.REPORT_CONTENT_REVIEW_VIEW);
    return reportContentReviewService
        .detail(projectId)
        .map(item -> ResponseEntity.ok(ApiResponse.success(item)))
        .orElseGet(
            () ->
                ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.failure(ErrorCode.NOT_FOUND, "report content review not found")));
  }

}
