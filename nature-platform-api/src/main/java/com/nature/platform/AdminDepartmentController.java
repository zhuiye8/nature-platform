/**
 * @input AdminAccessService guard, AdminDepartmentService operations, and auth principal operator context
 * @output /api/v1/admin/departments endpoints for department list/tree/create/update management APIs
 * @position Admin HTTP adapter for organization department maintenance and option projection
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/departments")
public class AdminDepartmentController {
  private final AdminAccessService adminAccessService;
  private final AdminDepartmentService adminDepartmentService;

  public AdminDepartmentController(
      AdminAccessService adminAccessService, AdminDepartmentService adminDepartmentService) {
    this.adminAccessService = adminAccessService;
    this.adminDepartmentService = adminDepartmentService;
  }

  @GetMapping
  public ApiResponse<List<AdminDepartmentRecord>> list(Authentication authentication) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, AdminPermissionCodes.DEPARTMENT_MANAGE);
    return ApiResponse.success(adminDepartmentService.list());
  }

  @GetMapping("/tree")
  public ApiResponse<List<AdminDepartmentRecord>> tree(Authentication authentication) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, AdminPermissionCodes.DEPARTMENT_MANAGE);
    return ApiResponse.success(adminDepartmentService.tree());
  }

  @PostMapping
  public ApiResponse<AdminDepartmentRecord> create(
      Authentication authentication, @Valid @RequestBody AdminDepartmentSaveRequest request) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, AdminPermissionCodes.DEPARTMENT_MANAGE);
    return ApiResponse.success(adminDepartmentService.create(request, operator));
  }

  @PutMapping("/{id}")
  public ApiResponse<AdminDepartmentRecord> update(
      Authentication authentication,
      @PathVariable long id,
      @Valid @RequestBody AdminDepartmentSaveRequest request) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, AdminPermissionCodes.DEPARTMENT_MANAGE);
    return ApiResponse.success(adminDepartmentService.update(id, request, operator));
  }
}
