/**
 * @input ProjectRegisterService domain operations, AdminAccessService guards, and auth principal operator context
 * @output /api/v1/project-registers endpoints for project registration CRUD, contract options, submit-review, and workflow trace query
 * @position HTTP adapter layer for project registration workflows, archived-contract option loading, permission guards, and validation errors
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/project-registers")
public class ProjectRegisterController {
  private final ProjectRegisterService projectRegisterService;
  private final AdminAccessService adminAccessService;
  private final ContractService contractService;

  public ProjectRegisterController(
      ProjectRegisterService projectRegisterService,
      AdminAccessService adminAccessService,
      ContractService contractService) {
    this.projectRegisterService = projectRegisterService;
    this.adminAccessService = adminAccessService;
    this.contractService = contractService;
  }

  @GetMapping
  public ApiResponse<List<ProjectRegisterRecord>> list(Authentication authentication) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.PROJECT_REGISTER_VIEW);
    return ApiResponse.success(projectRegisterService.list());
  }

  @GetMapping("/contract-options")
  public ApiResponse<List<ContractRecord>> contractOptions(Authentication authentication) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.PROJECT_REGISTER_VIEW);
    List<ContractRecord> options =
        contractService.listForArchive().stream()
            .filter(item -> "ARCHIVED".equalsIgnoreCase(item.getArchiveStatus()))
            .toList();
    return ApiResponse.success(options);
  }

  @GetMapping("/{id}")
  public ResponseEntity<ApiResponse<ProjectRegisterRecord>> detail(
      Authentication authentication, @PathVariable long id) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.PROJECT_REGISTER_VIEW);
    return projectRegisterService
        .findById(id)
        .map(item -> ResponseEntity.ok(ApiResponse.success(item)))
        .orElseGet(
            () ->
                ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.failure(ErrorCode.NOT_FOUND, "project register not found")));
  }

  @PostMapping
  public ApiResponse<Map<String, Long>> create(
      Authentication authentication, @Valid @RequestBody ProjectRegisterRequest request) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.PROJECT_REGISTER_CREATE);
    long id = projectRegisterService.create(request, CurrentUser.username(authentication));
    return ApiResponse.success(Map.of("id", id));
  }

  @PutMapping("/{id}")
  public ApiResponse<ProjectRegisterRecord> update(
      Authentication authentication,
      @PathVariable long id,
      @Valid @RequestBody ProjectRegisterRequest request) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.PROJECT_REGISTER_UPDATE);
    return ApiResponse.success(
        projectRegisterService.update(id, request, CurrentUser.username(authentication)));
  }

  @DeleteMapping("/{id}")
  public ApiResponse<Map<String, Long>> delete(Authentication authentication, @PathVariable long id) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.PROJECT_REGISTER_DELETE);
    projectRegisterService.delete(id, CurrentUser.username(authentication));
    return ApiResponse.success(Map.of("id", id));
  }

  @PostMapping("/{id}/submit-review")
  public ApiResponse<Map<String, Long>> submitReview(Authentication authentication, @PathVariable long id) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.PROJECT_REGISTER_SUBMIT);
    projectRegisterService.submitReview(id, CurrentUser.username(authentication));
    return ApiResponse.success(Map.of("id", id));
  }

  @GetMapping("/{id}/workflow-trace")
  public ApiResponse<List<WorkflowTraceRecord>> workflowTrace(
      Authentication authentication, @PathVariable long id) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.PROJECT_REGISTER_TRACE_VIEW);
    return ApiResponse.success(projectRegisterService.listWorkflowTrace(id));
  }
}
