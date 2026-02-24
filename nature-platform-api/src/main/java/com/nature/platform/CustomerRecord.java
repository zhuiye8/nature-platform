/**
 * @input Customer table rows mapped by JdbcTemplate in customer service
 * @output CustomerRecord projection returned by customer APIs
 * @position Customer domain read model for list/detail presentation and ownership checks
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

public class CustomerRecord {
  private long id;
  private String fullName;
  private String industry;
  private String region;
  private String addressDetail;
  private String uscc;
  private String contactName;
  private String mobilePhone;
  private String remark;
  private String createdBy;
  private String createdAt;
  private String updatedAt;

  public long getId() {
    return id;
  }

  public void setId(long id) {
    this.id = id;
  }

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

  public String getCreatedBy() {
    return createdBy;
  }

  public void setCreatedBy(String createdBy) {
    this.createdBy = createdBy;
  }

  public String getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(String createdAt) {
    this.createdAt = createdAt;
  }

  public String getUpdatedAt() {
    return updatedAt;
  }

  public void setUpdatedAt(String updatedAt) {
    this.updatedAt = updatedAt;
  }
}

