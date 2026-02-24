/**
 * @input On-site assessment REST request body fields for node-8 operations
 * @output OnSiteAssessmentRequest DTO for save/submit payload binding
 * @position Node-8 input contract for on-site assessment execution data
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import jakarta.validation.constraints.Size;

public class OnSiteAssessmentRequest {
  @Size(max = 512)
  private String packageObjectKey;

  @Size(max = 2000)
  private String assessmentDetail;

  public String getPackageObjectKey() {
    return packageObjectKey;
  }

  public void setPackageObjectKey(String packageObjectKey) {
    this.packageObjectKey = packageObjectKey;
  }

  public String getAssessmentDetail() {
    return assessmentDetail;
  }

  public void setAssessmentDetail(String assessmentDetail) {
    this.assessmentDetail = assessmentDetail;
  }
}
