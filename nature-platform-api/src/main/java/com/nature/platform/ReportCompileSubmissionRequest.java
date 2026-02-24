/**
 * @input Report compile submission save payload fields
 * @output ReportCompileSubmissionRequest DTO for node-14 report upload/save operations
 * @position Node-14 input contract carrying report object key and optional compile remark
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import jakarta.validation.constraints.Size;

public class ReportCompileSubmissionRequest {
  @Size(max = 512)
  private String reportObjectKey;

  @Size(max = 1000)
  private String reportRemark;

  public String getReportObjectKey() {
    return reportObjectKey;
  }

  public void setReportObjectKey(String reportObjectKey) {
    this.reportObjectKey = reportObjectKey;
  }

  public String getReportRemark() {
    return reportRemark;
  }

  public void setReportRemark(String reportRemark) {
    this.reportRemark = reportRemark;
  }
}
