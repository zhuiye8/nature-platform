/**
 * @input Report final-review optional remark and optimistic-lock payload
 * @output ReportFinalReviewRequest DTO for node-15 optional remark/version updates
 * @position Node-15 input contract used by compatibility save path; reviewer is resolved from node-rule
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public class ReportFinalReviewRequest {
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
