/**
 * @input Project register request list entries with system detail and attachment metadata
 * @output ProjectSystemItemRequest DTO for per-system registration form submission
 * @position Project domain nested input model implementing system-detail field requirements
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.ArrayList;
import java.util.List;

public class ProjectSystemItemRequest {
  @NotBlank private String systemName;
  @NotBlank private String filingAgency;
  @NotBlank private String securityLevel;
  @NotNull private Boolean reassessment;
  @NotBlank private String requiredEntryDate;
  @NotBlank private String requiredReportDeliveryDate;
  @NotBlank private String assessedUnitName;
  @NotBlank private String assessedUnitIndustry;
  @NotBlank private String assessedUnitContact;
  @NotBlank private String assessedUnitMobile;
  @NotBlank private String assessedUnitAddress;
  @NotNull private Boolean hasFilingCertificate;
  private List<String> filingCertificateFiles = new ArrayList<>();
  private String filingCertificateNo;
  private String filingCertificateIssuedAt;
  @NotNull private Boolean hasFilingForm;
  private List<String> filingFormFiles = new ArrayList<>();
  @NotNull private Boolean hasClassificationReport;
  private List<String> classificationReportFiles = new ArrayList<>();

  public String getSystemName() {
    return systemName;
  }

  public void setSystemName(String systemName) {
    this.systemName = systemName;
  }

  public String getFilingAgency() {
    return filingAgency;
  }

  public void setFilingAgency(String filingAgency) {
    this.filingAgency = filingAgency;
  }

  public String getSecurityLevel() {
    return securityLevel;
  }

  public void setSecurityLevel(String securityLevel) {
    this.securityLevel = securityLevel;
  }

  public Boolean getReassessment() {
    return reassessment;
  }

  public void setReassessment(Boolean reassessment) {
    this.reassessment = reassessment;
  }

  public String getRequiredEntryDate() {
    return requiredEntryDate;
  }

  public void setRequiredEntryDate(String requiredEntryDate) {
    this.requiredEntryDate = requiredEntryDate;
  }

  public String getRequiredReportDeliveryDate() {
    return requiredReportDeliveryDate;
  }

  public void setRequiredReportDeliveryDate(String requiredReportDeliveryDate) {
    this.requiredReportDeliveryDate = requiredReportDeliveryDate;
  }

  public String getAssessedUnitName() {
    return assessedUnitName;
  }

  public void setAssessedUnitName(String assessedUnitName) {
    this.assessedUnitName = assessedUnitName;
  }

  public String getAssessedUnitIndustry() {
    return assessedUnitIndustry;
  }

  public void setAssessedUnitIndustry(String assessedUnitIndustry) {
    this.assessedUnitIndustry = assessedUnitIndustry;
  }

  public String getAssessedUnitContact() {
    return assessedUnitContact;
  }

  public void setAssessedUnitContact(String assessedUnitContact) {
    this.assessedUnitContact = assessedUnitContact;
  }

  public String getAssessedUnitMobile() {
    return assessedUnitMobile;
  }

  public void setAssessedUnitMobile(String assessedUnitMobile) {
    this.assessedUnitMobile = assessedUnitMobile;
  }

  public String getAssessedUnitAddress() {
    return assessedUnitAddress;
  }

  public void setAssessedUnitAddress(String assessedUnitAddress) {
    this.assessedUnitAddress = assessedUnitAddress;
  }

  public Boolean getHasFilingCertificate() {
    return hasFilingCertificate;
  }

  public void setHasFilingCertificate(Boolean hasFilingCertificate) {
    this.hasFilingCertificate = hasFilingCertificate;
  }

  public List<String> getFilingCertificateFiles() {
    return filingCertificateFiles;
  }

  public void setFilingCertificateFiles(List<String> filingCertificateFiles) {
    this.filingCertificateFiles = filingCertificateFiles;
  }

  public String getFilingCertificateNo() {
    return filingCertificateNo;
  }

  public void setFilingCertificateNo(String filingCertificateNo) {
    this.filingCertificateNo = filingCertificateNo;
  }

  public String getFilingCertificateIssuedAt() {
    return filingCertificateIssuedAt;
  }

  public void setFilingCertificateIssuedAt(String filingCertificateIssuedAt) {
    this.filingCertificateIssuedAt = filingCertificateIssuedAt;
  }

  public Boolean getHasFilingForm() {
    return hasFilingForm;
  }

  public void setHasFilingForm(Boolean hasFilingForm) {
    this.hasFilingForm = hasFilingForm;
  }

  public List<String> getFilingFormFiles() {
    return filingFormFiles;
  }

  public void setFilingFormFiles(List<String> filingFormFiles) {
    this.filingFormFiles = filingFormFiles;
  }

  public Boolean getHasClassificationReport() {
    return hasClassificationReport;
  }

  public void setHasClassificationReport(Boolean hasClassificationReport) {
    this.hasClassificationReport = hasClassificationReport;
  }

  public List<String> getClassificationReportFiles() {
    return classificationReportFiles;
  }

  public void setClassificationReportFiles(List<String> classificationReportFiles) {
    this.classificationReportFiles = classificationReportFiles;
  }
}

