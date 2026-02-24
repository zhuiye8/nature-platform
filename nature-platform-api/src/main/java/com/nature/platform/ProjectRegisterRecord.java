/**
 * @input Project register and project_system_item query result mappings
 * @output ProjectRegisterRecord response model for project registration APIs
 * @position Project domain read model aggregating application-level and system-level details
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.util.ArrayList;
import java.util.List;

public class ProjectRegisterRecord {
  private long id;
  private long contractId;
  private int contractYear;
  private String contractName;
  private String applicationName;
  private String status;
  private Long workflowInstanceId;
  private String workflowStatus;
  private String workflowNode;
  private String processInstanceId;
  private String createdBy;
  private String createdAt;
  private List<ProjectSystemItemRequest> systemItems = new ArrayList<>();

  public long getId() {
    return id;
  }

  public void setId(long id) {
    this.id = id;
  }

  public long getContractId() {
    return contractId;
  }

  public void setContractId(long contractId) {
    this.contractId = contractId;
  }

  public int getContractYear() {
    return contractYear;
  }

  public void setContractYear(int contractYear) {
    this.contractYear = contractYear;
  }

  public String getContractName() {
    return contractName;
  }

  public void setContractName(String contractName) {
    this.contractName = contractName;
  }

  public String getApplicationName() {
    return applicationName;
  }

  public void setApplicationName(String applicationName) {
    this.applicationName = applicationName;
  }

  public String getStatus() {
    return status;
  }

  public void setStatus(String status) {
    this.status = status;
  }

  public Long getWorkflowInstanceId() {
    return workflowInstanceId;
  }

  public void setWorkflowInstanceId(Long workflowInstanceId) {
    this.workflowInstanceId = workflowInstanceId;
  }

  public String getWorkflowStatus() {
    return workflowStatus;
  }

  public void setWorkflowStatus(String workflowStatus) {
    this.workflowStatus = workflowStatus;
  }

  public String getWorkflowNode() {
    return workflowNode;
  }

  public void setWorkflowNode(String workflowNode) {
    this.workflowNode = workflowNode;
  }

  public String getProcessInstanceId() {
    return processInstanceId;
  }

  public void setProcessInstanceId(String processInstanceId) {
    this.processInstanceId = processInstanceId;
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

  public List<ProjectSystemItemRequest> getSystemItems() {
    return systemItems;
  }

  public void setSystemItems(List<ProjectSystemItemRequest> systemItems) {
    this.systemItems = systemItems;
  }
}
