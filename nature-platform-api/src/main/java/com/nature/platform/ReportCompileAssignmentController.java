/**
 * @input ReportCompileService assignment operations, AdminAccessService permission checks, and authenticated operator context
 * @output /api/v1/report-compile-assignments endpoints for node-13 assignment save/submit/list APIs with action-level authorization
 * @position HTTP adapter for report compile task assignment stage with RBAC guards
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
@RequestMapping("/api/v1/report-compile-assignments")
public class ReportCompileAssignmentController {
  private final ReportCompileService reportCompileService;
  private final AdminAccessService adminAccessService;

  public ReportCompileAssignmentController(
      ReportCompileService reportCompileService, AdminAccessService adminAccessService) {
    this.reportCompileService = reportCompileService;
    this.adminAccessService = adminAccessService;
  }

  @GetMapping
  public ApiResponse<List<ReportCompileAssignmentRecord>> list(Authentication authentication) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.REPORT_COMPILE_ASSIGNMENT_VIEW);
    return ApiResponse.success(reportCompileService.listAssignments());
  }

  @GetMapping("/{projectId}")
  public ResponseEntity<ApiResponse<ReportCompileAssignmentRecord>> detail(
      Authentication authentication, @PathVariable long projectId) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.REPORT_COMPILE_ASSIGNMENT_VIEW);
    return reportCompileService
        .detailAssignment(projectId)
        .map(item -> ResponseEntity.ok(ApiResponse.success(item)))
        .orElseGet(
            () ->
                ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.failure(ErrorCode.NOT_FOUND, "report compile assignment not found")));
  }

  @GetMapping("/candidates")
  public ApiResponse<List<String>> candidates(Authentication authentication) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.REPORT_COMPILE_ASSIGNMENT_CANDIDATE_VIEW);
    return ApiResponse.success(reportCompileService.listCandidates());
  }

  @PutMapping("/{projectId}")
  public ApiResponse<ReportCompileAssignmentRecord> save(
      Authentication authentication,
      @PathVariable long projectId,
      @Valid @RequestBody ReportCompileAssignmentRequest request) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.REPORT_COMPILE_ASSIGNMENT_SAVE);
    return ApiResponse.success(
        reportCompileService.saveAssignment(projectId, request, CurrentUser.username(authentication)));
  }

  @PostMapping("/{projectId}/submit")
  public ApiResponse<ReportCompileAssignmentRecord> submit(
      Authentication authentication, @PathVariable long projectId) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.REPORT_COMPILE_ASSIGNMENT_SUBMIT);
    return ApiResponse.success(
        reportCompileService.submitAssignment(projectId, CurrentUser.username(authentication)));
  }
}
