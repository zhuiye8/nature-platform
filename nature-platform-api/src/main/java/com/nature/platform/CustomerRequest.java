/**
 * @input Jakarta validation constraints; JSON body from customer create/update APIs
 * @output CustomerRequest DTO carrying customer form fields
 * @position Customer domain input contract for persistence and field-level audit workflows
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import jakarta.validation.constraints.NotBlank;

public class CustomerRequest {
  @NotBlank private String fullName;
  private String industry;
  private String region;
  private String addressDetail;
  private String uscc;
  private String contactName;
  private String mobilePhone;
  private String remark;

  public String getFullName() {
    return fullName;
  }

  public void setFullName(String fullName) {
    this.fullName = fullName;
  }

  public String getIndustry() {
    return industry;
  }

  public void setIndustry(String industry) {
    this.industry = industry;
  }

  public String getRegion() {
    return region;
  }

  public void setRegion(String region) {
    this.region = region;
  }

  public String getAddressDetail() {
    return addressDetail;
  }

  public void setAddressDetail(String addressDetail) {
    this.addressDetail = addressDetail;
  }

  public String getUscc() {
    return uscc;
  }

  public void setUscc(String uscc) {
    this.uscc = uscc;
  }

  public String getContactName() {
    return contactName;
  }

  public void setContactName(String contactName) {
    this.contactName = contactName;
  }

  public String getMobilePhone() {
    return mobilePhone;
  }

  public void setMobilePhone(String mobilePhone) {
    this.mobilePhone = mobilePhone;
  }

  public String getRemark() {
    return remark;
  }

  public void setRemark(String remark) {
    this.remark = remark;
  }
}

