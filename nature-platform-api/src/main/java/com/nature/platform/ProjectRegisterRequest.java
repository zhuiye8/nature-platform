/**
 * @input Project register REST body and nested system-item entries
 * @output ProjectRegisterRequest DTO for create/update project registration forms
 * @position Project domain input contract carrying contract-year selection and detail entries
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import java.util.ArrayList;
import java.util.List;

public class ProjectRegisterRequest {
  @Min(1)
  private long contractId;

  @Min(2000)
  private int contractYear;

  @Valid
  @NotEmpty
  private List<ProjectSystemItemRequest> systemItems = new ArrayList<>();

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

  public List<ProjectSystemItemRequest> getSystemItems() {
    return systemItems;
  }

  public void setSystemItems(List<ProjectSystemItemRequest> systemItems) {
    this.systemItems = systemItems;
  }
}
