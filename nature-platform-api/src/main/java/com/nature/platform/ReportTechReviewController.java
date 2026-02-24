/**
 * @input ReportTechReviewService operations and authenticated operator context
 * @output /api/v1/report-tech-reviews endpoints for node-11 save/submit/list and candidate query
 * @position HTTP adapter for report overall technical-review stage operations
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
@RequestMapping("/api/v1/report-tech-reviews")
public class ReportTechReviewController {
  private final ReportTechReviewService reportTechReviewService;

  public ReportTechReviewController(ReportTechReviewService reportTechReviewService) {
    this.reportTechReviewService = reportTechReviewService;
  }

  @GetMapping
  public ApiResponse<List<ReportTechReviewRecord>> list() {
    return ApiResponse.success(reportTechReviewService.list());
  }

  @GetMapping("/{projectId}")
  public ResponseEntity<ApiResponse<ReportTechReviewRecord>> detail(@PathVariable long projectId) {
    return reportTechReviewService
        .detail(projectId)
        .map(item -> ResponseEntity.ok(ApiResponse.success(item)))
        .orElseGet(
            () ->
                ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.failure(ErrorCode.NOT_FOUND, "report tech review not found")));
  }

  @GetMapping("/candidates")
  public ApiResponse<List<String>> candidates() {
    return ApiResponse.success(reportTechReviewService.listCandidates());
  }

  @PutMapping("/{projectId}")
  public ApiResponse<ReportTechReviewRecord> save(
      Authentication authentication,
      @PathVariable long projectId,
      @Valid @RequestBody ReportTechReviewRequest request) {
    return ApiResponse.success(
        reportTechReviewService.save(projectId, request, CurrentUser.username(authentication)));
  }

  @PostMapping("/{projectId}/submit")
  public ApiResponse<ReportTechReviewRecord> submit(
      Authentication authentication, @PathVariable long projectId) {
    return ApiResponse.success(reportTechReviewService.submit(projectId, CurrentUser.username(authentication)));
  }
}
