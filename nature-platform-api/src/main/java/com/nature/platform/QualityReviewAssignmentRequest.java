/**
 * @input Quality-review assignee selection and expected assignment version for optimistic concurrency
 * @output QualityReviewAssignmentRequest DTO for node-9 four-reviewer assignment operations
 * @position Node-9 input contract enforcing explicit technical + content(technical/management/network) assignee selection
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;

public class QualityReviewAssignmentRequest {
  @NotBlank
  private String techReviewer;

  @NotBlank
  @JsonAlias("contentReviewerA")
  private String contentReviewerTech;

  @NotBlank
  @JsonAlias("contentReviewerB")
  private String contentReviewerManagement;

  @NotBlank
  @JsonAlias("contentReviewerC")
  private String contentReviewerNetwork;

  @PositiveOrZero
  private Integer versionNo;

  public String getTechReviewer() {
    return techReviewer;
  }

  public void setTechReviewer(String techReviewer) {
    this.techReviewer = techReviewer;
  }

  public String getContentReviewerTech() {
    return contentReviewerTech;
  }

  public void setContentReviewerTech(String contentReviewerTech) {
    this.contentReviewerTech = contentReviewerTech;
  }

  public String getContentReviewerManagement() {
    return contentReviewerManagement;
  }

  public void setContentReviewerManagement(String contentReviewerManagement) {
    this.contentReviewerManagement = contentReviewerManagement;
  }

  public String getContentReviewerNetwork() {
    return contentReviewerNetwork;
  }

  public void setContentReviewerNetwork(String contentReviewerNetwork) {
    this.contentReviewerNetwork = contentReviewerNetwork;
  }

  @Deprecated
  public String getContentReviewerA() {
    return contentReviewerTech;
  }

  @Deprecated
  public void setContentReviewerA(String contentReviewerA) {
    this.contentReviewerTech = contentReviewerA;
  }

  @Deprecated
  public String getContentReviewerB() {
    return contentReviewerManagement;
  }

  @Deprecated
  public void setContentReviewerB(String contentReviewerB) {
    this.contentReviewerManagement = contentReviewerB;
  }

  @Deprecated
  public String getContentReviewerC() {
    return contentReviewerNetwork;
  }

  @Deprecated
  public void setContentReviewerC(String contentReviewerC) {
    this.contentReviewerNetwork = contentReviewerC;
  }

  public Integer getVersionNo() {
    return versionNo;
  }

  public void setVersionNo(Integer versionNo) {
    this.versionNo = versionNo;
  }
}
