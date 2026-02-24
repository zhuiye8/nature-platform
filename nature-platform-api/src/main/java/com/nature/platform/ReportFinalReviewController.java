/**
 * @input ReportFinalReviewService operations and authenticated operator context
 * @output /api/v1/report-final-reviews endpoints for node-15 reviewer save/submit/list APIs
 * @position HTTP adapter for report final-review stage operations
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
@RequestMapping("/api/v1/report-final-reviews")
public class ReportFinalReviewController {
  private final ReportFinalReviewService reportFinalReviewService;

  public ReportFinalReviewController(ReportFinalReviewService reportFinalReviewService) {
    this.reportFinalReviewService = reportFinalReviewService;
  }

  @GetMapping
  public ApiResponse<List<ReportFinalReviewRecord>> list() {
    return ApiResponse.success(reportFinalReviewService.list());
  }

  @GetMapping("/{projectId}")
  public ResponseEntity<ApiResponse<ReportFinalReviewRecord>> detail(@PathVariable long projectId) {
    return reportFinalReviewService
        .detail(projectId)
        .map(item -> ResponseEntity.ok(ApiResponse.success(item)))
        .orElseGet(
            () ->
                ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.failure(ErrorCode.NOT_FOUND, "report final review not found")));
  }

  @GetMapping("/candidates")
  public ApiResponse<List<String>> candidates() {
    return ApiResponse.success(reportFinalReviewService.listCandidates());
  }

  @PutMapping("/{projectId}")
  public ApiResponse<ReportFinalReviewRecord> save(
      Authentication authentication,
      @PathVariable long projectId,
      @Valid @RequestBody ReportFinalReviewRequest request) {
    return ApiResponse.success(
        reportFinalReviewService.save(projectId, request, CurrentUser.username(authentication)));
  }

  @PostMapping("/{projectId}/submit")
  public ApiResponse<ReportFinalReviewRecord> submit(
      Authentication authentication, @PathVariable long projectId) {
    return ApiResponse.success(
        reportFinalReviewService.submit(projectId, CurrentUser.username(authentication)));
  }
}
