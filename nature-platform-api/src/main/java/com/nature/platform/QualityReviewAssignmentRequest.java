/**
 * @input Quality-review assignee selection and expected assignment version for optimistic concurrency
 * @output QualityReviewAssignmentRequest DTO for node-9 four-reviewer assignment operations
 * @position Node-9 input contract enforcing explicit technical/A/B/C assignee selection
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;

public class QualityReviewAssignmentRequest {
  @NotBlank
  private String techReviewer;

  @NotBlank
  private String contentReviewerA;

  @NotBlank
  private String contentReviewerB;

  @NotBlank
  private String contentReviewerC;

  @PositiveOrZero
  private Integer versionNo;

  public String getTechReviewer() {
    return techReviewer;
  }

  public void setTechReviewer(String techReviewer) {
    this.techReviewer = techReviewer;
  }

  public String getContentReviewerA() {
    return contentReviewerA;
  }

  public void setContentReviewerA(String contentReviewerA) {
    this.contentReviewerA = contentReviewerA;
  }

  public String getContentReviewerB() {
    return contentReviewerB;
  }

  public void setContentReviewerB(String contentReviewerB) {
    this.contentReviewerB = contentReviewerB;
  }

  public String getContentReviewerC() {
    return contentReviewerC;
  }

  public void setContentReviewerC(String contentReviewerC) {
    this.contentReviewerC = contentReviewerC;
  }

  public Integer getVersionNo() {
    return versionNo;
  }

  public void setVersionNo(Integer versionNo) {
    this.versionNo = versionNo;
  }
}
