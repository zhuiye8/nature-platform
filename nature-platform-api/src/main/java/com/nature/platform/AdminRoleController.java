/**
 * @input AdminAccessService guard, AdminRoleService role lifecycle operations, and auth principal context
 * @output /api/v1/admin/roles endpoints for role CRUD, role-user mapping, and role-resource assignment management
 * @position Admin HTTP adapter for role governance and role-centric user/resource assignment operations
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
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
@RequestMapping("/api/v1/admin/roles")
public class AdminRoleController {
  private final AdminAccessService adminAccessService;
  private final AdminRoleService adminRoleService;

  public AdminRoleController(AdminAccessService adminAccessService, AdminRoleService adminRoleService) {
    this.adminAccessService = adminAccessService;
    this.adminRoleService = adminRoleService;
  }

  @GetMapping
  public ApiResponse<List<AdminRoleRecord>> list(Authentication authentication) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, AdminPermissionCodes.ROLE_MANAGE);
    return ApiResponse.success(adminRoleService.listRoles());
  }

  @GetMapping("/{roleCode}")
  public ApiResponse<AdminRoleRecord> detail(Authentication authentication, @PathVariable String roleCode) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, AdminPermissionCodes.ROLE_MANAGE);
    return ApiResponse.success(adminRoleService.detail(roleCode));
  }

  @GetMapping("/{roleCode}/users")
  public ApiResponse<List<String>> listRoleUsers(Authentication authentication, @PathVariable String roleCode) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, AdminPermissionCodes.ROLE_MANAGE);
    return ApiResponse.success(adminRoleService.listRoleUsers(roleCode));
  }

  @GetMapping("/user-options")
  public ApiResponse<List<AdminRoleUserOptionRecord>> listRoleUserOptions(Authentication authentication) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, AdminPermissionCodes.ROLE_MANAGE);
    return ApiResponse.success(adminRoleService.listUserOptions());
  }

  @PostMapping
  public ApiResponse<AdminRoleRecord> create(
      Authentication authentication, @Valid @RequestBody AdminRoleUpsertRequest request) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, AdminPermissionCodes.ROLE_MANAGE);
    return ApiResponse.success(adminRoleService.create(request, operator));
  }

  @PutMapping("/{roleCode}")
  public ApiResponse<AdminRoleRecord> update(
      Authentication authentication,
      @PathVariable String roleCode,
      @Valid @RequestBody AdminRoleUpsertRequest request) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, AdminPermissionCodes.ROLE_MANAGE);
    return ApiResponse.success(adminRoleService.update(roleCode, request, operator));
  }

  @DeleteMapping("/{roleCode}")
  public ApiResponse<Map<String, String>> delete(Authentication authentication, @PathVariable String roleCode) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, AdminPermissionCodes.ROLE_MANAGE);
    adminRoleService.delete(roleCode, operator);
    return ApiResponse.success(Map.of("roleCode", roleCode));
  }

  @PutMapping("/{roleCode}/users")
  public ApiResponse<List<String>> replaceRoleUsers(
      Authentication authentication,
      @PathVariable String roleCode,
      @RequestBody(required = false) AdminRoleUserAssignRequest request) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, AdminPermissionCodes.ROLE_MANAGE);
    List<String> usernames = request == null ? List.of() : request.getUsernames();
    return ApiResponse.success(adminRoleService.replaceRoleUsers(roleCode, usernames, operator));
  }
}
