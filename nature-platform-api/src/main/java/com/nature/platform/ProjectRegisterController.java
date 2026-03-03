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
import org.springframework.web.server.ResponseStatusException;

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
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, BusinessPermissionCodes.PROJECT_REGISTER_VIEW);
    return ApiResponse.success(projectRegisterService.list(operator));
  }

  @GetMapping("/contract-options")
  public ApiResponse<List<ContractRecord>> contractOptions(Authentication authentication) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, BusinessPermissionCodes.PROJECT_REGISTER_VIEW);
    List<ContractRecord> options =
        contractService.listForArchive(operator).stream()
            .filter(item -> "ARCHIVED".equalsIgnoreCase(item.getArchiveStatus()))
            .toList();
    return ApiResponse.success(options);
  }

  @GetMapping("/{id}")
  public ResponseEntity<ApiResponse<ProjectRegisterRecord>> detail(
      Authentication authentication, @PathVariable long id) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, BusinessPermissionCodes.PROJECT_REGISTER_VIEW);
    return projectRegisterService
        .findByIdVisible(id, operator)
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
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, BusinessPermissionCodes.PROJECT_REGISTER_TRACE_VIEW);
    if (projectRegisterService.findByIdVisible(id, operator).isEmpty()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "project register not found");
    }
    return ApiResponse.success(projectRegisterService.listWorkflowTrace(id));
  }

  @GetMapping("/{id}/assessment-members")
  public ApiResponse<List<String>> assessmentMembers(
      Authentication authentication, @PathVariable long id) {
    String operator = CurrentUser.username(authentication);
    requireProjectAssessmentMemberRead(operator);
    return ApiResponse.success(projectRegisterService.listAssessmentMembers(id));
  }

  @GetMapping("/{id}/assessment-member-options")
  public ApiResponse<List<AdminRoleUserOptionRecord>> assessmentMemberOptions(
      Authentication authentication, @PathVariable long id) {
    String operator = CurrentUser.username(authentication);
    requireProjectAssessmentMemberRead(operator);
    return ApiResponse.success(projectRegisterService.listAssessmentMemberOptions(id));
  }

  @PutMapping("/{id}/assessment-members")
  public ApiResponse<Map<String, Object>> saveAssessmentMembers(
      Authentication authentication,
      @PathVariable long id,
      @RequestBody(required = false) Map<String, List<String>> body) {
    String operator = CurrentUser.username(authentication);
    requireProjectAssessmentMemberWrite(operator);
    List<String> usernames = body == null ? List.of() : body.getOrDefault("usernames", List.of());
    projectRegisterService.saveAssessmentMembers(id, usernames, operator);
    return ApiResponse.success(Map.of("id", id, "usernames", projectRegisterService.listAssessmentMembers(id)));
  }

  private void requireProjectAssessmentMemberRead(String operator) {
    if (adminAccessService.hasPermission(operator, BusinessPermissionCodes.PROJECT_REGISTER_VIEW)
        || adminAccessService.hasPermission(operator, BusinessPermissionCodes.WORKFLOW_TASK_VIEW)) {
      return;
    }
    adminAccessService.requirePermission(operator, BusinessPermissionCodes.PROJECT_REGISTER_VIEW);
  }

  private void requireProjectAssessmentMemberWrite(String operator) {
    if (adminAccessService.hasPermission(operator, BusinessPermissionCodes.PROJECT_REGISTER_UPDATE)
        || adminAccessService.hasPermission(operator, BusinessPermissionCodes.WORKFLOW_TASK_APPROVE)) {
      return;
    }
    adminAccessService.requirePermission(operator, BusinessPermissionCodes.PROJECT_REGISTER_UPDATE);
  }
}
