/**
 * @input Contract create/update request body arrays
 * @output ContractSystemItemPayload item contract for system-level entries
 * @position Contract domain nested input model for flexible system detail submission
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public class ContractSystemItemPayload {
  @Min(2)
  @Max(3)
  private int systemLevel;

  @NotBlank private String systemName;

  public int getSystemLevel() {
    return systemLevel;
  }

  public void setSystemLevel(int systemLevel) {
    this.systemLevel = systemLevel;
  }

  public String getSystemName() {
    return systemName;
  }

  public void setSystemName(String systemName) {
    this.systemName = systemName;
  }
}

