/**
 * @input ReportCompileService submission operations and authenticated operator context
 * @output /api/v1/report-compile-submissions endpoints for node-14 upload/save/submit/list APIs
 * @position HTTP adapter for report compile and upload stage
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
@RequestMapping("/api/v1/report-compile-submissions")
public class ReportCompileSubmissionController {
  private final ReportCompileService reportCompileService;

  public ReportCompileSubmissionController(ReportCompileService reportCompileService) {
    this.reportCompileService = reportCompileService;
  }

  @GetMapping
  public ApiResponse<List<ReportCompileSubmissionRecord>> list() {
    return ApiResponse.success(reportCompileService.listSubmissions());
  }

  @GetMapping("/{projectId}")
  public ResponseEntity<ApiResponse<ReportCompileSubmissionRecord>> detail(@PathVariable long projectId) {
    return reportCompileService
        .detailSubmission(projectId)
        .map(item -> ResponseEntity.ok(ApiResponse.success(item)))
        .orElseGet(
            () ->
                ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.failure(ErrorCode.NOT_FOUND, "report compile submission not found")));
  }

  @PutMapping("/{projectId}")
  public ApiResponse<ReportCompileSubmissionRecord> save(
      Authentication authentication,
      @PathVariable long projectId,
      @Valid @RequestBody ReportCompileSubmissionRequest request) {
    return ApiResponse.success(
        reportCompileService.saveSubmission(projectId, request, CurrentUser.username(authentication)));
  }

  @PostMapping("/{projectId}/submit")
  public ApiResponse<ReportCompileSubmissionRecord> submit(
      Authentication authentication, @PathVariable long projectId) {
    return ApiResponse.success(
        reportCompileService.submitSubmission(projectId, CurrentUser.username(authentication)));
  }
}
