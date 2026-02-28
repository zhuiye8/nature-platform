/**
 * @input AdminAccessService permission guard and AdminPermissionService permission catalog CRUD operations
 * @output /api/v1/admin/permissions query/create/update/delete/sync endpoints for permission dictionary management
 * @position Admin HTTP adapter exposing mutable permission metadata for UI governance
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/permissions")
public class AdminPermissionController {
  private final AdminAccessService adminAccessService;
  private final AdminPermissionService adminPermissionService;

  public AdminPermissionController(
      AdminAccessService adminAccessService, AdminPermissionService adminPermissionService) {
    this.adminAccessService = adminAccessService;
    this.adminPermissionService = adminPermissionService;
  }

  @GetMapping
  public ApiResponse<List<AdminPermissionRecord>> list(
      Authentication authentication,
      @RequestParam(required = false) String category,
      @RequestParam(required = false) String keyword,
      @RequestParam(required = false) Boolean enabled) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, AdminPermissionCodes.PERMISSION_VIEW);
    return ApiResponse.success(adminPermissionService.listPermissions(category, keyword, enabled));
  }

  @PostMapping
  public ApiResponse<AdminPermissionRecord> create(
      Authentication authentication, @Valid @RequestBody AdminPermissionCreateRequest request) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, AdminPermissionCodes.PERMISSION_VIEW);
    return ApiResponse.success(adminPermissionService.create(request, operator));
  }

  @PutMapping("/{permissionCode}")
  public ApiResponse<AdminPermissionRecord> update(
      Authentication authentication,
      @PathVariable String permissionCode,
      @Valid @RequestBody AdminPermissionUpdateRequest request) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, AdminPermissionCodes.PERMISSION_VIEW);
    return ApiResponse.success(adminPermissionService.update(permissionCode, request, operator));
  }

  @DeleteMapping("/{permissionCode}")
  public ApiResponse<Map<String, String>> delete(
      Authentication authentication, @PathVariable String permissionCode) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, AdminPermissionCodes.PERMISSION_VIEW);
    adminPermissionService.delete(permissionCode, operator);
    return ApiResponse.success(Map.of("permissionCode", permissionCode));
  }

  @PostMapping("/sync")
  public ApiResponse<PermissionSyncService.PermissionSyncResult> sync(
      Authentication authentication,
      @RequestParam(defaultValue = "false") boolean overwriteText) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, AdminPermissionCodes.PERMISSION_VIEW);
    return ApiResponse.success(adminPermissionService.syncBuiltInPermissions(overwriteText, operator));
  }
}
