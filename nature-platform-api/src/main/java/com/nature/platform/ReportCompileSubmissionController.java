/**
 * @input ReportCompileService submission operations, AdminAccessService permission checks, and authenticated operator context
 * @output /api/v1/report-compile-submissions endpoints for node-14 upload/save/submit/list APIs with action-level authorization
 * @position HTTP adapter for report compile and upload stage with RBAC guards
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
  private final AdminAccessService adminAccessService;

  public ReportCompileSubmissionController(
      ReportCompileService reportCompileService, AdminAccessService adminAccessService) {
    this.reportCompileService = reportCompileService;
    this.adminAccessService = adminAccessService;
  }

  @GetMapping
  public ApiResponse<List<ReportCompileSubmissionRecord>> list(Authentication authentication) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.REPORT_COMPILE_SUBMISSION_VIEW);
    return ApiResponse.success(reportCompileService.listSubmissions());
  }

  @GetMapping("/{projectId}")
  public ResponseEntity<ApiResponse<ReportCompileSubmissionRecord>> detail(
      Authentication authentication, @PathVariable long projectId) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.REPORT_COMPILE_SUBMISSION_VIEW);
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
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.REPORT_COMPILE_SUBMISSION_SAVE);
    return ApiResponse.success(
        reportCompileService.saveSubmission(projectId, request, CurrentUser.username(authentication)));
  }

  @PostMapping("/{projectId}/submit")
  public ApiResponse<ReportCompileSubmissionRecord> submit(
      Authentication authentication, @PathVariable long projectId) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.REPORT_COMPILE_SUBMISSION_SUBMIT);
    return ApiResponse.success(
        reportCompileService.submitSubmission(projectId, CurrentUser.username(authentication)));
  }
}
