/**
 * @input Report technical-review stage save payload fields
 * @output ReportTechReviewRequest DTO for reviewer assignment and remark update
 * @position Node-11 input contract for report overall technical review configuration
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public class ReportTechReviewRequest {
  @Size(max = 500)
  private String remark;

  @PositiveOrZero
  private Integer versionNo;

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
