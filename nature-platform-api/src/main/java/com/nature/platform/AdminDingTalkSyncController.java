/**
 * @input AdminAccessService guard, AdminDingTalkSyncService sync operations, and auth principal context
 * @output /api/v1/admin/dingtalk/sync endpoint for one-click department+user synchronization
 * @position Admin integration HTTP adapter for DingTalk organization sync execution
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/dingtalk")
public class AdminDingTalkSyncController {
  private final AdminAccessService adminAccessService;
  private final AdminDingTalkSyncService adminDingTalkSyncService;

  public AdminDingTalkSyncController(
      AdminAccessService adminAccessService, AdminDingTalkSyncService adminDingTalkSyncService) {
    this.adminAccessService = adminAccessService;
    this.adminDingTalkSyncService = adminDingTalkSyncService;
  }

  @PostMapping("/sync")
  public ApiResponse<AdminDingTalkSyncResult> sync(Authentication authentication) {
    String operator = CurrentUser.username(authentication);
    adminAccessService.requirePermission(operator, AdminPermissionCodes.DINGTALK_SYNC);
    return ApiResponse.success(adminDingTalkSyncService.syncAll(operator));
  }
}
