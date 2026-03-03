/**
 * @input PoliceRegisterService operations, AdminAccessService guards, authentication principal, and request validation data
 * @output /api/v1/police-registers endpoints for node-7 list/detail/save/submit operations with action-level guards
 * @position HTTP adapter for police registration stage management in the project workflow chain
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
@RequestMapping("/api/v1/police-registers")
public class PoliceRegisterController {
  private final PoliceRegisterService policeRegisterService;
  private final AdminAccessService adminAccessService;

  public PoliceRegisterController(
      PoliceRegisterService policeRegisterService, AdminAccessService adminAccessService) {
    this.policeRegisterService = policeRegisterService;
    this.adminAccessService = adminAccessService;
  }

  @GetMapping
  public ApiResponse<List<PoliceRegisterRecord>> list(Authentication authentication) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, BusinessPermissionCodes.POLICE_REGISTER_VIEW);
    return ApiResponse.success(policeRegisterService.list(operator));
  }

  @GetMapping("/project-managers")
  public ApiResponse<List<String>> projectManagerCandidates(Authentication authentication) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, BusinessPermissionCodes.POLICE_REGISTER_VIEW);
    return ApiResponse.success(policeRegisterService.listProjectManagerCandidates());
  }

  @GetMapping("/{projectId}")
  public ResponseEntity<ApiResponse<PoliceRegisterRecord>> detail(
      Authentication authentication, @PathVariable long projectId) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, BusinessPermissionCodes.POLICE_REGISTER_VIEW);
    return policeRegisterService
        .detailVisible(projectId, operator)
        .map(item -> ResponseEntity.ok(ApiResponse.success(item)))
        .orElseGet(
            () ->
                ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.failure(ErrorCode.NOT_FOUND, "police register not found")));
  }

  @PutMapping("/{projectId}")
  public ApiResponse<PoliceRegisterRecord> save(
      Authentication authentication,
      @PathVariable long projectId,
      @Valid @RequestBody PoliceRegisterRequest request) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.POLICE_REGISTER_SAVE);
    return ApiResponse.success(
        policeRegisterService.save(projectId, request, CurrentUser.username(authentication)));
  }

  @PostMapping("/{projectId}/submit")
  public ApiResponse<PoliceRegisterRecord> submit(Authentication authentication, @PathVariable long projectId) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.POLICE_REGISTER_SUBMIT);
    return ApiResponse.success(policeRegisterService.submit(projectId, CurrentUser.username(authentication)));
  }
}
