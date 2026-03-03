/**
 * @input Contract and contract_system_item query results with JSON-parsed service years
 * @output ContractRecord response model for contract list/detail APIs
 * @position Contract domain read model consolidating main fields and system detail items
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

public class ContractRecord {
  private long id;
  private long customerId;
  private String customerName;
  private String projectName;
  private String contactName;
  private String mobilePhone;
  private String paymentCompany;
  private BigDecimal paymentAmount;
  private String paymentMethod;
  private String partnerName;
  private String salesPerson;
  private String performanceCity;
  private String dealStatus;
  private String remark;
  private String contractType;
  private String contractFileObjectKey;
  private String serviceYearDetail;
  private String paymentStatus;
  private String contractName;
  private String contractNo;
  private String reviewStatus;
  private String archiveStatus;
  private String createdBy;
  private String createdAt;
  private boolean canViewDetail = true;
  private List<Integer> serviceYears = new ArrayList<>();
  private List<ContractSystemItemPayload> systemItems = new ArrayList<>();

  public long getId() {
    return id;
  }

  public void setId(long id) {
    this.id = id;
  }

  public long getCustomerId() {
    return customerId;
  }

  public void setCustomerId(long customerId) {
    this.customerId = customerId;
  }

  public String getCustomerName() {
    return customerName;
  }

  public void setCustomerName(String customerName) {
    this.customerName = customerName;
  }

  public String getProjectName() {
    return projectName;
  }

  public void setProjectName(String projectName) {
    this.projectName = projectName;
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

  public String getPaymentCompany() {
    return paymentCompany;
  }

  public void setPaymentCompany(String paymentCompany) {
    this.paymentCompany = paymentCompany;
  }

  public BigDecimal getPaymentAmount() {
    return paymentAmount;
  }

  public void setPaymentAmount(BigDecimal paymentAmount) {
    this.paymentAmount = paymentAmount;
  }

  public String getPaymentMethod() {
    return paymentMethod;
  }

  public void setPaymentMethod(String paymentMethod) {
    this.paymentMethod = paymentMethod;
  }

  public String getPartnerName() {
    return partnerName;
  }

  public void setPartnerName(String partnerName) {
    this.partnerName = partnerName;
  }

  public String getSalesPerson() {
    return salesPerson;
  }

  public void setSalesPerson(String salesPerson) {
    this.salesPerson = salesPerson;
  }

  public String getPerformanceCity() {
    return performanceCity;
  }

  public void setPerformanceCity(String performanceCity) {
    this.performanceCity = performanceCity;
  }

  public String getDealStatus() {
    return dealStatus;
  }

  public void setDealStatus(String dealStatus) {
    this.dealStatus = dealStatus;
  }

  public String getRemark() {
    return remark;
  }

  public void setRemark(String remark) {
    this.remark = remark;
  }

  public String getContractType() {
    return contractType;
  }

  public void setContractType(String contractType) {
    this.contractType = contractType;
  }

  public String getContractFileObjectKey() {
    return contractFileObjectKey;
  }

  public void setContractFileObjectKey(String contractFileObjectKey) {
    this.contractFileObjectKey = contractFileObjectKey;
  }

  public String getServiceYearDetail() {
    return serviceYearDetail;
  }

  public void setServiceYearDetail(String serviceYearDetail) {
    this.serviceYearDetail = serviceYearDetail;
  }

  public String getPaymentStatus() {
    return paymentStatus;
  }

  public void setPaymentStatus(String paymentStatus) {
    this.paymentStatus = paymentStatus;
  }

  public String getContractName() {
    return contractName;
  }

  public void setContractName(String contractName) {
    this.contractName = contractName;
  }

  public String getContractNo() {
    return contractNo;
  }

  public void setContractNo(String contractNo) {
    this.contractNo = contractNo;
  }

  public String getReviewStatus() {
    return reviewStatus;
  }

  public void setReviewStatus(String reviewStatus) {
    this.reviewStatus = reviewStatus;
  }

  public String getArchiveStatus() {
    return archiveStatus;
  }

  public void setArchiveStatus(String archiveStatus) {
    this.archiveStatus = archiveStatus;
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

  public boolean isCanViewDetail() {
    return canViewDetail;
  }

  public void setCanViewDetail(boolean canViewDetail) {
    this.canViewDetail = canViewDetail;
  }

  public List<Integer> getServiceYears() {
    return serviceYears;
  }

  public void setServiceYears(List<Integer> serviceYears) {
    this.serviceYears = serviceYears;
  }

  public List<ContractSystemItemPayload> getSystemItems() {
    return systemItems;
  }

  public void setSystemItems(List<ContractSystemItemPayload> systemItems) {
    this.systemItems = systemItems;
  }
}
