/**
 * @input AdminAccessService guard, AdminUserService operations, and authentication principal context
 * @output /api/v1/admin/users endpoints for user list/create/update and role-code lookup
 * @position Admin HTTP adapter for user management domain
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
@RequestMapping("/api/v1/admin/users")
public class AdminUserController {
  private final AdminAccessService adminAccessService;
  private final AdminUserService adminUserService;

  public AdminUserController(AdminAccessService adminAccessService, AdminUserService adminUserService) {
    this.adminAccessService = adminAccessService;
    this.adminUserService = adminUserService;
  }

  @GetMapping
  public ApiResponse<List<AdminUserRecord>> list(Authentication authentication) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, AdminPermissionCodes.USER_MANAGE);
    return ApiResponse.success(adminUserService.listUsers());
  }

  @PostMapping
  public ApiResponse<AdminUserRecord> create(
      Authentication authentication, @Valid @RequestBody AdminUserCreateRequest request) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, AdminPermissionCodes.USER_MANAGE);
    return ApiResponse.success(adminUserService.create(request, operator));
  }

  @PutMapping("/{username}")
  public ApiResponse<AdminUserRecord> update(
      Authentication authentication,
      @PathVariable String username,
      @Valid @RequestBody AdminUserUpdateRequest request) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, AdminPermissionCodes.USER_MANAGE);
    return ApiResponse.success(adminUserService.update(username, request, operator));
  }

  @GetMapping("/role-codes")
  public ApiResponse<List<String>> roleCodes(Authentication authentication) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, AdminPermissionCodes.USER_MANAGE);
    return ApiResponse.success(adminUserService.listAllRoleCodes());
  }
}
