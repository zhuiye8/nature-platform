/**
 * @input AdminAccessService page-resource guard, AdminResourceService resource catalog operations, and auth principal context
 * @output /api/v1/admin/resources endpoints for resource list/tree CRUD plus role-resource assignment operations
 * @position Admin HTTP adapter exposing page-level RBAC resource governance APIs
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
@RequestMapping("/api/v1/admin/resources")
public class AdminResourceController {
  private final AdminAccessService adminAccessService;
  private final AdminResourceService adminResourceService;

  public AdminResourceController(
      AdminAccessService adminAccessService, AdminResourceService adminResourceService) {
    this.adminAccessService = adminAccessService;
    this.adminResourceService = adminResourceService;
  }

  @GetMapping
  public ApiResponse<List<AdminResourceRecord>> list(
      Authentication authentication,
      @RequestParam(required = false) String keyword,
      @RequestParam(required = false) String resourceType,
      @RequestParam(required = false) Boolean enabled) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, AdminPermissionCodes.PERMISSION_VIEW);
    return ApiResponse.success(adminResourceService.listResources(keyword, resourceType, enabled));
  }

  @GetMapping("/tree")
  public ApiResponse<List<AdminResourceRecord>> tree(
      Authentication authentication,
      @RequestParam(defaultValue = "false") boolean mine,
      @RequestParam(defaultValue = "true") boolean enabledOnly) {
    String operator = CurrentUser.username(authentication);
    if (mine) {
      return ApiResponse.success(adminResourceService.listResourceTreeForUser(operator));
    }
    adminAccessService.requirePermission(operator, AdminPermissionCodes.PERMISSION_VIEW);
    return ApiResponse.success(adminResourceService.listResourceTreeAll(enabledOnly));
  }

  @PostMapping
  public ApiResponse<AdminResourceRecord> create(
      Authentication authentication, @Valid @RequestBody AdminResourceCreateRequest request) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, AdminPermissionCodes.PERMISSION_VIEW);
    return ApiResponse.success(adminResourceService.create(request, operator));
  }

  @PutMapping("/{resourceKey}")
  public ApiResponse<AdminResourceRecord> update(
      Authentication authentication,
      @PathVariable String resourceKey,
      @Valid @RequestBody AdminResourceUpdateRequest request) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, AdminPermissionCodes.PERMISSION_VIEW);
    return ApiResponse.success(adminResourceService.update(resourceKey, request, operator));
  }

  @DeleteMapping("/{resourceKey}")
  public ApiResponse<Map<String, String>> delete(
      Authentication authentication, @PathVariable String resourceKey) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, AdminPermissionCodes.PERMISSION_VIEW);
    adminResourceService.delete(resourceKey, operator);
    return ApiResponse.success(Map.of("resourceKey", resourceKey));
  }

  @GetMapping("/role/{roleCode}")
  public ApiResponse<List<String>> listRoleResources(
      Authentication authentication, @PathVariable String roleCode) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, AdminPermissionCodes.ROLE_MANAGE);
    return ApiResponse.success(adminResourceService.listRoleResourceKeys(roleCode));
  }

  @PutMapping("/role/{roleCode}")
  public ApiResponse<List<String>> replaceRoleResources(
      Authentication authentication,
      @PathVariable String roleCode,
      @RequestBody(required = false) AdminRoleResourceAssignRequest request) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, AdminPermissionCodes.ROLE_MANAGE);
    List<String> resourceKeys = request == null ? List.of() : request.getResourceKeys();
    return ApiResponse.success(adminResourceService.replaceRoleResourceKeys(roleCode, resourceKeys, operator));
  }
}
