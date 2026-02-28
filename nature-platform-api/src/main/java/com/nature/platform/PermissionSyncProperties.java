/**
 * @input app.permission.* configuration values from application.yml/environment
 * @output PermissionSyncProperties controlling startup sync toggle and text-overwrite behavior
 * @position IAM configuration model for built-in permission auto-sync strategy
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.permission")
public class PermissionSyncProperties {
  private boolean syncOnStartup = true;
  private boolean syncOverwriteText = false;

  public boolean isSyncOnStartup() {
    return syncOnStartup;
  }

  public void setSyncOnStartup(boolean syncOnStartup) {
    this.syncOnStartup = syncOnStartup;
  }

  public boolean isSyncOverwriteText() {
    return syncOverwriteText;
  }

  public void setSyncOverwriteText(boolean syncOverwriteText) {
    this.syncOverwriteText = syncOverwriteText;
  }
}
