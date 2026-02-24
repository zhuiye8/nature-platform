/**
 * @input Review action request body from contract/project workflow-related endpoints
 * @output ReviewActionRequest DTO carrying optional remark text
 * @position Shared lightweight input contract for approve/reject action APIs
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

public class ReviewActionRequest {
  private String remark;

  public String getRemark() {
    return remark;
  }

  public void setRemark(String remark) {
    this.remark = remark;
  }
}

