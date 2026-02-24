/**
 * @input Police register REST request body fields
 * @output PoliceRegisterRequest DTO for create/update police-register node data
 * @position Node-7 input contract for project police registration stage
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import jakarta.validation.constraints.Size;

public class PoliceRegisterRequest {
  @Size(max = 128)
  private String registerNo;

  @Size(max = 255)
  private String filingAgency;

  @Size(max = 64)
  private String contactName;

  @Size(max = 32)
  private String contactPhone;

  @Size(max = 1000)
  private String remark;

  public String getRegisterNo() {
    return registerNo;
  }

  public void setRegisterNo(String registerNo) {
    this.registerNo = registerNo;
  }

  public String getFilingAgency() {
    return filingAgency;
  }

  public void setFilingAgency(String filingAgency) {
    this.filingAgency = filingAgency;
  }

  public String getContactName() {
    return contactName;
  }

  public void setContactName(String contactName) {
    this.contactName = contactName;
  }

  public String getContactPhone() {
    return contactPhone;
  }

  public void setContactPhone(String contactPhone) {
    this.contactPhone = contactPhone;
  }

  public String getRemark() {
    return remark;
  }

  public void setRemark(String remark) {
    this.remark = remark;
  }
}
