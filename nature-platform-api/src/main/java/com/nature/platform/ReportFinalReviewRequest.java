/**
 * @input Report final-review assignment payload
 * @output ReportFinalReviewRequest DTO for node-15 reviewer configuration and remark updates
 * @position Node-15 input contract for final report-review stage
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public class ReportFinalReviewRequest {
  @NotBlank
  private String reviewer;

  @Size(max = 500)
  private String remark;

  @PositiveOrZero
  private Integer versionNo;

  public String getReviewer() {
    return reviewer;
  }

  public void setReviewer(String reviewer) {
    this.reviewer = reviewer;
  }

  public String getRemark() {
    return remark;
  }

  public void setRemark(String remark) {
    this.remark = remark;
  }

  public Integer getVersionNo() {
    return versionNo;
  }

  public void setVersionNo(Integer versionNo) {
    this.versionNo = versionNo;
  }
}
