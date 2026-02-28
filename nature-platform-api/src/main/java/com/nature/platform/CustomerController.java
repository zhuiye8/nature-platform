/**
 * @input CustomerService, AdminAccessService, and Authentication principal for ownership and permission context
 * @output /api/v1/customers CRUD endpoints aligned to customer management requirements with action-level guards
 * @position HTTP adapter layer for customer domain with permission and creator-based edit/delete constraints
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
@RequestMapping("/api/v1/customers")
public class CustomerController {
  private final CustomerService customerService;
  private final AdminAccessService adminAccessService;

  public CustomerController(CustomerService customerService, AdminAccessService adminAccessService) {
    this.customerService = customerService;
    this.adminAccessService = adminAccessService;
  }

  @GetMapping
  public ApiResponse<List<CustomerRecord>> list(Authentication authentication) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.CUSTOMER_VIEW);
    return ApiResponse.success(customerService.list());
  }

  @GetMapping("/{id}")
  public ResponseEntity<ApiResponse<CustomerRecord>> detail(
      Authentication authentication, @PathVariable long id) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.CUSTOMER_VIEW);
    return customerService
        .findById(id)
        .map(item -> ResponseEntity.ok(ApiResponse.success(item)))
        .orElseGet(
            () ->
                ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.failure(ErrorCode.NOT_FOUND, "customer not found")));
  }

  @PostMapping
  public ApiResponse<Map<String, Long>> create(
      Authentication authentication, @Valid @RequestBody CustomerRequest request) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.CUSTOMER_CREATE);
    long id = customerService.create(request, CurrentUser.username(authentication));
    return ApiResponse.success(Map.of("id", id));
  }

  @PutMapping("/{id}")
  public ApiResponse<CustomerRecord> update(
      Authentication authentication, @PathVariable long id, @Valid @RequestBody CustomerRequest request) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.CUSTOMER_UPDATE);
    return ApiResponse.success(customerService.update(id, request, CurrentUser.username(authentication)));
  }

  @DeleteMapping("/{id}")
  public ApiResponse<Map<String, Long>> delete(Authentication authentication, @PathVariable long id) {
    adminAccessService.requirePermission(
        CurrentUser.username(authentication), BusinessPermissionCodes.CUSTOMER_DELETE);
    customerService.delete(id, CurrentUser.username(authentication));
    return ApiResponse.success(Map.of("id", id));
  }
}
