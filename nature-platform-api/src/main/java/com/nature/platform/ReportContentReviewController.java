/**
 * @input ReportContentReviewService operations and authenticated operator context
 * @output /api/v1/report-content-reviews endpoints for node-12 list/detail/submit operations
 * @position HTTP adapter for report content-review (A/B/C) stage orchestration
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/report-content-reviews")
public class ReportContentReviewController {
  private final ReportContentReviewService reportContentReviewService;

  public ReportContentReviewController(ReportContentReviewService reportContentReviewService) {
    this.reportContentReviewService = reportContentReviewService;
  }

  @GetMapping
  public ApiResponse<List<ReportContentReviewRecord>> list() {
    return ApiResponse.success(reportContentReviewService.list());
  }

  @GetMapping("/{projectId}")
  public ResponseEntity<ApiResponse<ReportContentReviewRecord>> detail(@PathVariable long projectId) {
    return reportContentReviewService
        .detail(projectId)
        .map(item -> ResponseEntity.ok(ApiResponse.success(item)))
        .orElseGet(
            () ->
                ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.failure(ErrorCode.NOT_FOUND, "report content review not found")));
  }

  @PostMapping("/{projectId}/submit")
  public ApiResponse<ReportContentReviewRecord> submit(
      Authentication authentication, @PathVariable long projectId) {
    return ApiResponse.success(
        reportContentReviewService.submit(projectId, CurrentUser.username(authentication)));
  }
}
