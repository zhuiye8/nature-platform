/**
 * @input Recycle-bin joined query rows from contract/project tables
 * @output RecycleItemRecord response model for recycle-bin list APIs
 * @position Recycle-bin domain read model exposing deleted business records for restore operations
 * @doc-sync Update this header and folder INDEX.md when this file changes.
 */
package com.nature.platform;

public class RecycleItemRecord {
  private long bizId;
  private String bizName;
  private String deletedBy;
  private String deletedAt;
  private String extra;

  public long getBizId() {
    return bizId;
  }

  public void setBizId(long bizId) {
    this.bizId = bizId;
  }

  public String getBizName() {
    return bizName;
  }

  public void setBizName(String bizName) {
    this.bizName = bizName;
  }

  public String getDeletedBy() {
    return deletedBy;
  }

  public void setDeletedBy(String deletedBy) {
    this.deletedBy = deletedBy;
  }

  public String getDeletedAt() {
    return deletedAt;
  }

  public void setDeletedAt(String deletedAt) {
    this.deletedAt = deletedAt;
  }

  public String getExtra() {
    return extra;
  }

  public void setExtra(String extra) {
    this.extra = extra;
  }
}

