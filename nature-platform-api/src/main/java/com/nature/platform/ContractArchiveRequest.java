/**
 * @input Contract archive form body fields from contract archive API
 * @output ContractArchiveRequest DTO carrying archive completion metadata
 * @position Contract archive input contract for archive-status transition handling
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

public class ContractArchiveRequest {
  private String signedAt;
  private Integer fileCount;
  private String storageLocation;
  private String remark;
  private String archiveScanObjectKey;

  public String getSignedAt() {
    return signedAt;
  }

  public void setSignedAt(String signedAt) {
    this.signedAt = signedAt;
  }

  public Integer getFileCount() {
    return fileCount;
  }

  public void setFileCount(Integer fileCount) {
    this.fileCount = fileCount;
  }

  public String getStorageLocation() {
    return storageLocation;
  }

  public void setStorageLocation(String storageLocation) {
    this.storageLocation = storageLocation;
  }

  public String getRemark() {
    return remark;
  }

  public void setRemark(String remark) {
    this.remark = remark;
  }

  public String getArchiveScanObjectKey() {
    return archiveScanObjectKey;
  }

  public void setArchiveScanObjectKey(String archiveScanObjectKey) {
    this.archiveScanObjectKey = archiveScanObjectKey;
  }
}

