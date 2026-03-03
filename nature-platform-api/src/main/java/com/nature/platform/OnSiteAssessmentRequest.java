/**
 * @input On-site assessment REST request body fields for node-8 operations
 * @output OnSiteAssessmentRequest DTO for save/submit payload binding
 * @position Node-8 input contract for on-site assessment execution data
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import jakarta.validation.constraints.Size;
import java.util.ArrayList;
import java.util.List;

public class OnSiteAssessmentRequest {
  private List<String> evidenceFiles = new ArrayList<>();

  @Size(max = 512)
  private String packageObjectKey;

  @Size(max = 2000)
  private String assessmentDetail;

  @Size(max = 2000)
  private String assessmentRemark;

  public List<String> getEvidenceFiles() {
    return evidenceFiles;
  }

  public void setEvidenceFiles(List<String> evidenceFiles) {
    this.evidenceFiles = evidenceFiles == null ? new ArrayList<>() : evidenceFiles;
  }

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

  public String getAssessmentRemark() {
    return assessmentRemark;
  }

  public void setAssessmentRemark(String assessmentRemark) {
    this.assessmentRemark = assessmentRemark;
  }
}
