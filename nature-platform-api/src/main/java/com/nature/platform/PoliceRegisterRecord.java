/**
 * @input Police-register table rows joined with project register summary fields
 * @output PoliceRegisterRecord response model for node-7 list/detail APIs
 * @position Node-7 police registration read model linked to project registration lifecycle
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

public class PoliceRegisterRecord {
  private Long id;
  private long projectRegisterId;
  private String applicationName;
  private String projectStatus;
  private String status;
  private String registerNo;
  private String filingAgency;
  private String contactName;
  private String contactPhone;
  private String projectManagerUsername;
  private String projectManagerDisplayName;
  private String remark;
  private String createdBy;
  private String createdAt;
  private String updatedAt;
  private String workflowNode;
  private String workflowStatus;

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public long getProjectRegisterId() {
    return projectRegisterId;
  }

  public void setProjectRegisterId(long projectRegisterId) {
    this.projectRegisterId = projectRegisterId;
  }

  public String getApplicationName() {
    return applicationName;
  }

  public void setApplicationName(String applicationName) {
    this.applicationName = applicationName;
  }

  public String getProjectStatus() {
    return projectStatus;
  }

  public void setProjectStatus(String projectStatus) {
    this.projectStatus = projectStatus;
  }

  public String getStatus() {
    return status;
  }

  public void setStatus(String status) {
    this.status = status;
  }

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

  public String getProjectManagerUsername() {
    return projectManagerUsername;
  }

  public void setProjectManagerUsername(String projectManagerUsername) {
    this.projectManagerUsername = projectManagerUsername;
  }

  public String getProjectManagerDisplayName() {
    return projectManagerDisplayName;
  }

  public void setProjectManagerDisplayName(String projectManagerDisplayName) {
    this.projectManagerDisplayName = projectManagerDisplayName;
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

  public String getWorkflowNode() {
    return workflowNode;
  }

  public void setWorkflowNode(String workflowNode) {
    this.workflowNode = workflowNode;
  }

  public String getWorkflowStatus() {
    return workflowStatus;
  }

  public void setWorkflowStatus(String workflowStatus) {
    this.workflowStatus = workflowStatus;
  }
}
