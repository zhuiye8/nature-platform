/**
 * @input ReportTechReviewService operations, AdminAccessService permission checks, and authenticated operator context
 * @output /api/v1/report-tech-reviews endpoints for node-11 list/detail/candidate/save APIs with action-level authorization
 * @position HTTP adapter for report overall technical-review stage operations with RBAC guards
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
@RequestMapping("/api/v1/report-tech-reviews")
public class ReportTechReviewController {
  private final ReportTechReviewService reportTechReviewService;
  private final AdminAccessService adminAccessService;

  public ReportTechReviewController(
      ReportTechReviewService reportTechReviewService, AdminAccessService adminAccessService) {
    this.reportTechReviewService = reportTechReviewService;
    this.adminAccessService = adminAccessService;
  }

  @GetMapping
  public ApiResponse<List<ReportTechReviewRecord>> list(Authentication authentication) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.REPORT_TECH_REVIEW_VIEW);
    return ApiResponse.success(reportTechReviewService.list());
  }

  @GetMapping("/{projectId}")
  public ResponseEntity<ApiResponse<ReportTechReviewRecord>> detail(
      Authentication authentication, @PathVariable long projectId) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.REPORT_TECH_REVIEW_VIEW);
    return reportTechReviewService
        .detail(projectId)
        .map(item -> ResponseEntity.ok(ApiResponse.success(item)))
        .orElseGet(
            () ->
                ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.failure(ErrorCode.NOT_FOUND, "report tech review not found")));
  }

  @GetMapping("/candidates")
  public ApiResponse<List<String>> candidates(Authentication authentication) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.REPORT_TECH_REVIEW_CANDIDATE_VIEW);
    return ApiResponse.success(reportTechReviewService.listCandidates());
  }

  @PutMapping("/{projectId}")
  public ApiResponse<ReportTechReviewRecord> save(
      Authentication authentication,
      @PathVariable long projectId,
      @Valid @RequestBody ReportTechReviewRequest request) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.REPORT_TECH_REVIEW_SAVE);
    return ApiResponse.success(
        reportTechReviewService.save(projectId, request, CurrentUser.username(authentication)));
  }
}
