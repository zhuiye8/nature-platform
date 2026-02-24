/**
 * @input ContractService operations and authentication principal for operator context
 * @output /api/v1/contracts endpoints for contract CRUD, review transitions, and archive action
 * @position HTTP adapter layer for contract management and workflow entry operations
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
@RequestMapping("/api/v1/contracts")
public class ContractController {
  private final ContractService contractService;

  public ContractController(ContractService contractService) {
    this.contractService = contractService;
  }

  @GetMapping
  public ApiResponse<List<ContractRecord>> list() {
    return ApiResponse.success(contractService.list());
  }

  @GetMapping("/{id}")
  public ResponseEntity<ApiResponse<ContractRecord>> detail(@PathVariable long id) {
    return contractService
        .findById(id)
        .map(item -> ResponseEntity.ok(ApiResponse.success(item)))
        .orElseGet(
            () ->
                ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.failure(ErrorCode.NOT_FOUND, "contract not found")));
  }

  @PostMapping
  public ApiResponse<Map<String, Long>> create(
      Authentication authentication, @Valid @RequestBody ContractRequest request) {
    long id = contractService.create(request, CurrentUser.username(authentication));
    return ApiResponse.success(Map.of("id", id));
  }

  @PutMapping("/{id}")
  public ApiResponse<ContractRecord> update(
      Authentication authentication, @PathVariable long id, @Valid @RequestBody ContractRequest request) {
    return ApiResponse.success(contractService.update(id, request, CurrentUser.username(authentication)));
  }

  @DeleteMapping("/{id}")
  public ApiResponse<Map<String, Long>> delete(Authentication authentication, @PathVariable long id) {
    contractService.delete(id, CurrentUser.username(authentication));
    return ApiResponse.success(Map.of("id", id));
  }

  @PostMapping("/{id}/submit-review")
  public ApiResponse<Map<String, Long>> submitReview(Authentication authentication, @PathVariable long id) {
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
    contractService.archive(id, request, CurrentUser.username(authentication));
    return ApiResponse.success(Map.of("id", id));
  }
}

