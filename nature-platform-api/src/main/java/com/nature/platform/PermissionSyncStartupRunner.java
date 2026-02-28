/**
 * @input PermissionSyncService, PermissionSyncProperties, and Spring application-runner lifecycle
 * @output Startup hook that optionally auto-syncs built-in permissions into IAM tables
 * @position Application lifecycle adapter enabling migration-free permission dictionary evolution
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class PermissionSyncStartupRunner implements ApplicationRunner {
  private static final Logger log = LoggerFactory.getLogger(PermissionSyncStartupRunner.class);

  private final PermissionSyncService permissionSyncService;
  private final PermissionSyncProperties permissionSyncProperties;

  public PermissionSyncStartupRunner(
      PermissionSyncService permissionSyncService, PermissionSyncProperties permissionSyncProperties) {
    this.permissionSyncService = permissionSyncService;
    this.permissionSyncProperties = permissionSyncProperties;
  }

  @Override
  public void run(ApplicationArguments args) {
    if (!permissionSyncProperties.isSyncOnStartup()) {
      log.info("permission auto-sync is disabled by config");
      return;
    }
    PermissionSyncService.PermissionSyncResult result =
        permissionSyncService.syncBuiltInPermissions(
            permissionSyncProperties.isSyncOverwriteText(), "system");
    log.info(
        "permission auto-sync finished: inserted={}, updated={}, superAdminGrantCount={}, reviewerGrantCount={}",
        result.inserted(),
        result.updated(),
        result.superAdminGrantCount(),
        result.reviewerGrantCount());
  }
}
