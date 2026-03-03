/**
 * @input ContractService operations, AdminAccessService guards, and authentication principal for operator context
 * @output /api/v1/contracts endpoints for contract CRUD, submission/archive scoped lists, workflow transitions, and archive action with permission guards
 * @position HTTP adapter layer for contract management and workflow entry operations with action-level authorization
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/contracts")
public class ContractController {
  private final ContractService contractService;
  private final AdminAccessService adminAccessService;

  public ContractController(ContractService contractService, AdminAccessService adminAccessService) {
    this.contractService = contractService;
    this.adminAccessService = adminAccessService;
  }

  @GetMapping
  public ApiResponse<List<ContractRecord>> list(Authentication authentication) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, BusinessPermissionCodes.CONTRACT_VIEW);
    return ApiResponse.success(contractService.list(operator));
  }

  @GetMapping("/project-name-suggestions")
  public ApiResponse<ContractProjectNameSuggestionResponse> projectNameSuggestions(
      Authentication authentication,
      @RequestParam String keyword,
      @RequestParam(defaultValue = "5") int limit) {
    String operator = CurrentUser.username(authentication);
    if (!(adminAccessService.hasPermission(operator, BusinessPermissionCodes.CONTRACT_CREATE)
        || adminAccessService.hasPermission(operator, BusinessPermissionCodes.CONTRACT_UPDATE))) {
      adminAccessService.requirePermission(operator, BusinessPermissionCodes.CONTRACT_VIEW);
    }
    return ApiResponse.success(contractService.suggestProjectNames(keyword, limit));
  }

  @GetMapping("/archive-list")
  public ApiResponse<List<ContractRecord>> archiveList(Authentication authentication) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, BusinessPermissionCodes.CONTRACT_ARCHIVE);
    return ApiResponse.success(contractService.listForArchive(operator));
  }

  @GetMapping("/{id}")
  public ResponseEntity<ApiResponse<ContractRecord>> detail(
      Authentication authentication, @PathVariable long id) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, BusinessPermissionCodes.CONTRACT_VIEW);
    return contractService
        .findByIdVisible(id, operator)
        .map(item -> ResponseEntity.ok(ApiResponse.success(item)))
        .orElseGet(
            () ->
                ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.failure(ErrorCode.NOT_FOUND, "contract not found")));
  }

  @PostMapping
  public ApiResponse<Map<String, Long>> create(
      Authentication authentication, @Valid @RequestBody ContractRequest request) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.CONTRACT_CREATE);
    long id = contractService.create(request, CurrentUser.username(authentication));
    return ApiResponse.success(Map.of("id", id));
  }

  @PutMapping("/{id}")
  public ApiResponse<ContractRecord> update(
      Authentication authentication, @PathVariable long id, @Valid @RequestBody ContractRequest request) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.CONTRACT_UPDATE);
    return ApiResponse.success(contractService.update(id, request, CurrentUser.username(authentication)));
  }

  @DeleteMapping("/{id}")
  public ApiResponse<Map<String, Long>> delete(Authentication authentication, @PathVariable long id) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.CONTRACT_DELETE);
    contractService.delete(id, CurrentUser.username(authentication));
    return ApiResponse.success(Map.of("id", id));
  }

  @PostMapping("/{id}/submit-review")
  public ApiResponse<Map<String, Long>> submitReview(Authentication authentication, @PathVariable long id) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.CONTRACT_SUBMIT);
    contractService.submitReview(id, CurrentUser.username(authentication));
    return ApiResponse.success(Map.of("id", id));
  }

  @PostMapping("/{id}/approve")
  public ApiResponse<ContractRecord> approve(Authentication authentication, @PathVariable long id) {
    return ApiResponse.success(contractService.approve(id, CurrentUser.username(authentication)));
  }

  @PostMapping("/{id}/reject")
  public ApiResponse<Map<String, Long>> reject(
      Authentication authentication, @PathVariable long id, @RequestBody(required = false) ReviewActionRequest request) {
    String remark = request == null ? "" : request.getRemark();
    contractService.reject(id, CurrentUser.username(authentication), remark);
    return ApiResponse.success(Map.of("id", id));
  }

  @PostMapping("/{id}/archive")
  public ApiResponse<Map<String, Long>> archive(
      Authentication authentication, @PathVariable long id, @RequestBody ContractArchiveRequest request) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.CONTRACT_ARCHIVE);
    contractService.archive(id, request, CurrentUser.username(authentication));
    return ApiResponse.success(Map.of("id", id));
  }
}
