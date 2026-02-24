/**
 * @input Report compile-assignment save payload with assignee and optimistic-lock version
 * @output ReportCompileAssignmentRequest DTO for node-13 assignment operations
 * @position Node-13 input contract for single-person compile assignment
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;

public class ReportCompileAssignmentRequest {
  @NotBlank
  private String assignee;

  @PositiveOrZero
  private Integer versionNo;

  public String getAssignee() {
    return assignee;
  }

  public void setAssignee(String assignee) {
    this.assignee = assignee;
  }

  public Integer getVersionNo() {
    return versionNo;
  }

  public void setVersionNo(Integer versionNo) {
    this.versionNo = versionNo;
  }
}
