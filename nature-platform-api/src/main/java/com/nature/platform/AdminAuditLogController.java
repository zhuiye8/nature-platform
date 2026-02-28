/**
 * @input AdminAccessService guard, AdminAuditService query, and request filter parameters
 * @output /api/v1/admin/audit-logs endpoint for operation audit retrieval
 * @position Admin HTTP adapter exposing management audit timeline
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/audit-logs")
public class AdminAuditLogController {
  private final AdminAccessService adminAccessService;
  private final AdminAuditService adminAuditService;

  public AdminAuditLogController(
      AdminAccessService adminAccessService, AdminAuditService adminAuditService) {
    this.adminAccessService = adminAccessService;
    this.adminAuditService = adminAuditService;
  }

  @GetMapping
  public ApiResponse<List<AdminAuditLogRecord>> list(
      Authentication authentication,
      @RequestParam(required = false) String actionType,
      @RequestParam(required = false) String operator,
      @RequestParam(required = false) String targetType,
      @RequestParam(defaultValue = "100") int limit) {
    String currentOperator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(currentOperator, AdminPermissionCodes.AUDIT_VIEW);
    return ApiResponse.success(adminAuditService.list(actionType, operator, targetType, limit));
  }
}
